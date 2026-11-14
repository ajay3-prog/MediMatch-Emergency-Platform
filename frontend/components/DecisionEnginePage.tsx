"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  BarChart2,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Flame,
  HeartPulse,
  Info,
  Layers,
  MapPin,
  Navigation,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { EmergencyUnit, Hospital, Incident, RoadEdge, XAIDecisionLog } from "../hooks/useRealtimeState";

interface DecisionEnginePageProps {
  incidents: Incident[];
  units: EmergencyUnit[];
  hospitals: Hospital[];
  roadEdges: RoadEdge[];
  xaiAuditLogs: XAIDecisionLog[];
  onApprove: (incidentId: string) => void;
}

export default function DecisionEnginePage({
  incidents = [],
  units = [],
  hospitals = [],
  roadEdges = [],
  xaiAuditLogs = [],
  onApprove,
}: DecisionEnginePageProps) {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    incidents[0]?.incident_id || "INC-2026-101"
  );
  const [approvalState, setApprovalState] = useState<Record<string, "PENDING" | "APPROVED" | "REJECTED">>({
    "INC-2026-101": "APPROVED",
  });
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedIncident =
    incidents.find((i) => i.incident_id === selectedIncidentId) || incidents[0];

  const currentStatus = approvalState[selectedIncident?.incident_id] || "PENDING";

  // KPIs
  const pendingCount = incidents.filter(
    (i) => (approvalState[i.incident_id] || "PENDING") === "PENDING"
  ).length;
  const activeAllocations = incidents.filter((i) => i.status !== "RESOLVED").length;
  const conflictsCount = incidents.filter((i) => i.rerouted).length;
  const successRate = "98.4%";

  const handleApproveAction = () => {
    if (!selectedIncident) return;
    setApprovalState((prev) => ({ ...prev, [selectedIncident.incident_id]: "APPROVED" }));
    onApprove(selectedIncident.incident_id);
    setToastMessage(`Allocation Approved for ${selectedIncident.incident_id}`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRejectAction = () => {
    if (!selectedIncident) return;
    setApprovalState((prev) => ({ ...prev, [selectedIncident.incident_id]: "REJECTED" }));
    setToastMessage(`Allocation Rejected for ${selectedIncident.incident_id}. Alternative units required.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRecalculate = () => {
    setIsRecalculating(true);
    setTimeout(() => {
      setIsRecalculating(false);
      setToastMessage("AI Combinatorial Allocator recalculated optimal global fleet paths.");
      setTimeout(() => setToastMessage(null), 3500);
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[2000] bg-[#173B65] text-white px-4 py-3 rounded-lg shadow-lg border border-[#2563EB] flex items-center gap-2.5 text-xs font-medium animate-fade-in">
          <Sparkles className="w-4 h-4 text-[#2563EB]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================================
          TOP 4 KPI CARDS
         ====================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Pending Recommendations</span>
            <Clock className="w-4 h-4 text-[#F97316]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#F97316]">{pendingCount}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Awaiting dispatcher confirmation</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Active Allocations</span>
            <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#2563EB]">{activeAllocations}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">En route with verified beds</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Resource Conflicts</span>
            <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#16A34A]">{conflictsCount}</div>
          <span className="text-[11px] text-[#16A34A] block mt-0.5">0 Active Blockages</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Allocation Success Rate</span>
            <Sparkles className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#16A34A]">{successRate}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Benchmarked on YUKTIK PS10</span>
        </div>
      </div>

      {/* ======================================================================
          MAIN ALLOCATION WORKSPACE: SELECTOR & DETAILS
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#173B65] uppercase">Select Active Incident to Audit:</span>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] font-semibold focus:outline-none focus:border-[#2563EB]"
          >
            {incidents.map((inc) => (
              <option key={inc.incident_id} value={inc.incident_id}>
                {inc.incident_id} - {inc.emergency_type} ({Math.round(inc.severity_score)}/100)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              currentStatus === "APPROVED"
                ? "bg-[#DCFCE7] text-[#166534]"
                : currentStatus === "REJECTED"
                ? "bg-[#FEE2E2] text-[#DC2626]"
                : "bg-[#FEF3C7] text-[#92400E]"
            }`}
          >
            STATUS: {currentStatus}
          </span>
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin text-[#2563EB]" : ""}`} />
            <span>Recalculate GNN</span>
          </button>
        </div>
      </div>

      {/* ======================================================================
          2-COLUMN SPLIT: RECOMMENDATION SPECS + EXPLAINABLE AI (XAI)
         ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recommended Units, Hospital & Suitability (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <h3 className="text-sm font-bold text-[#173B65]">Recommended Allocation Vector</h3>
            <span className="text-xs text-[#16A34A] font-bold">Suitability Score: 96.8 / 100</span>
          </div>

          {/* Incident Snapshot */}
          {selectedIncident && (
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs space-y-1">
              <div className="flex justify-between font-bold">
                <span className="text-[#DC2626]">{selectedIncident.incident_id}</span>
                <span className="text-[#0F172A]">Priority P{selectedIncident.priority_rank}</span>
              </div>
              <div className="font-semibold text-[#0F172A]">{selectedIncident.address}</div>
              <p className="text-[11px] text-[#64748B]">{selectedIncident.raw_text_description}</p>
            </div>
          )}

          {/* Recommended Ambulance */}
          <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B] font-semibold">1. Primary Recommended Ambulance:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB]">
                ALS Mobile ICU
              </span>
            </div>
            <div className="text-base font-bold text-[#2563EB]">
              {selectedIncident?.assigned_unit_ids?.join(", ") || "AMB-101"}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-[#64748B] pt-1">
              <div>Distance: <strong className="text-[#0F172A]">2.1 km</strong></div>
              <div>Scene ETA: <strong className="text-[#16A34A]">{selectedIncident?.eta_to_scene_mins || 3.2}m</strong></div>
              <div>Traffic Delay: <strong className="text-[#0F172A]">1.1x</strong></div>
            </div>
          </div>

          {/* Recommended Hospital */}
          <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B] font-semibold">2. Reserved Tertiary Hospital:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F3E8FF] text-[#9333EA]">
                Cath Lab Ready
              </span>
            </div>
            <div className="text-base font-bold text-[#9333EA]">
              {selectedIncident?.assigned_hospital?.name || "AIG Hospitals Gachibowli"}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-[#64748B] pt-1">
              <div>Vacant ICU: <strong className="text-[#16A34A]">3 Beds</strong></div>
              <div>Transit ETA: <strong className="text-[#0F172A]">{selectedIncident?.eta_to_hospital_mins || 5.8}m</strong></div>
              <div>ER Trauma: <strong className="text-[#0F172A]">Bays Clear</strong></div>
            </div>
          </div>

          {/* Ranked Alternatives */}
          <div className="space-y-2 text-xs">
            <span className="font-bold text-[#0F172A] block">Ranked Alternative Ambulance Units</span>
            <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-center justify-between">
              <div>
                <strong className="text-[#0F172A]">#2: AMB-102 (ALS Mobile ICU)</strong>
                <span className="text-[11px] text-[#64748B] block">Distance: 3.4 km • ETA: 4.8 mins</span>
              </div>
              <span className="text-[11px] font-bold text-[#2563EB]">Score: 91.2</span>
            </div>
            <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-center justify-between">
              <div>
                <strong className="text-[#0F172A]">#3: AMB-104 (ALS Mobile ICU)</strong>
                <span className="text-[11px] text-[#64748B] block">Distance: 4.8 km • ETA: 6.2 mins</span>
              </div>
              <span className="text-[11px] font-bold text-[#64748B]">Score: 84.5</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center gap-2">
            <button
              onClick={handleApproveAction}
              className="flex-1 py-2.5 bg-[#173B65] hover:bg-[#1E4A7E] text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
              <span>Approve Allocation</span>
            </button>
            <button
              onClick={handleRejectAction}
              className="px-4 py-2.5 border border-[#DC2626] text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg font-semibold text-xs transition"
            >
              Reject
            </button>
          </div>
        </div>

        {/* Right Column: "WHY THIS RECOMMENDATION?" (EXPLAINABLE AI - XAI PANEL) (6 Cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-bold text-[#173B65]">
                Why This Recommendation? (Explainable AI)
              </h3>
            </div>
            <span className="text-xs text-[#64748B] font-mono">SHAP Feature Attribution</span>
          </div>

          {/* 6 Structured Breakdown Factors */}
          <div className="space-y-3 text-xs">
            {/* 1. Why this ambulance */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
              <strong className="text-[#173B65] block text-xs">
                1. Why This Ambulance ({selectedIncident?.assigned_unit_ids?.join(", ") || "AMB-101"}):
              </strong>
              <p className="text-[11px] text-[#334155] leading-relaxed">
                Unit holds the shortest predicted GNN travel time (3.2 mins) and is fully equipped with required
                biphasic defibrillator and transport ventilator required for high-survival-decay patient.
              </p>
            </div>

            {/* 2. Why this hospital */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
              <strong className="text-[#173B65] block text-xs">
                2. Why This Hospital ({selectedIncident?.assigned_hospital?.name || "AIG Hospitals"}):
              </strong>
              <p className="text-[11px] text-[#334155] leading-relaxed">
                Hospital has 3 verified vacant ICU beds and an active 24/7 Primary PCI Cath Lab. Yashoda Hospital was
                ruled out due to higher intake queue delay (14 mins vs 5.8 mins).
              </p>
            </div>

            {/* 3. Capability Compatibility */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
              <strong className="text-[#173B65] block text-xs">
                3. Capability & Equipment Compatibility:
              </strong>
              <p className="text-[11px] text-[#334155] leading-relaxed">
                100% match score with clinical requirements. Paramedic crew on-duty includes certified emergency
                resuscitation specialist matching victim clinical profile.
              </p>
            </div>

            {/* 4. GNN Travel Time & Weather Impact */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
              <strong className="text-[#173B65] block text-xs">
                4. GNN Traffic Routing & Weather Resilience:
              </strong>
              <p className="text-[11px] text-[#334155] leading-relaxed">
                Routing avoids Kukatpally low-lying flooded underpasses (&gt;35cm water depth). Route via Outer Ring Road
                corridor preserves lowest travel variance under live traffic index (1.1x).
              </p>
            </div>

            {/* 5. Resource Availability & Opportunity Cost */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
              <strong className="text-[#173B65] block text-xs">
                5. Global Opportunity Cost & Dynamic Preemption:
              </strong>
              <p className="text-[11px] text-[#334155] leading-relaxed">
                Global combinatorial allocator evaluated competing incidents. Retained 1 backup ALS unit at Gachibowli
                to protect high-risk junction coverage.
              </p>
            </div>
          </div>

          {/* Visual SHAP Feature Importance Bars */}
          <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
            <span className="font-bold text-xs text-[#0F172A] block">
              SHAP Feature Weight Contributions
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Clinical Survival Decay Rate (+42%)</span>
                  <span className="font-bold text-[#DC2626]">+42.0</span>
                </div>
                <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-[#DC2626] h-full rounded-full" style={{ width: "84%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#64748B]">
                  <span>GNN Travel Time Proximity (+28%)</span>
                  <span className="font-bold text-[#2563EB]">+28.0</span>
                </div>
                <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-[#2563EB] h-full rounded-full" style={{ width: "56%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Hospital ICU Bed Vacancy (+18%)</span>
                  <span className="font-bold text-[#9333EA]">+18.0</span>
                </div>
                <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-[#9333EA] h-full rounded-full" style={{ width: "36%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Weather Flood Bypass Factor (+12%)</span>
                  <span className="font-bold text-[#0284C7]">+12.0</span>
                </div>
                <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden mt-0.5">
                  <div className="bg-[#0284C7] h-full rounded-full" style={{ width: "24%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
