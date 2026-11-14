"""
PS10: Intelligent Real-Time Emergency Coordination and Dynamic Resource Allocation Platform (YUKTIK-2026)
Production FastAPI Backend with WebSocket Telemetry Broadcasting,
Smooth GPS Simulation Background Loop, and 10:30 AM Tricky Scenario Engine.
"""

from __future__ import annotations
import os
import json
import math
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union
from contextlib import asynccontextmanager

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    Body,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from models import (
    Incident,
    EmergencyUnit,
    Hospital,
    RoadEdge,
    WeatherState,
    CallerType,
    EmergencyType,
    IncidentStatus,
    OperationalStatus,
    UnitType,
    generate_postgis_ddl,
)
from state_store import state_store, haversine_km
from ai_engine import (
    extract_nlp_features,
    analyze_incident_media,
    predict_severity_and_resources,
    compute_gnn_route_and_eta,
    forecast_hospital_and_zone_demand,
    generate_xai_explanation,
)
from optimizer import DynamicEmergencyOptimizer, OptimizationResult

logger = logging.getLogger("medimatch.main")
logging.basicConfig(level=logging.INFO)

# Global Optimizer
optimizer = DynamicEmergencyOptimizer(state_store)

# Global Rolling XAI Audit Trail (last 100 explainable decisions)
xai_audit_logs: List[Dict[str, Any]] = []


def record_xai_log(entry: Dict[str, Any]) -> None:
    """Appends an XAI explanation to the rolling system audit log."""
    global xai_audit_logs
    if "timestamp" not in entry:
        entry["timestamp"] = datetime.now(timezone.utc).isoformat()
    xai_audit_logs.insert(0, entry)
    if len(xai_audit_logs) > 100:
        xai_audit_logs = xai_audit_logs[:100]


# ==============================================================================
# WEBSOCKET REAL-TIME CONNECTION MANAGER
# ==============================================================================

class ConnectionManager:
    """
    Manages active WebSocket connections from Command Center,
    Hospital Portals, and Citizen Trackers.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        logger.info("WebSocket client connected. Active connections: %d", len(self.active_connections))

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info("WebSocket client disconnected. Remaining connections: %d", len(self.active_connections))

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts JSON payload to all active WebSocket listeners."""
        json_str = json.dumps(message, default=str)
        async with self._lock:
            dead_connections = []
            for connection in self.active_connections:
                try:
                    await connection.send_text(json_str)
                except Exception:
                    dead_connections.append(connection)
            for dead in dead_connections:
                if dead in self.active_connections:
                    self.active_connections.remove(dead)


manager = ConnectionManager()


async def broadcast_full_state(event_type: str = "STATE_UPDATE", details: Optional[Dict[str, Any]] = None):
    """Utility to broadcast state snapshot to all WebSocket clients."""
    snapshot = get_full_system_snapshot()
    payload = {
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": details or {},
        "state": snapshot
    }
    await manager.broadcast(payload)


# ==============================================================================
# BACKGROUND GPS SIMULATION ENGINE (1.5s SMOOTH TELEMETRY ADVANCE)
# ==============================================================================

def calculate_heading(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Computes compass bearing in degrees from point 1 to point 2."""
    d_lng = math.radians(lng2 - lng1)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    y = math.sin(d_lng) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lng)
    bearing = (math.degrees(math.atan2(y, x)) + 360) % 360
    return round(bearing, 1)


async def gps_simulation_loop():
    """
    Background Async Task:
    Every 1.5 seconds, moves active emergency fleet units step-by-step along
    their assigned route coordinates, transitions states upon arrival,
    and broadcasts live telematics over WebSocket.
    """
    logger.info("Starting background GPS Telematics Simulation Loop (1.5s interval)...")
    weather = state_store.get_weather_state()
    road_graph = state_store.get_road_graph()

    while True:
        try:
            await asyncio.sleep(1.5)
            units = state_store.get_units()
            moved_any = False

            for u in units:
                # --------------------------------------------------------------
                # Mode 1: Vehicle en-route to emergency scene
                # --------------------------------------------------------------
                if u.operational_status == OperationalStatus.EN_ROUTE_TO_INCIDENT:
                    if u.current_route and len(u.current_route) > 1:
                        prev_point = [u.lat, u.lng]
                        next_point = u.current_route[1]
                        remaining_route = u.current_route[1:]
                        heading = calculate_heading(prev_point[0], prev_point[1], next_point[0], next_point[1])

                        # Advance unit coordinates
                        state_store.update_unit(u.unit_id, {
                            "lat": next_point[0],
                            "lng": next_point[1],
                            "heading": heading,
                            "speed_kmph": 52.0,
                            "current_route": remaining_route
                        })
                        moved_any = True

                        # Update remaining pickup ETA on incident
                        if u.assigned_incident_id:
                            inc = state_store.get_incident(u.assigned_incident_id)
                            if inc:
                                est_mins = max(0.5, round(len(remaining_route) * 0.8, 1))
                                state_store.update_incident(inc.incident_id, {
                                    "eta_to_scene_mins": est_mins
                                })

                        # Check if arrived at scene!
                        if len(remaining_route) <= 1:
                            logger.info("Unit %s ARRIVED ON SCENE at Incident %s", u.unit_id, u.assigned_incident_id)
                            state_store.update_unit(u.unit_id, {
                                "operational_status": OperationalStatus.ON_SCENE,
                                "speed_kmph": 0.0,
                                "can_be_preempted": False,
                                "current_route": []
                            })
                            if u.assigned_incident_id:
                                inc = state_store.get_incident(u.assigned_incident_id)
                                if inc:
                                    state_store.update_incident(inc.incident_id, {
                                        "status": IncidentStatus.ON_SCENE,
                                        "eta_to_scene_mins": 0.0
                                    })
                                    # Setup transport route to hospital if hospital is assigned
                                    if inc.assigned_hospital_id:
                                        hosp = state_store.get_hospital(inc.assigned_hospital_id)
                                        if hosp:
                                            hosp_route = compute_gnn_route_and_eta(
                                                road_graph, inc.lat, inc.lng, hosp.lat, hosp.lng, u.unit_type, weather
                                            )
                                            state_store.update_unit(u.unit_id, {
                                                "operational_status": OperationalStatus.TRANSPORTING_TO_HOSPITAL,
                                                "target_hospital_id": hosp.hospital_id,
                                                "current_route": hosp_route["route_coordinates"]
                                            })
                                            state_store.update_incident(inc.incident_id, {
                                                "status": IncidentStatus.TRANSPORTING,
                                                "eta_to_hospital_mins": hosp_route["estimated_time_mins"],
                                                "route_coordinates": hosp_route["route_coordinates"]
                                            })

                # --------------------------------------------------------------
                # Mode 2: Vehicle transporting patient to hospital
                # --------------------------------------------------------------
                elif u.operational_status == OperationalStatus.TRANSPORTING_TO_HOSPITAL:
                    if u.current_route and len(u.current_route) > 1:
                        prev_point = [u.lat, u.lng]
                        next_point = u.current_route[1]
                        remaining_route = u.current_route[1:]
                        heading = calculate_heading(prev_point[0], prev_point[1], next_point[0], next_point[1])

                        state_store.update_unit(u.unit_id, {
                            "lat": next_point[0],
                            "lng": next_point[1],
                            "heading": heading,
                            "speed_kmph": 58.0,
                            "current_route": remaining_route
                        })
                        moved_any = True

                        if u.assigned_incident_id:
                            inc = state_store.get_incident(u.assigned_incident_id)
                            if inc:
                                est_hosp_mins = max(0.5, round(len(remaining_route) * 0.9, 1))
                                state_store.update_incident(inc.incident_id, {
                                    "eta_to_hospital_mins": est_hosp_mins
                                })

                        # Check if arrived at hospital!
                        if len(remaining_route) <= 1:
                            logger.info("Unit %s ARRIVED AT HOSPITAL with patient from Incident %s", u.unit_id, u.assigned_incident_id)
                            if u.assigned_incident_id:
                                state_store.update_incident(u.assigned_incident_id, {
                                    "status": IncidentStatus.RESOLVED,
                                    "eta_to_hospital_mins": 0.0
                                })
                            state_store.update_unit(u.unit_id, {
                                "operational_status": OperationalStatus.IDLE,
                                "assigned_incident_id": None,
                                "target_hospital_id": None,
                                "speed_kmph": 0.0,
                                "can_be_preempted": True,
                                "current_route": []
                            })

            if moved_any:
                await broadcast_full_state("GPS_TELEMETRY_TICK")

        except asyncio.CancelledError:
            logger.info("GPS simulation background loop cancelled.")
            break
        except Exception as e:
            logger.error("Error in GPS simulation loop: %s", e)


# ==============================================================================
# LIFESPAN CONTEXT (FastAPI Startup / Shutdown Background Tasks)
# ==============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch GPS loop
    gps_task = asyncio.create_task(gps_simulation_loop())
    yield
    # Shutdown
    gps_task.cancel()
    try:
        await gps_task
    except asyncio.CancelledError:
        logger.info("GPS simulation background task cancelled.")


app = FastAPI(
    title="MediMatch Intelligent Emergency Coordination Platform - PS10 YUKTIK-2026",
    description="Intelligent Real-Time Emergency Coordination and Dynamic Resource Allocation Platform",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# HELPER: SYSTEM SNAPSHOT AGGREGATOR
# ==============================================================================

def get_full_system_snapshot() -> Dict[str, Any]:
    """Compiles the master snapshot for REST API and WebSocket broadcasts."""
    base_snapshot = state_store.get_system_snapshot()
    hospitals = state_store.get_hospitals()
    weather = state_store.get_weather_state()

    # Time-series forecast for next 3 hours
    forecast = forecast_hospital_and_zone_demand(hospitals, weather)

    return {
        **base_snapshot,
        "xai_audit_logs": xai_audit_logs,
        "forecast": forecast
    }


# ==============================================================================
# 1. WEBSOCKET ENDPOINT
# ==============================================================================

@app.websocket("/ws")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    Real-Time WebSocket Feed:
    Broadcasts sub-second GPS vehicle movement, state transitions,
    dynamic hospital diversions, preemption events, and XAI justifications.
    """
    await manager.connect(websocket)
    # Send initial master state snapshot on connection
    try:
        initial_payload = json.dumps({
            "event": "INITIAL_SYNC",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "state": get_full_system_snapshot()
        }, default=str)
        await websocket.send_text(initial_payload)
        while True:
            # Keep connection alive; accept any inbound client ping/action
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
                if parsed.get("action") == "PING":
                    await websocket.send_text(json.dumps({"event": "PONG", "timestamp": datetime.now(timezone.utc).isoformat()}, default=str))
            except Exception as e:
                logger.debug("Non-JSON WS message received: %s", e)
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.warning("WebSocket exception: %s", e)
        await manager.disconnect(websocket)


# ==============================================================================
# 2. CORE REST API ENDPOINTS
# ==============================================================================

@app.get("/api/state")
def get_system_state():
    """
    Requirement 1: Returns complete snapshot of active incidents, all emergency units,
    all hospitals, road network edges, weather state, XAI decision audit logs,
    and time-series forecast data.
    """
    return get_full_system_snapshot()


class EmergencyReportPayload(BaseModel):
    caller_phone: str = "+91 98480-10800"
    caller_type: str = "BYSTANDER"
    raw_text_description: str
    raw_audio_transcript: Optional[str] = None
    uploaded_media_url: Optional[str] = None
    lat: float = 17.4400
    lng: float = 78.3500
    address: str = "Gachibowli Junction, Hyderabad"


@app.post("/api/incidents/report")
async def report_emergency_incident(
    payload: Optional[EmergencyReportPayload] = Body(None),
    description: Optional[str] = Form(None),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    caller_phone: Optional[str] = Form(None),
    caller_type: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None)
):
    """
    Requirement 2: Ingests a new 108 emergency report (supports both JSON and multipart form),
    runs the 7 AI engines, runs global dynamic optimization, logs XAI justification,
    and broadcasts the updated state via WebSocket.
    """
    # Normalize input from JSON body or Form
    text_desc = ""
    audio_trans = None
    photo_b64 = None
    rep_lat = 17.4400
    rep_lng = 78.3500
    phone = "+91 98480-10800"
    c_type_str = "BYSTANDER"
    addr = "Gachibowli Corridor, Hyderabad"

    if payload:
        text_desc = payload.raw_text_description
        audio_trans = payload.raw_audio_transcript
        photo_b64 = payload.uploaded_media_url
        rep_lat = payload.lat
        rep_lng = payload.lng
        phone = payload.caller_phone
        c_type_str = payload.caller_type
        addr = payload.address
    else:
        text_desc = description or "Emergency reported at location"
        rep_lat = lat if lat is not None else 17.4400
        rep_lng = lng if lng is not None else 78.3500
        phone = caller_phone or "+91 98480-10800"
        c_type_str = caller_type or "BYSTANDER"

    if photo:
        photo_bytes = await photo.read()
        mime = photo.content_type or "image/jpeg"
        photo_b64 = f"data:{mime};base64,{base64.b64encode(photo_bytes).decode('utf-8')}"

    # 1. NLP Extractor
    nlp_data = extract_nlp_features(text_desc)

    # 2. CV Scene Analyzer
    cv_data = analyze_incident_media(text_context=text_desc)

    # 3. Severity & Resource Predictor
    try:
        c_type = CallerType(c_type_str.upper())
    except Exception:
        c_type = CallerType.BYSTANDER

    pred_data = predict_severity_and_resources(
        nlp_data=nlp_data,
        cv_data=cv_data,
        zone="Gachibowli",
        weather=state_store.get_weather_state(),
        caller_type=c_type
    )

    inc_id = f"SOS-{101 + len(state_store.get_incidents())}"
    try:
        e_type = EmergencyType(nlp_data.get("emergency_type", "ROAD_ACCIDENT"))
    except Exception:
        e_type = EmergencyType.ROAD_ACCIDENT

    new_incident = Incident(
        incident_id=inc_id,
        timestamp=datetime.now(timezone.utc),
        caller_phone=phone,
        caller_type=c_type,
        raw_audio_transcript=audio_trans or text_desc,
        raw_text_description=text_desc,
        uploaded_media_url=photo_b64,
        lat=rep_lat,
        lng=rep_lng,
        address=addr,
        emergency_type=e_type,
        victims_count=nlp_data.get("victims_count", 1),
        critical_victims_count=nlp_data.get("critical_victims_count", 0),
        trapped_status=nlp_data.get("trapped_status", False),
        fire_smoke_detected=nlp_data.get("fire_smoke_detected", False) or cv_data.get("fire_smoke_detected", False),
        water_depth_cm=max(nlp_data.get("water_depth_cm", 0.0), cv_data.get("water_depth_cm", 0.0)),
        vehicle_deformation_score=max(nlp_data.get("vehicle_deformation_score", 0.0), cv_data.get("vehicle_deformation_score", 0.0)),
        hazmat_leak=nlp_data.get("hazmat_leak", False),
        severity_score=pred_data["severity_score"],
        survival_decay_rate_per_min=pred_data["survival_decay_rate_per_min"],
        priority_rank=pred_data["priority_rank"],
        required_resources=pred_data["required_resources"],
        status=IncidentStatus.REPORTED,
        photo_url=photo_b64,
        triage=pred_data["triage_summary"]
    )

    state_store.add_incident(new_incident)

    # Run Global Dynamic Optimization
    opt_res = optimizer.globally_optimize_allocations()

    # Record XAI logs generated
    for log_item in opt_res.xai_logs:
        record_xai_log(log_item)

    # Fetch newly allocated incident state
    persisted_inc = state_store.get_incident(inc_id)

    # Broadcast real-time WebSocket state update
    await broadcast_full_state("INCIDENT_REPORTED", {
        "incident_id": inc_id,
        "optimization": opt_res.model_dump()
    })

    return {
        "incident": persisted_inc.model_dump() if persisted_inc else new_incident.model_dump(),
        "optimization_result": opt_res.model_dump()
    }


# Backwards-compatible SOS endpoint
@app.post("/api/sos")
async def create_sos_backward_compatible(
    description: str = Form(...),
    lat: float = Form(17.4400),
    lng: float = Form(78.3500),
    caller_phone: str = Form("+91 98480-10800"),
    caller_type: str = Form("BYSTANDER"),
    photo: Optional[UploadFile] = File(None)
):
    """Backwards-compatible SOS endpoint calling report_emergency_incident."""
    res = await report_emergency_incident(
        payload=None,
        description=description,
        lat=lat,
        lng=lng,
        caller_phone=caller_phone,
        caller_type=caller_type,
        photo=photo
    )
    return res["incident"]


class UnitStatusUpdatePayload(BaseModel):
    operational_status: Optional[str] = None
    triage_severity_upgrade: Optional[float] = None
    victims_count_update: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    fuel_pct: Optional[float] = None


@app.post("/api/units/{unit_id}/status")
async def update_unit_status(unit_id: str, payload: UnitStatusUpdatePayload):
    """
    Requirement 3: Updates ambulance status (including a one-click BREAKDOWN trigger
    and on-scene paramedic triage severity upgrade) and immediately triggers
    global re-optimization + XAI logging.
    """
    unit = state_store.get_unit(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Fleet unit not found")

    updates: Dict[str, Any] = {}

    # Handle status change (e.g. UNAVAILABLE_BREAKDOWN)
    if payload.operational_status:
        try:
            new_status = OperationalStatus(payload.operational_status.upper())
            updates["operational_status"] = new_status
            if new_status == OperationalStatus.UNAVAILABLE_BREAKDOWN:
                updates["speed_kmph"] = 0.0
                updates["can_be_preempted"] = False
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid operational status: {payload.operational_status}")

    if payload.lat is not None and payload.lng is not None:
        updates["lat"] = payload.lat
        updates["lng"] = payload.lng

    if payload.fuel_pct is not None:
        updates["fuel_pct"] = payload.fuel_pct

    state_store.update_unit(unit_id, updates)

    # Handle on-scene paramedic severity upgrade
    if payload.triage_severity_upgrade is not None and unit.assigned_incident_id:
        inc = state_store.get_incident(unit.assigned_incident_id)
        if inc:
            new_sev = min(99.0, max(10.0, payload.triage_severity_upgrade))
            state_store.update_incident(inc.incident_id, {
                "severity_score": new_sev,
                "survival_decay_rate_per_min": round(inc.survival_decay_rate_per_min * 1.4, 2)
            })
            upgrade_log = {
                "decision_type": "PARAMEDIC_SEVERITY_UPGRADE",
                "unit_id": unit_id,
                "incident_id": inc.incident_id,
                "shap_feature_weights": {"paramedic_clinical_assessment": +35.0, "hemodynamic_deterioration": +20.0},
                "human_readable_reason": (
                    f"Paramedic crew on {unit.code or unit.unit_id} upgraded Incident {inc.incident_id} "
                    f"severity to {new_sev}/100 based on observed hemodynamic instability."
                ),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            record_xai_log(upgrade_log)

    # Handle on-scene paramedic casualty count update
    if payload.victims_count_update is not None and unit.assigned_incident_id:
        inc = state_store.get_incident(unit.assigned_incident_id)
        if inc:
            state_store.update_incident(inc.incident_id, {
                "victims_count": max(1, payload.victims_count_update)
            })
            record_xai_log({
                "decision_type": "PARAMEDIC_CASUALTY_UPDATE",
                "unit_id": unit_id,
                "incident_id": inc.incident_id,
                "shap_feature_weights": {"on_scene_triage_count": +25.0},
                "human_readable_reason": (
                    f"Paramedic crew on {unit.code or unit.unit_id} revised victim count "
                    f"to {payload.victims_count_update} casualties for Incident {inc.incident_id}."
                ),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

    # Trigger Global Optimization
    opt_res = optimizer.globally_optimize_allocations()
    for log_item in opt_res.xai_logs:
        record_xai_log(log_item)

    await broadcast_full_state("UNIT_STATUS_UPDATED", {
        "unit_id": unit_id,
        "optimization": opt_res.model_dump()
    })

    return {
        "status": "updated",
        "unit": state_store.get_unit(unit_id).model_dump(),
        "optimization_result": opt_res.model_dump()
    }


class HospitalUpdatePayload(BaseModel):
    icu_beds_available: Optional[int] = None
    er_beds_available: Optional[int] = None
    ventilators_available: Optional[int] = None
    general_beds_available: Optional[int] = None
    burn_beds_available: Optional[int] = None
    er_waiting_time_mins: Optional[int] = None
    has_cath_lab: Optional[bool] = None
    has_trauma_team: Optional[bool] = None
    accepting_emergencies: Optional[bool] = None


@app.post("/api/hospitals/{hospital_id}/update")
async def update_hospital_capacity_endpoint(hospital_id: str, payload: HospitalUpdatePayload):
    """
    Requirement 4: Updates hospital beds (icu_beds_available, er_beds_available, ventilators,
    burn_beds, er_waiting_time, cath_lab, trauma_team, accepting_emergencies).
    If ICU beds drop to 0 while an ambulance is heading there,
    automatically triggers immediate mid-route hospital reallocation and logs XAI explanation!
    """
    hosp = state_store.get_hospital(hospital_id)
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    updates: Dict[str, Any] = {}
    if payload.icu_beds_available is not None:
        updates["icu_beds_available"] = max(0, payload.icu_beds_available)
    if payload.er_beds_available is not None:
        updates["er_beds_available"] = max(0, payload.er_beds_available)
    if payload.ventilators_available is not None:
        updates["ventilators_available"] = max(0, payload.ventilators_available)
    if payload.general_beds_available is not None:
        updates["general_beds_available"] = max(0, payload.general_beds_available)
    if payload.burn_beds_available is not None:
        updates["burn_beds_available"] = max(0, payload.burn_beds_available)
    if payload.er_waiting_time_mins is not None:
        updates["er_waiting_time_mins"] = max(0, payload.er_waiting_time_mins)
    if payload.has_cath_lab is not None:
        updates["has_cath_lab"] = payload.has_cath_lab
    if payload.has_trauma_team is not None:
        updates["has_trauma_team"] = payload.has_trauma_team
    if payload.accepting_emergencies is not None:
        updates["accepting_emergencies"] = payload.accepting_emergencies

    state_store.update_hospital(hospital_id, updates)

    # Trigger Global Optimization (automatically detects Case C mid-route hospital diversions)
    opt_res = optimizer.globally_optimize_allocations()
    for log_item in opt_res.xai_logs:
        record_xai_log(log_item)

    await broadcast_full_state("HOSPITAL_CAPACITY_UPDATED", {
        "hospital_id": hospital_id,
        "optimization": opt_res.model_dump()
    })

    return {
        "status": "updated",
        "hospital": state_store.get_hospital(hospital_id).model_dump(),
        "optimization_result": opt_res.model_dump()
    }


class WeatherTrafficPayload(BaseModel):
    rainfall_mm_hr: Optional[float] = None
    condition: Optional[str] = None
    corridor_edge_ids: Optional[List[str]] = None
    congestion_index: Optional[float] = None
    waterlogging_depth_cm: Optional[float] = None


@app.post("/api/weather-traffic/update")
async def update_weather_and_traffic(payload: WeatherTrafficPayload):
    """
    Requirement 5: Injects heavy rainfall (rainfall_mm_hr) and traffic congestion
    on specific road corridors, updates GNN road edge weights, and dynamically
    reroutes all active ambulances onto faster routes with XAI explanations.
    """
    weather_updates: Dict[str, Any] = {}
    if payload.rainfall_mm_hr is not None:
        weather_updates["rainfall_mm_hr"] = payload.rainfall_mm_hr
        weather_updates["flood_alert_level"] = "RED" if payload.rainfall_mm_hr >= 50.0 else ("YELLOW" if payload.rainfall_mm_hr >= 20.0 else "GREEN")
    if payload.condition:
        weather_updates["condition"] = payload.condition

    if weather_updates:
        state_store.update_weather_state(weather_updates)

    # Update edge weights and waterlogging on specified corridors
    if payload.corridor_edge_ids:
        for eid in payload.corridor_edge_ids:
            edge_updates: Dict[str, Any] = {}
            if payload.congestion_index is not None:
                edge_updates["congestion_index"] = min(1.0, max(0.0, payload.congestion_index))
                edge_updates["live_traffic_speed_kmph"] = max(5.0, 50.0 * (1.0 - payload.congestion_index * 0.8))
            if payload.waterlogging_depth_cm is not None:
                edge_updates["waterlogging_depth_cm"] = payload.waterlogging_depth_cm
                edge_updates["is_flooded_closed"] = payload.waterlogging_depth_cm >= 30.0
            state_store.update_road_edge(eid, edge_updates)

    # Recalculate GNN routes for all active ambulances
    road_graph = state_store.get_road_graph()
    weather = state_store.get_weather_state()

    rerouted_units = []
    for u in state_store.get_units():
        if u.operational_status in (OperationalStatus.EN_ROUTE_TO_INCIDENT, OperationalStatus.TRANSPORTING_TO_HOSPITAL):
            dest_lat, dest_lng = u.lat, u.lng
            if u.operational_status == OperationalStatus.EN_ROUTE_TO_INCIDENT and u.assigned_incident_id:
                inc = state_store.get_incident(u.assigned_incident_id)
                if inc:
                    dest_lat, dest_lng = inc.lat, inc.lng
            elif u.operational_status == OperationalStatus.TRANSPORTING_TO_HOSPITAL and u.target_hospital_id:
                hosp = state_store.get_hospital(u.target_hospital_id)
                if hosp:
                    dest_lat, dest_lng = hosp.lat, hosp.lng

            new_route = compute_gnn_route_and_eta(road_graph, u.lat, u.lng, dest_lat, dest_lng, u.unit_type, weather)
            state_store.update_unit(u.unit_id, {
                "current_route": new_route["route_coordinates"]
            })
            rerouted_units.append({
                "unit_id": u.unit_id,
                "new_eta_mins": new_route["estimated_time_mins"],
                "avoided_floods": new_route.get("rerouted_around_floods", False)
            })

            # Record XAI route adaptation log
            record_xai_log({
                "decision_type": "WEATHER_TRAFFIC_REROUTE",
                "unit_id": u.unit_id,
                "shap_feature_weights": {
                    "monsoon_rain_intensity_mm_hr": payload.rainfall_mm_hr or 15.0,
                    "waterlogging_avoided": 30.0 if new_route.get("rerouted_around_floods") else 10.0,
                    "time_saved_alternative_mins": 4.5
                },
                "human_readable_reason": (
                    f"GNN Router adapted Unit {u.code or u.unit_id} path due to {weather.condition} "
                    f"({payload.rainfall_mm_hr or 0} mm/hr). Bypassed congested waterlogged segments; ETA: {new_route['estimated_time_mins']} mins."
                ),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

    await broadcast_full_state("WEATHER_TRAFFIC_UPDATED", {
        "rerouted_units": rerouted_units
    })

    return {
        "status": "updated",
        "weather": state_store.get_weather_state().model_dump(),
        "rerouted_units": rerouted_units
    }


# ==============================================================================
# 6. THE "10:30 AM TRICKY SCENARIO" SIMULATOR ENDPOINTS
# ==============================================================================

@app.post("/api/simulator/trigger-1030-surge")
async def trigger_1030_am_surge():
    """
    Problem Statement 10:30 AM Peak Rush-Hour Simultaneous Surge Injection.
    Simultaneously injects:
    - Incident A: Road accident involving 5 people on Gachibowli Junction.
    - Incident B: Cardiac emergency requiring immediate transport & ICU in Madhapur.
    - Incident C: Urban flooding incident trapping passengers in low-lying Kukatpally underpass.
    Runs global AI prioritization and dynamic allocation across all three simultaneously.
    """
    now = datetime.now(timezone.utc)

    # 1. Incident A: Road Accident (5 Victims) on Gachibowli Junction
    inc_a = Incident(
        incident_id="INC-1030-A",
        timestamp=now,
        caller_phone="+91 98480-10301",
        caller_type=CallerType.BYSTANDER,
        raw_audio_transcript="Major pileup collision near Gachibowli flyover! Multi-vehicle crash, 5 persons severely injured, two unconscious and trapped in crushed car!",
        raw_text_description="Major pileup collision near Gachibowli flyover, 5 victims injured, 2 critical unconscious, heavy vehicular cabin deformation.",
        lat=17.4400,
        lng=78.3500,
        address="Gachibowli Flyover Junction, Outer Ring Rd Link, Hyderabad",
        emergency_type=EmergencyType.ROAD_ACCIDENT,
        victims_count=5,
        critical_victims_count=2,
        trapped_status=True,
        fire_smoke_detected=False,
        water_depth_cm=0.0,
        vehicle_deformation_score=0.88,
        hazmat_leak=False,
        severity_score=92.0,
        survival_decay_rate_per_min=3.8,
        priority_rank=1,
        required_resources={
            "primary_unit_type": UnitType.ALS_AMBULANCE.value,
            "secondary_unit_type": UnitType.FIRE_TENDER.value,
            "hospital_requirements": {"needs_icu": True, "needs_trauma_team": True}
        },
        status=IncidentStatus.REPORTED,
        triage={"severity_level": "CRITICAL", "severity_percentage": 92, "emergency_type": "ROAD_ACCIDENT", "victims_count": 5}
    )

    # 2. Incident B: Cardiac Emergency in Madhapur (Cyber Towers)
    inc_b = Incident(
        incident_id="INC-1030-B",
        timestamp=now,
        caller_phone="+91 98480-10302",
        caller_type=CallerType.VICTIM,
        raw_audio_transcript="Help! Colleague collapsed with severe chest clutching near Madhapur Cyber Towers! Gasping for breath, no pulse felt!",
        raw_text_description="54-year-old male sudden cardiac arrest near Madhapur Cyber Towers, unconscious, gasping, immediate CPR & biphasic defibrillator required.",
        lat=17.4480,
        lng=78.3780,
        address="Cyber Towers Quad, Madhapur IT Corridor, Hyderabad",
        emergency_type=EmergencyType.CARDIAC_ARREST,
        victims_count=1,
        critical_victims_count=1,
        trapped_status=False,
        fire_smoke_detected=False,
        water_depth_cm=0.0,
        vehicle_deformation_score=0.0,
        hazmat_leak=False,
        severity_score=97.0,
        survival_decay_rate_per_min=5.2,
        priority_rank=1,
        required_resources={
            "primary_unit_type": UnitType.ALS_AMBULANCE.value,
            "equipment_needed": {"has_defibrillator": True, "has_ventilator": True},
            "hospital_requirements": {"needs_icu": True, "needs_cath_lab": True}
        },
        status=IncidentStatus.REPORTED,
        triage={"severity_level": "CRITICAL", "severity_percentage": 97, "emergency_type": "CARDIAC_ARREST", "victims_count": 1}
    )

    # 3. Incident C: Urban Flooding in Kukatpally / Hitech Underpass
    inc_c = Incident(
        incident_id="INC-1030-C",
        timestamp=now,
        caller_phone="+91 98480-10303",
        caller_type=CallerType.IOT_SENSOR,
        raw_audio_transcript="Automated IoT water level alert: Kukatpally low-line underpass flooded to 85cm. Auto-rickshaw with 4 passengers stalled and submerged.",
        raw_text_description="Monsoon storm drain overflow under Kukatpally Metro Pillar 780, water depth 85cm, 4 passengers trapped in stalled submerged vehicle.",
        lat=17.4947,
        lng=78.3996,
        address="Kukatpally Y Junction Lowline Underpass, Hyderabad",
        emergency_type=EmergencyType.URBAN_FLOODING,
        victims_count=4,
        critical_victims_count=0,
        trapped_status=True,
        fire_smoke_detected=False,
        water_depth_cm=85.0,
        vehicle_deformation_score=0.0,
        hazmat_leak=False,
        severity_score=78.0,
        survival_decay_rate_per_min=1.8,
        priority_rank=2,
        required_resources={
            "primary_unit_type": UnitType.FLOOD_RESCUE_BOAT.value,
            "secondary_unit_type": UnitType.BLS_AMBULANCE.value,
            "hospital_requirements": {"needs_icu": False, "needs_er_beds": True}
        },
        status=IncidentStatus.REPORTED,
        triage={"severity_level": "ELEVATED", "severity_percentage": 78, "emergency_type": "URBAN_FLOODING", "victims_count": 4}
    )

    # Ingest into state store
    state_store.add_incident(inc_a)
    state_store.add_incident(inc_b)
    state_store.add_incident(inc_c)

    # Run Global Dynamic Optimization across all three simultaneously
    opt_res = optimizer.globally_optimize_allocations()
    for log_item in opt_res.xai_logs:
        record_xai_log(log_item)

    await broadcast_full_state("SCENARIO_1030_SURGE_TRIGGERED", {
        "injected_incidents": ["INC-1030-A", "INC-1030-B", "INC-1030-C"],
        "optimization": opt_res.model_dump()
    })

    return {
        "status": "surge_triggered",
        "incidents": [inc_a.model_dump(), inc_b.model_dump(), inc_c.model_dump()],
        "optimization_result": opt_res.model_dump()
    }


@app.post("/api/simulator/disruption-1-ambulance-breakdown")
async def trigger_disruption_1_breakdown():
    """
    Disruption 1: Nearest / assigned ambulance to Incident A (AMB-101) suddenly
    suffers a mechanical breakdown (UNAVAILABLE_BREAKDOWN). The optimizer immediately
    detects the orphaned incident and executes Case B failover, reassigning a backup unit.
    """
    inc_a = state_store.get_incident("INC-1030-A")
    target_unit_id = "AMB-101"
    if inc_a and inc_a.assigned_unit_ids:
        target_unit_id = inc_a.assigned_unit_ids[0]

    state_store.update_unit(target_unit_id, {
        "operational_status": OperationalStatus.UNAVAILABLE_BREAKDOWN,
        "speed_kmph": 0.0,
        "can_be_preempted": False
    })

    opt_res = optimizer.globally_optimize_allocations()
    for log_item in opt_res.xai_logs:
        record_xai_log(log_item)

    await broadcast_full_state("DISRUPTION_1_BREAKDOWN_TRIGGERED", {
        "broken_unit_id": target_unit_id,
        "optimization": opt_res.model_dump()
    })

    return {
        "status": "disruption_1_executed",
        "broken_unit_id": target_unit_id,
        "optimization_result": opt_res.model_dump()
    }


@app.post("/api/simulator/disruption-2-hospital-icu-full")
async def trigger_disruption_2_hospital_saturation():
    """
    Disruption 2: The hospital selected for Incident B (Cardiac emergency)
    suddenly reports 0 available ICU beds (100% saturation). The optimizer
    executes Case C mid-route hospital diversion, dynamically rerouting the ambulance
    from its current GPS coordinates to an available Level-1 trauma/cardiac facility.
    """
    inc_b = state_store.get_incident("INC-1030-B")
    target_hospital_id = "hosp-1"  # Default to Care Hospital
    if inc_b and inc_b.assigned_hospital_id:
        target_hospital_id = inc_b.assigned_hospital_id

    # Drop target hospital ICU beds to 0
    state_store.update_hospital(target_hospital_id, {
        "icu_beds_available": 0
    })

    opt_res = optimizer.globally_optimize_allocations()
    for log_item in opt_res.xai_logs:
        record_xai_log(log_item)

    await broadcast_full_state("DISRUPTION_2_HOSPITAL_FULL_TRIGGERED", {
        "saturated_hospital_id": target_hospital_id,
        "optimization": opt_res.model_dump()
    })

    return {
        "status": "disruption_2_executed",
        "saturated_hospital_id": target_hospital_id,
        "optimization_result": opt_res.model_dump()
    }


@app.post("/api/simulator/disruption-3-heavy-rain-traffic")
async def trigger_disruption_3_rain_gridlock():
    """
    Disruption 3: Injects severe 85 mm/hr cloudburst rainfall and heavy congestion
    on arterial roads, causing waterlogging on the shortest route and forcing the GNN
    router to dynamically recalculate and route active ambulances along alternative corridors.
    """
    state_store.update_weather_state({
        "rainfall_mm_hr": 85.0,
        "condition": "SEVERE MONSOON CLOUDBURST (2.2x DELAY)",
        "flood_alert_level": "RED"
    })

    # Close lowline flooded corridor
    state_store.update_road_edge("EDGE-MADHAPUR-KUKATPALLY", {
        "waterlogging_depth_cm": 48.0,
        "is_flooded_closed": True,
        "congestion_index": 0.95,
        "live_traffic_speed_kmph": 8.0
    })
    state_store.update_road_edge("EDGE-GACHI-MINDSPACE", {
        "congestion_index": 0.85,
        "live_traffic_speed_kmph": 12.0
    })

    # Reroute active ambulances
    road_graph = state_store.get_road_graph()
    weather = state_store.get_weather_state()

    rerouted = []
    for u in state_store.get_units():
        if u.operational_status in (OperationalStatus.EN_ROUTE_TO_INCIDENT, OperationalStatus.TRANSPORTING_TO_HOSPITAL):
            dest_lat, dest_lng = 17.4320, 78.4070  # Jubilee Hills hub
            if u.assigned_incident_id:
                inc = state_store.get_incident(u.assigned_incident_id)
                if inc:
                    dest_lat, dest_lng = inc.lat, inc.lng

            route_calc = compute_gnn_route_and_eta(road_graph, u.lat, u.lng, dest_lat, dest_lng, u.unit_type, weather)
            state_store.update_unit(u.unit_id, {
                "current_route": route_calc["route_coordinates"]
            })
            rerouted.append({"unit_id": u.unit_id, "route": route_calc})

    record_xai_log({
        "decision_type": "DISRUPTION_3_GNN_REROUTING",
        "shap_feature_weights": {"precipitation_rate_85mm": +48.0, "road_flood_closure_avoidance": +35.0},
        "human_readable_reason": (
            "Disruption 3 Injected: 85 mm/hr cloudburst closed Kukatpally lowline. "
            "GNN Router adapted all active ambulance corridors onto elevated highway links."
        ),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    await broadcast_full_state("DISRUPTION_3_RAIN_GRIDLOCK_TRIGGERED", {
        "rainfall_mm_hr": 85.0,
        "rerouted_count": len(rerouted)
    })

    return {
        "status": "disruption_3_executed",
        "rainfall_mm_hr": 85.0,
        "rerouted_units": rerouted
    }


@app.post("/api/simulator/disruption-4-competing-incident-d")
async def trigger_disruption_4_preemption():
    """
    Disruption 4: Injects a catastrophic high-priority emergency (Incident D: Severe Fire
    and Polytrauma) when all resources are already allocated. Demonstrates Case D
    Dynamic Fleet Preemption by reassigning an en-route unit and dispatching backup.
    """
    now = datetime.now(timezone.utc)
    inc_d = Incident(
        incident_id="INC-1030-D",
        timestamp=now,
        caller_phone="+91 98480-10304",
        caller_type=CallerType.OPERATOR_108,
        raw_audio_transcript="Code Red! High-rise commercial fire explosion at Jubilee Hills Road 36! 3 casualties with third-degree burns and severe trauma!",
        raw_text_description="Code Red: High-rise commercial fire explosion at Jubilee Hills Road 36, 3 casualties with severe burn trauma, immediate ICU required.",
        lat=17.4350,
        lng=78.4080,
        address="Jubilee Hills Road 36, Near Peddamma Temple, Hyderabad",
        emergency_type=EmergencyType.FIRE,
        victims_count=3,
        critical_victims_count=2,
        trapped_status=True,
        fire_smoke_detected=True,
        water_depth_cm=0.0,
        vehicle_deformation_score=0.0,
        hazmat_leak=True,
        severity_score=98.0,
        survival_decay_rate_per_min=5.5,
        priority_rank=1,
        required_resources={
            "primary_unit_type": UnitType.ALS_AMBULANCE.value,
            "secondary_unit_type": UnitType.FIRE_TENDER.value,
            "hospital_requirements": {"needs_icu": True, "needs_burn_icu": True}
        },
        status=IncidentStatus.REPORTED,
        triage={"severity_level": "CRITICAL", "severity_percentage": 98, "emergency_type": "FIRE", "victims_count": 3}
    )

    state_store.add_incident(inc_d)

    # Global optimization executes Case D preemption
    opt_res = optimizer.globally_optimize_allocations()
    for log_item in opt_res.xai_logs:
        record_xai_log(log_item)

    await broadcast_full_state("DISRUPTION_4_PREEMPTION_TRIGGERED", {
        "incident_id": "INC-1030-D",
        "optimization": opt_res.model_dump()
    })

    return {
        "status": "disruption_4_executed",
        "incident_d": inc_d.model_dump(),
        "optimization_result": opt_res.model_dump()
    }


@app.post("/api/simulator/reset")
async def reset_simulator_state():
    """
    Resets the simulation to the initial clean baseline state
    and broadcasts the reset state via WebSocket.
    """
    global xai_audit_logs
    state_store.reset_state()
    xai_audit_logs.clear()

    await broadcast_full_state("SIMULATION_RESET")
    return {"status": "Simulator state successfully reset to baseline"}


# Backwards-compatible reset endpoint
@app.post("/api/reset")
async def reset_demo_backward_compatible():
    return await reset_simulator_state()


# Backwards-compatible hospital update endpoint
@app.post("/api/hospitals/update-capacity")
async def update_capacity_backward_compatible(req: HospitalUpdatePayload):
    hosp_id = getattr(req, "hospital_id", "hosp-1")
    return await update_hospital_capacity_endpoint(hosp_id, req)


# Backwards-compatible toggle-traffic endpoint
@app.post("/api/toggle-traffic")
async def toggle_traffic_backward_compatible():
    weather = state_store.get_weather_state()
    heavy = weather.rainfall_mm_hr > 15.0 or weather.condition.startswith("SEVERE")
    payload = WeatherTrafficPayload(
        rainfall_mm_hr=5.0 if heavy else 40.0,
        condition="NORMAL FLOW (1.0x)" if heavy else "SEVERE MONSOON GRIDLOCK (1.8x DELAY)"
    )
    res = await update_weather_and_traffic(payload)
    return {
        "status": "updated",
        "traffic": {
            "heavy_traffic": not heavy,
            "multiplier": 1.0 if heavy else 1.8,
            "condition": res["weather"]["condition"]
        }
    }


# Backwards-compatible routes
@app.get("/api/spatial/schema")
def get_spatial_schema():
    return {
        "engine": "PostgreSQL 16+ / PostGIS 3.4+",
        "srid": 4326,
        "ddl_script": generate_postgis_ddl()
    }


@app.get("/api/routes/shortest")
def get_shortest_route(
    start_lat: float = Query(...),
    start_lng: float = Query(...),
    end_lat: float = Query(...),
    end_lng: float = Query(...),
    unit_type: str = Query("ALS_AMBULANCE")
):
    road_graph = state_store.get_road_graph()
    weather = state_store.get_weather_state()
    try:
        u_type = UnitType(unit_type)
    except Exception:
        u_type = UnitType.ALS_AMBULANCE
    return compute_gnn_route_and_eta(road_graph, start_lat, start_lng, end_lat, end_lng, u_type, weather)


@app.get("/api/forecast")
def get_demand_forecast(hour: Optional[int] = Query(None)):
    hospitals = state_store.get_hospitals()
    weather = state_store.get_weather_state()
    return forecast_hospital_and_zone_demand(hospitals, weather, current_hour=hour)


@app.post("/api/optimize")
async def run_global_optimization():
    res = optimizer.globally_optimize_allocations()
    for log_item in res.xai_logs:
        record_xai_log(log_item)
    await broadcast_full_state("GLOBAL_OPTIMIZATION_TRIGGERED", {"optimization": res.model_dump()})
    return res.model_dump()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
