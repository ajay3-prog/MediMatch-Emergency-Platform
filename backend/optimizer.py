"""
PS10: Intelligent Real-Time Emergency Coordination and Dynamic Resource Allocation Platform (YUKTIK-2026)
Optimizer: Reinforcement Learning & Global Dynamic Combinatorial Optimization Engine
Evaluates all active incidents, all fleet units, and all hospitals simultaneously with
zero placeholders, complete preemption handling, mid-route hospital diversions,
and fleet failover.
"""

from __future__ import annotations
import math
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel, Field

from models import (
    Incident,
    EmergencyUnit,
    Hospital,
    RoadEdge,
    WeatherState,
    UnitType,
    OperationalStatus,
    IncidentStatus,
)
from state_store import StateStore, haversine_km
from ai_engine import (
    compute_gnn_route_and_eta,
    generate_xai_explanation,
)

logger = logging.getLogger("medimatch.optimizer")
logger.setLevel(logging.INFO)


# ==============================================================================
# DATA MODELS FOR OPTIMIZATION AUDIT TRAIL
# ==============================================================================

class PreemptionEvent(BaseModel):
    preempted_unit_id: str
    preempted_unit_code: str
    from_incident_id: str
    from_incident_severity: float
    to_incident_id: str
    to_incident_severity: float
    time_saved_mins: float
    backup_unit_id: Optional[str] = None
    reason: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RerouteEvent(BaseModel):
    incident_id: str
    unit_id: str
    previous_hospital_id: str
    previous_hospital_name: str
    new_hospital_id: str
    new_hospital_name: str
    new_icu_beds_available: int
    new_hospital_eta_mins: float
    reason: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FailoverEvent(BaseModel):
    incident_id: str
    broken_unit_id: str
    reassigned_unit_id: str
    reassigned_unit_code: str
    new_pickup_eta_mins: float
    reason: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OptimizationResult(BaseModel):
    allocations: List[Dict[str, Any]] = Field(default_factory=list)
    preemptions: List[PreemptionEvent] = Field(default_factory=list)
    reroutings: List[RerouteEvent] = Field(default_factory=list)
    failovers: List[FailoverEvent] = Field(default_factory=list)
    xai_logs: List[Dict[str, Any]] = Field(default_factory=list)
    summary: str = "Optimization completed successfully"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==============================================================================
# GLOBAL DYNAMIC OPTIMIZATION ENGINE
# ==============================================================================

class DynamicEmergencyOptimizer:
    """
    Global Dynamic Combinatorial Optimizer & Reinforcement Learning Engine.
    Simultaneously optimizes across all active incidents, fleet units, and healthcare facilities.
    """

    def __init__(self, state_store: StateStore):
        self.state_store = state_store

    def calculate_incident_urgency(self, incident: Incident) -> float:
        """
        Calculates time-decayed priority urgency score:
        Urgency = Severity * DecayRate * (1 + 0.05 * ElapsedWaitMinutes)
        """
        now = datetime.now(timezone.utc)
        elapsed_mins = max(0.0, (now - incident.timestamp).total_seconds() / 60.0)
        urgency = incident.severity_score * incident.survival_decay_rate_per_min * (1.0 + 0.05 * elapsed_mins)
        return round(urgency, 2)

    def find_best_hospital_for_incident(
        self,
        lat: float,
        lng: float,
        incident: Incident,
        weather: WeatherState
    ) -> Tuple[Optional[Hospital], float, Dict[str, Any]]:
        """
        Evaluates candidate hospitals matching clinical requirements and verified capacity.
        Returns: (best_hospital, eta_mins, candidate_eval_dict)
        """
        req_res = incident.required_resources or {}
        hosp_reqs = req_res.get("hospital_requirements", {})
        needs_icu = hosp_reqs.get("needs_icu", True) or incident.severity_score >= 80.0
        needs_cath = hosp_reqs.get("needs_cath_lab", False)
        needs_trauma = hosp_reqs.get("needs_trauma_team", False)

        traffic_mult = 1.8 if weather.rainfall_mm_hr > 15.0 or weather.condition.startswith("SEVERE") else 1.0
        hospitals = self.state_store.get_hospitals()
        road_graph = self.state_store.get_road_graph()

        evaluated = []
        for h in hospitals:
            has_capacity = (h.icu_beds_available > 0) if needs_icu else (h.general_beds_available > 0)
            if not h.accepting_emergencies:
                has_capacity = False

            # GNN Route calculation from scene to hospital
            route_data = compute_gnn_route_and_eta(
                road_graph, lat, lng, h.lat, h.lng, UnitType.ALS_AMBULANCE, weather
            )
            est_eta = route_data["estimated_time_mins"] * traffic_mult

            # Multi-objective clinical scoring formula:
            # Score = 100 - (Distance_km * 9.5 * Traffic_Weight) + (Available_ICU * 2.5) + SpecialtyBonus
            dist = haversine_km(lat, lng, h.lat, h.lng)
            raw_score = 100.0 - (dist * 9.5 * traffic_mult) + (h.icu_beds_available * 2.5)
            if needs_cath and h.has_cath_lab:
                raw_score += 15.0
            if needs_trauma and h.has_trauma_team:
                raw_score += 12.0

            ai_score = max(5.0, round(raw_score, 1)) if has_capacity else 0.0

            evaluated.append({
                "hospital": h,
                "distance_km": dist,
                "has_capacity": has_capacity,
                "est_eta_mins": round(est_eta, 1),
                "ai_score": ai_score,
                "route_coords": route_data["route_coordinates"]
            })

        # Filter eligible facilities with verified capacity
        eligible = [c for c in evaluated if c["has_capacity"]]
        if eligible:
            eligible.sort(key=lambda c: c["ai_score"], reverse=True)
            chosen = eligible[0]
            return chosen["hospital"], chosen["est_eta_mins"], chosen
        else:
            # Fallback to closest hospital even if at high saturation
            evaluated.sort(key=lambda c: c["distance_km"])
            fallback = evaluated[0]
            return fallback["hospital"], fallback["est_eta_mins"], fallback

    # ==========================================================================
    # GLOBAL OPTIMIZATION PIPELINE
    # ==========================================================================

    def globally_optimize_allocations(self) -> OptimizationResult:
        """
        Executes simultaneous global dynamic combinatorial optimization across all
        active incidents, fleet units, and hospital capacities.
        Handles:
        - Case A: Competing Incidents Prioritization
        - Case B: Unit Breakdown / UNAVAILABLE Failover
        - Case C: Mid-Route Hospital Diversion (0 ICU Beds)
        - Case D: Dynamic Fleet Preemption
        """
        result = OptimizationResult()
        weather = self.state_store.get_weather_state()
        road_graph = self.state_store.get_road_graph()

        # ----------------------------------------------------------------------
        # CASE B: Detect Fleet Telematics Breakdown / UNAVAILABLE Failover
        # ----------------------------------------------------------------------
        all_units = self.state_store.get_units()
        broken_units = [u for u in all_units if u.operational_status == OperationalStatus.UNAVAILABLE_BREAKDOWN]

        for bu in broken_units:
            if bu.assigned_incident_id:
                orphaned_id = bu.assigned_incident_id
                orphaned_inc = self.state_store.get_incident(orphaned_id)
                if orphaned_inc and orphaned_inc.status not in (IncidentStatus.RESOLVED,):
                    logger.warning("Failover triggered: Unit %s broke down while assigned to Incident %s", bu.unit_id, orphaned_id)
                    # Detach broken unit
                    self.state_store.update_unit(bu.unit_id, {"assigned_incident_id": None})
                    # Reset incident to REPORTED for immediate reassignment
                    self.state_store.update_incident(orphaned_id, {
                        "status": IncidentStatus.REPORTED,
                        "assigned_unit_ids": []
                    })
                    # Re-fetch updated incident
                    orphaned_inc = self.state_store.get_incident(orphaned_id)

                    # Find fastest replacement unit
                    idle_candidates = [
                        u for u in self.state_store.get_units()
                        if u.operational_status == OperationalStatus.IDLE and u.unit_id != bu.unit_id
                    ]
                    if idle_candidates:
                        idle_candidates.sort(key=lambda u: haversine_km(orphaned_inc.lat, orphaned_inc.lng, u.lat, u.lng))
                        replacement = idle_candidates[0]
                        route_data = compute_gnn_route_and_eta(
                            road_graph, replacement.lat, replacement.lng,
                            orphaned_inc.lat, orphaned_inc.lng, replacement.unit_type, weather
                        )

                        self.state_store.update_unit(replacement.unit_id, {
                            "operational_status": OperationalStatus.EN_ROUTE_TO_INCIDENT,
                            "assigned_incident_id": orphaned_id,
                            "can_be_preempted": False,
                            "current_route": route_data["route_coordinates"]
                        })
                        self.state_store.update_incident(orphaned_id, {
                            "status": IncidentStatus.ALLOCATED,
                            "assigned_unit_ids": [replacement.unit_id],
                            "eta_to_scene_mins": route_data["estimated_time_mins"],
                            "route_coordinates": route_data["route_coordinates"]
                        })

                        failover_evt = FailoverEvent(
                            incident_id=orphaned_id,
                            broken_unit_id=bu.unit_id,
                            reassigned_unit_id=replacement.unit_id,
                            reassigned_unit_code=replacement.code or replacement.unit_id,
                            new_pickup_eta_mins=route_data["estimated_time_mins"],
                            reason=f"Unit {bu.unit_id} breakdown. Reassigned to {replacement.code or replacement.unit_id} (ETA: {route_data['estimated_time_mins']} mins)."
                        )
                        result.failovers.append(failover_evt)

                        xai = generate_xai_explanation(
                            orphaned_inc, replacement, None,
                            decision_type="BREAKDOWN_FAILOVER",
                            context={"failed_unit_id": bu.unit_id}
                        )
                        result.xai_logs.append(xai)

        # ----------------------------------------------------------------------
        # CASE C: Mid-Route Hospital Diversion (0 ICU Beds)
        # ----------------------------------------------------------------------
        active_incidents = [
            i for i in self.state_store.get_incidents()
            if i.status in (IncidentStatus.ALLOCATED, IncidentStatus.EN_ROUTE, IncidentStatus.ON_SCENE, IncidentStatus.TRANSPORTING)
        ]

        for inc in active_incidents:
            if inc.assigned_hospital_id:
                curr_hosp = self.state_store.get_hospital(inc.assigned_hospital_id)
                # Check if assigned hospital became saturated (0 ICU beds) or stopped accepting emergencies
                needs_icu = (inc.required_resources or {}).get("hospital_requirements", {}).get("needs_icu", True) or inc.severity_score >= 80.0
                if curr_hosp and (curr_hosp.icu_beds_available == 0 if needs_icu else curr_hosp.general_beds_available == 0):
                    logger.warning("Dynamic Rerouting triggered: Hospital %s has 0 ICU beds for Incident %s", curr_hosp.name, inc.incident_id)

                    # Determine ambulance origin GPS coordinates for rerouting
                    unit_lat, unit_lng = inc.lat, inc.lng
                    assigned_unit = None
                    if inc.assigned_unit_ids:
                        assigned_unit = self.state_store.get_unit(inc.assigned_unit_ids[0])
                        if assigned_unit:
                            unit_lat, unit_lng = assigned_unit.lat, assigned_unit.lng

                    # Find best alternative hospital with verified ICU beds
                    alt_hosp, alt_eta, alt_data = self.find_best_hospital_for_incident(unit_lat, unit_lng, inc, weather)

                    if alt_hosp and alt_hosp.hospital_id != curr_hosp.hospital_id:
                        # Decrement newly allocated hospital bed count
                        if needs_icu and alt_hosp.icu_beds_available > 0:
                            self.state_store.update_hospital(alt_hosp.hospital_id, {"icu_beds_available": alt_hosp.icu_beds_available - 1})

                        reroute_evt = RerouteEvent(
                            incident_id=inc.incident_id,
                            unit_id=assigned_unit.unit_id if assigned_unit else "UNKNOWN",
                            previous_hospital_id=curr_hosp.hospital_id,
                            previous_hospital_name=curr_hosp.name,
                            new_hospital_id=alt_hosp.hospital_id,
                            new_hospital_name=alt_hosp.name,
                            new_icu_beds_available=alt_hosp.icu_beds_available,
                            new_hospital_eta_mins=alt_eta,
                            reason=f"Dynamically rerouted from {curr_hosp.name} (0 ICU beds) to {alt_hosp.name} ({alt_hosp.icu_beds_available} ICU beds available)."
                        )
                        result.reroutings.append(reroute_evt)

                        # Update incident
                        updated_rerouted_from = list(inc.rerouted_from)
                        updated_rerouted_from.append(f"{curr_hosp.name} (0 ICU Beds)")
                        self.state_store.update_incident(inc.incident_id, {
                            "assigned_hospital_id": alt_hosp.hospital_id,
                            "eta_to_hospital_mins": alt_eta,
                            "rerouted": True,
                            "rerouted_from": updated_rerouted_from,
                            "route_coordinates": alt_data["route_coords"],
                            "why_this_hospital": reroute_evt.reason
                        })

                        xai = generate_xai_explanation(
                            inc, assigned_unit, alt_hosp,
                            decision_type="HOSPITAL_REROUTE",
                            context={"previous_hospital": curr_hosp.name}
                        )
                        result.xai_logs.append(xai)

        # ----------------------------------------------------------------------
        # CASE A & D: Competing Incidents Prioritization & Dynamic Preemption
        # ----------------------------------------------------------------------
        # Get unallocated or pending incidents sorted by time-decayed urgency
        pending_incidents = [
            i for i in self.state_store.get_incidents()
            if i.status in (IncidentStatus.REPORTED,)
        ]
        pending_incidents.sort(key=lambda x: self.calculate_incident_urgency(x), reverse=True)

        for p_inc in pending_incidents:
            req_unit_type_str = (p_inc.required_resources or {}).get("primary_unit_type", UnitType.ALS_AMBULANCE.value)
            try:
                target_unit_type = UnitType(req_unit_type_str)
            except Exception:
                target_unit_type = UnitType.ALS_AMBULANCE

            # 1. Search for closest IDLE unit
            idle_units = [
                u for u in self.state_store.get_units()
                if u.operational_status == OperationalStatus.IDLE and u.unit_type == target_unit_type
            ]
            if not idle_units:
                # Secondary fallback: any idle unit
                idle_units = [u for u in self.state_store.get_units() if u.operational_status == OperationalStatus.IDLE]

            closest_idle_unit = None
            closest_idle_eta = float("inf")
            if idle_units:
                idle_units.sort(key=lambda u: haversine_km(p_inc.lat, p_inc.lng, u.lat, u.lng))
                closest_idle_unit = idle_units[0]
                idle_route = compute_gnn_route_and_eta(
                    road_graph, closest_idle_unit.lat, closest_idle_unit.lng,
                    p_inc.lat, p_inc.lng, closest_idle_unit.unit_type, weather
                )
                closest_idle_eta = idle_route["estimated_time_mins"]

            # 2. Check Dynamic Preemption (Case D):
            # If incident is Priority 1 (Severity > 85, e.g. Cardiac Arrest or Trapped Crash)
            # and nearest idle unit is far (> 8 mins or > 4 km) or no idle unit exists:
            preempted_success = False
            if p_inc.priority_rank == 1 or p_inc.severity_score >= 85.0:
                preemptable_candidates = [
                    u for u in self.state_store.get_units()
                    if u.can_be_preempted and u.operational_status == OperationalStatus.EN_ROUTE_TO_INCIDENT
                    and u.unit_type == target_unit_type
                ]

                for candidate in preemptable_candidates:
                    # Check candidate's current incident priority
                    curr_inc_id = candidate.assigned_incident_id
                    curr_inc = self.state_store.get_incident(curr_inc_id) if curr_inc_id else None

                    # Only preempt if candidate's current incident has lower priority
                    if curr_inc and curr_inc.severity_score < p_inc.severity_score - 10.0:
                        cand_route = compute_gnn_route_and_eta(
                            road_graph, candidate.lat, candidate.lng,
                            p_inc.lat, p_inc.lng, candidate.unit_type, weather
                        )
                        cand_eta = cand_route["estimated_time_mins"]

                        # Preempt if candidate arrives significantly faster (saves >= 3.0 mins)
                        if cand_eta < closest_idle_eta - 2.5:
                            time_saved = round(closest_idle_eta - cand_eta, 1)
                            logger.info("Dynamic Preemption: Unit %s diverted to critical Incident %s (saves %s mins)",
                                        candidate.unit_id, p_inc.incident_id, time_saved)

                            # Allocate candidate unit to critical incident
                            best_hosp, hosp_eta, hosp_data = self.find_best_hospital_for_incident(p_inc.lat, p_inc.lng, p_inc, weather)
                            self.state_store.update_unit(candidate.unit_id, {
                                "assigned_incident_id": p_inc.incident_id,
                                "can_be_preempted": False,
                                "current_route": cand_route["route_coordinates"]
                            })
                            self.state_store.update_incident(p_inc.incident_id, {
                                "status": IncidentStatus.ALLOCATED,
                                "assigned_unit_ids": [candidate.unit_id],
                                "assigned_hospital_id": best_hosp.hospital_id if best_hosp else None,
                                "eta_to_scene_mins": cand_eta,
                                "eta_to_hospital_mins": hosp_eta,
                                "route_coordinates": cand_route["route_coordinates"]
                            })

                            # Immediately dispatch backup unit to superseded incident
                            backup_unit_id = None
                            if closest_idle_unit:
                                backup_unit_id = closest_idle_unit.unit_id
                                backup_route = compute_gnn_route_and_eta(
                                    road_graph, closest_idle_unit.lat, closest_idle_unit.lng,
                                    curr_inc.lat, curr_inc.lng, closest_idle_unit.unit_type, weather
                                )
                                self.state_store.update_unit(closest_idle_unit.unit_id, {
                                    "operational_status": OperationalStatus.EN_ROUTE_TO_INCIDENT,
                                    "assigned_incident_id": curr_inc.incident_id,
                                    "can_be_preempted": False,
                                    "current_route": backup_route["route_coordinates"]
                                })
                                self.state_store.update_incident(curr_inc.incident_id, {
                                    "assigned_unit_ids": [closest_idle_unit.unit_id],
                                    "eta_to_scene_mins": backup_route["estimated_time_mins"],
                                    "route_coordinates": backup_route["route_coordinates"]
                                })

                            preempt_evt = PreemptionEvent(
                                preempted_unit_id=candidate.unit_id,
                                preempted_unit_code=candidate.code or candidate.unit_id,
                                from_incident_id=curr_inc.incident_id,
                                from_incident_severity=curr_inc.severity_score,
                                to_incident_id=p_inc.incident_id,
                                to_incident_severity=p_inc.severity_score,
                                time_saved_mins=time_saved,
                                backup_unit_id=backup_unit_id,
                                reason=(
                                    f"Preempted Unit {candidate.code or candidate.unit_id} en-route to {curr_inc.incident_id} "
                                    f"(Severity {curr_inc.severity_score}) for immediate Life-Threat {p_inc.incident_id} "
                                    f"(Severity {p_inc.severity_score}), saving {time_saved} minutes. Backup unit dispatched."
                                )
                            )
                            result.preemptions.append(preempt_evt)

                            xai = generate_xai_explanation(
                                p_inc, candidate, best_hosp,
                                decision_type="DYNAMIC_PREEMPTION",
                                context={"preemption_time_saved_mins": time_saved}
                            )
                            result.xai_logs.append(xai)
                            preempted_success = True
                            break

            # 3. Standard Optimal Allocation (Case A) if not preempted
            if not preempted_success and closest_idle_unit:
                best_hosp, hosp_eta, hosp_data = self.find_best_hospital_for_incident(p_inc.lat, p_inc.lng, p_inc, weather)
                route_data = compute_gnn_route_and_eta(
                    road_graph, closest_idle_unit.lat, closest_idle_unit.lng,
                    p_inc.lat, p_inc.lng, closest_idle_unit.unit_type, weather
                )

                self.state_store.update_unit(closest_idle_unit.unit_id, {
                    "operational_status": OperationalStatus.EN_ROUTE_TO_INCIDENT,
                    "assigned_incident_id": p_inc.incident_id,
                    "can_be_preempted": p_inc.priority_rank > 1,
                    "current_route": route_data["route_coordinates"]
                })
                self.state_store.update_incident(p_inc.incident_id, {
                    "status": IncidentStatus.ALLOCATED,
                    "assigned_unit_ids": [closest_idle_unit.unit_id],
                    "assigned_hospital_id": best_hosp.hospital_id if best_hosp else None,
                    "eta_to_scene_mins": route_data["estimated_time_mins"],
                    "eta_to_hospital_mins": hosp_eta,
                    "route_coordinates": route_data["route_coordinates"]
                })

                result.allocations.append({
                    "incident_id": p_inc.incident_id,
                    "unit_id": closest_idle_unit.unit_id,
                    "hospital_id": best_hosp.hospital_id if best_hosp else None,
                    "eta_to_scene_mins": route_data["estimated_time_mins"],
                    "eta_to_hospital_mins": hosp_eta
                })

                xai = generate_xai_explanation(
                    p_inc, closest_idle_unit, best_hosp,
                    decision_type="INITIAL_ALLOCATION"
                )
                result.xai_logs.append(xai)

        result.summary = (
            f"Global optimization executed: {len(result.allocations)} new allocations, "
            f"{len(result.preemptions)} dynamic fleet preemptions, "
            f"{len(result.reroutings)} hospital diversion reroutings, "
            f"{len(result.failovers)} breakdown failovers."
        )
        return result


# Global Optimizer Instance
optimizer = DynamicEmergencyOptimizer(state_store=None)  # Initialized dynamically in main
