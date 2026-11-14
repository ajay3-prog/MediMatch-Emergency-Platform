"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  HeartPulse,
  Info,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { EmergencyUnit, Hospital, Incident, RoadEdge, XAIDecisionLog } from "../hooks/useRealtimeState";
import LiveMap from "./LiveMap";

interface CommandCentreProps {
  incidents: Incident[];
  units: EmergencyUnit[];
  hospitals: Hospital[];
  roadEdges: RoadEdge[];
  xaiAuditLogs: XAIDecisionLog[];
  onApproveRecommendation: (incidentId: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export default function CommandCentre({
  incidents = [],
  units = [],
  hospitals = [],
  roadEdges = [],
  xaiAuditLogs = [],
  onApproveRecommendation,
  onNavigateToTab,
}: CommandCentreProps) {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    incidents[0]?.incident_id || "INC-2026-101"
  );
  const [showAlternativesModal, setShowAlternativesModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedIncident =
    incidents.find((i) => i.incident_id === selectedIncidentId) || incidents[0];

  // Key KPI Aggregations
  const totalActiveIncidents = incidents.filter((i) => i.status !== "RESOLVED").length;
  const criticalIncidents = incidents.filter(
    (i) => i.status !== "RESOLVED" && (i.priority_rank === 1 || i.severity_score >= 85)
  ).length;
  const availableAmbulances = units.filter(
    (u) => u.operational_status === "IDLE" && u.unit_type.includes("AMBULANCE")
  ).length;
  const deployedResources = units.filter(
    (u) =>
      u.operational_status === "EN_ROUTE_TO_INCIDENT" ||
      u.operational_status === "TRANSPORTING_TO_HOSPITAL" ||
      u.operational_status === "ON_SCENE"
  ).length;
  const totalIcuBeds = hospitals.reduce((acc, h) => acc + (h.icu_beds_available || 0), 0);
  const resourceConflicts = incidents.filter((i) => i.rerouted).length;

  const handleApprove = (incidentId: string) => {
    onApproveRecommendation(incidentId);
    setToastMessage(`Recommendation Approved: Unit successfully dispatched to ${incidentId}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[2000] bg-[#173B65] text-white px-4 py-3 rounded-lg shadow-lg border border-[#2563EB] flex items-center gap-2.5 text-xs font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================================
          TOP ROW: 6 COMPACT OPERATIONAL KPI CARDS
         ====================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Active Emergencies */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Active Emergencies</span>
            <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#0F172A] tracking-tight">{totalActiveIncidents}</span>
            <span className="text-[11px] text-[#64748B] block mt-0.5 font-medium">+1 in last 30 mins</span>
          </div>
        </div>

        {/* 2. Critical Emergencies */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Critical P1 Urgency</span>
            <div className="w-7 h-7 rounded-lg bg-[#FEE2E2] flex items-center justify-center text-[#DC2626]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#DC2626] tracking-tight">{criticalIncidents}</span>
            <span className="text-[11px] text-[#DC2626] block mt-0.5 font-medium">Survival decay active</span>
          </div>
        </div>

        {/* 3. Available Ambulances */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Available Ambulances</span>
            <div className="w-7 h-7 rounded-lg bg-[#DCFCE7] flex items-center justify-center text-[#16A34A]">
              <Ambulance className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#16A34A] tracking-tight">{availableAmbulances}</span>
            <span className="text-[11px] text-[#64748B] block mt-0.5 font-medium">Out of 6 fleet units</span>
          </div>
        </div>

        {/* 4. Deployed Resources */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Deployed Resources</span>
            <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
              <Navigation className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#2563EB] tracking-tight">{deployedResources}</span>
            <span className="text-[11px] text-[#64748B] block mt-0.5 font-medium">En route / on scene</span>
          </div>
        </div>

        {/* 5. Available ICU Beds */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Available ICU Beds</span>
            <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#9333EA]">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#9333EA] tracking-tight">{totalIcuBeds}</span>
            <span className="text-[11px] text-[#64748B] block mt-0.5 font-medium">Across 6 hospitals</span>
          </div>
        </div>

        {/* 6. Resource Conflicts */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Resource Conflicts</span>
            <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-[#F97316]">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#F97316] tracking-tight">{resourceConflicts}</span>
            <span className="text-[11px] text-[#16A34A] block mt-0.5 font-medium">AI auto-mitigated</span>
          </div>
        </div>
      </div>

      {/* ======================================================================
          MAIN SECTION: 2-COLUMN LAYOUT (MAP + AI RESOURCE ALLOCATION PANEL)
         ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Incident Map (7 Cols) */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
              <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">
                Live Hyderabad Operational Map
              </h2>
            </div>
            <span className="text-xs text-[#64748B]">Real-time GPS • Telematics 1.5s</span>
          </div>

          <LiveMap
            incidents={incidents}
            units={units}
            hospitals={hospitals}
            roadEdges={roadEdges}
            height="460px"
            onSelectIncident={(inc) => setSelectedIncidentId(inc.incident_id)}
          />
        </div>

        {/* Right Column: AI Resource Allocation Engine Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] animate-pulse" />
                  <h3 className="text-sm font-bold text-[#173B65]">
                    AI Resource Allocation Engine
                  </h3>
                </div>
                <span className="text-[11px] text-[#64748B]">
                  GNN Multi-Modal Urgency & Route Optimizer
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                ENGINE ACTIVE
              </span>
            </div>

            {/* Conflict Warning Banner */}
            <div className="p-2.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F97316] shrink-0 mt-0.5" />
              <div className="leading-snug text-[11px]">
                <strong className="block text-[#78350F]">Multi-Incident Urgency Arbitrated:</strong>
                Priority given to acute cardiac arrest over minor collision based on survival decay curve.
              </div>
            </div>

            {/* Selected Incident Telemetry Summary */}
            {selectedIncident ? (
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#DC2626]">{selectedIncident.incident_id}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DC2626] text-white">
                    Severity: {Math.round(selectedIncident.severity_score)}/100
                  </span>
                </div>
                <div className="text-xs font-semibold text-[#0F172A]">{selectedIncident.address}</div>
                <p className="text-[11px] text-[#64748B] line-clamp-2">{selectedIncident.raw_text_description}</p>
              </div>
            ) : null}

            {/* Recommended Allocations Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-white border border-[#E2E8F0] rounded-lg shadow-2xs">
                <span className="text-[10px] text-[#64748B] font-semibold block uppercase">
                  Recommended Unit
                </span>
                <span className="text-xs font-bold text-[#2563EB] block mt-0.5">
                  {selectedIncident?.assigned_unit_ids?.join(", ") || "AMB-101 (ALS Mobile ICU)"}
                </span>
                <span className="text-[10px] text-[#16A34A] font-medium block mt-0.5">
                  ETA to Scene: {selectedIncident?.eta_to_scene_mins || 3.2} mins
                </span>
              </div>

              <div className="p-2.5 bg-white border border-[#E2E8F0] rounded-lg shadow-2xs">
                <span className="text-[10px] text-[#64748B] font-semibold block uppercase">
                  Recommended Hospital
                </span>
                <span className="text-xs font-bold text-[#9333EA] block mt-0.5 truncate">
                  {selectedIncident?.assigned_hospital?.name || "AIG Hospitals Gachibowli"}
                </span>
                <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">
                  3 Vacant ICU Beds • Verified
                </span>
              </div>
            </div>

            {/* Explainable AI (XAI) Justification Box */}
            <div className="p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#173B65]">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Explainable AI Allocation Rationale:</span>
              </div>
              <p className="text-[11px] text-[#1E3A8A] leading-relaxed">
                {selectedIncident?.why_this_ambulance ||
                  selectedIncident?.why_this_hospital ||
                  "Selected closest Advanced Life Support (ALS) unit equipped with biphasic defibrillator and ventilator. Optimal GNN routing avoids flood-inundated corridors."}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center gap-2">
            <button
              onClick={() => handleApprove(selectedIncident?.incident_id || "INC-2026-101")}
              className="flex-1 py-2.5 rounded-lg bg-[#173B65] hover:bg-[#1E4A7E] text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
              <span>Approve Recommendation</span>
            </button>
            <button
              onClick={() => setShowAlternativesModal(true)}
              className="px-3.5 py-2.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#0F172A] font-semibold text-xs transition shadow-2xs"
            >
              View Alternatives
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ACTIVE EMERGENCY QUEUE TABLE
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0F172A]">Active Emergency Queue</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F1F5F9] text-[#64748B]">
              {incidents.length} Records
            </span>
          </div>
          <button
            onClick={() => onNavigateToTab("incidents")}
            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1"
          >
            <span>View All Incidents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Incident ID</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Priority / Severity</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Affected</th>
                <th className="py-2.5 px-4">Resources Req.</th>
                <th className="py-2.5 px-4">Assigned Units</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Reported Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
              {incidents.map((inc) => {
                const isSelected = inc.incident_id === selectedIncidentId;
                const isP1 = inc.priority_rank === 1 || inc.severity_score >= 85;

                return (
                  <tr
                    key={inc.incident_id}
                    onClick={() => setSelectedIncidentId(inc.incident_id)}
                    className={`cursor-pointer transition hover:bg-[#F8FAFC] ${
                      isSelected ? "bg-[#EFF6FF]/60 font-semibold" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-[#173B65]">{inc.incident_id}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F1F5F9] text-[#334155]">
                        {inc.emergency_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isP1 ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-[#FFEDD5] text-[#C2410C]"
                        }`}
                      >
                        P{inc.priority_rank} ({Math.round(inc.severity_score)}/100)
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[180px] truncate">{inc.address}</td>
                    <td className="py-3 px-4">{inc.victims_count} Victims</td>
                    <td className="py-3 px-4 text-[#64748B]">ALS Ambulance + ICU</td>
                    <td className="py-3 px-4 font-semibold text-[#2563EB]">
                      {inc.assigned_unit_ids?.join(", ") || "Awaiting Dispatch"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#166534]">
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#64748B]">10:30:15 IST</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          BOTTOM SECTION: RESOURCE STATUS BARS & RECENT ACTIVITY FEED
         ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Resource Status Summary Bars */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
              Fleet Operational Readiness Breakdown
            </h3>
            <span className="text-xs text-[#64748B]">10 Registered Units</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* ALS Ambulances */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span>Advanced Life Support (ALS Mobile ICUs)</span>
                <span className="font-bold text-[#0F172A]">2 Available / 4 Deployed (33% Free)</span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                <div className="bg-[#2563EB] h-full rounded-full" style={{ width: "33%" }} />
              </div>
            </div>

            {/* BLS Ambulances */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span>Basic Life Support (BLS Standard Ambulances)</span>
                <span className="font-bold text-[#0F172A]">3 Available / 4 Deployed (75% Free)</span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                <div className="bg-[#16A34A] h-full rounded-full" style={{ width: "75%" }} />
              </div>
            </div>

            {/* Fire Tenders */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span>Emergency Fire Tenders & Rescue Trucks</span>
                <span className="font-bold text-[#0F172A]">2 Available / 2 Total (100% Ready)</span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                <div className="bg-[#F97316] h-full rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            {/* Flood Rescue Boats */}
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span>Urban Flood Inundation Rescue Boats</span>
                <span className="font-bold text-[#0F172A]">1 Deployed / 2 Total (50% Active)</span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                <div className="bg-[#0284C7] h-full rounded-full" style={{ width: "50%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Recent Operational Activity Feed */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
              Recent Operational Activity & XAI Audits
            </h3>
            <span className="text-xs text-[#2563EB] font-semibold">Live Event Log</span>
          </div>

          <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
            {xaiAuditLogs.slice(0, 5).map((log, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB]">
                    {log.decision_type}
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    {new Date(log.timestamp).toLocaleTimeString()} IST
                  </span>
                </div>
                <p className="text-[11px] text-[#334155] leading-snug">{log.human_readable_reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================================
          ALTERNATIVES MODAL
         ====================================================================== */}
      {showAlternativesModal && (
        <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] max-w-lg w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#173B65]">Ranked Alternative Options</h3>
                <span className="text-xs text-[#64748B]">Incident: {selectedIncident?.incident_id}</span>
              </div>
              <button
                onClick={() => setShowAlternativesModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="font-semibold text-[#0F172A]">Alternative Ambulances:</div>
              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <strong className="text-[#2563EB] block">AMB-102 (ALS Ambulance)</strong>
                  <span className="text-[11px] text-[#64748B]">Distance: 3.4 km • ETA: 4.8 mins</span>
                </div>
                <span className="px-2 py-1 rounded bg-[#DCFCE7] text-[#166534] font-bold text-[10px]">
                  Rank #2 (Score 91.2)
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <strong className="text-[#2563EB] block">AMB-104 (ALS Ambulance)</strong>
                  <span className="text-[11px] text-[#64748B]">Distance: 4.8 km • ETA: 6.2 mins</span>
                </div>
                <span className="px-2 py-1 rounded bg-[#FEF3C7] text-[#92400E] font-bold text-[10px]">
                  Rank #3 (Score 84.5)
                </span>
              </div>

              <div className="font-semibold text-[#0F172A] pt-2">Alternative Hospitals:</div>
              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center">
                <div>
                  <strong className="text-[#9333EA] block">CARE Hospitals Banjara Hills</strong>
                  <span className="text-[11px] text-[#64748B]">ICU Beds: 2 Available • ETA: 8.5 mins</span>
                </div>
                <span className="px-2 py-1 rounded bg-[#DCFCE7] text-[#166534] font-bold text-[10px]">
                  Cath Lab Ready
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end">
              <button
                onClick={() => setShowAlternativesModal(false)}
                className="px-4 py-2 bg-[#173B65] text-white rounded-lg font-semibold text-xs"
              >
                Close Alternatives
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
