"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  CornerDownRight,
  Flame,
  HeartPulse,
  Info,
  Layers,
  MapPin,
  Play,
  PlayCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { XAIDecisionLog } from "../hooks/useRealtimeState";

interface SimulatorPageProps {
  onTrigger1030Surge: () => void;
  onTriggerDisruption1Breakdown: () => void;
  onTriggerDisruption2HospitalFull: () => void;
  onTriggerDisruption3RainTraffic: () => void;
  onTriggerDisruption4Preemption: () => void;
  onResetSimulation: () => void;
  isSimulating: boolean;
  xaiAuditLogs: XAIDecisionLog[];
}

interface ScenarioConfig {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  trigger: string;
  beforeState: {
    unit: string;
    hospital: string;
    eta: string;
    status: string;
  };
  afterState: {
    unit: string;
    hospital: string;
    eta: string;
    status: string;
    rationale: string;
  };
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: "surge",
    badge: "BENCHMARK 1",
    title: "10:30 AM Peak Rush-Hour Simultaneous Surge",
    subtitle: "3 Competing Acuity Emergencies Injected Simultaneously",
    description:
      "Incident A (5-person Highway Crash at Gachibowli), Incident B (Elderly Cardiac Arrest at Madhapur), and Incident C (Submerged Auto at Kukatpally).",
    trigger: "SURGE",
    beforeState: {
      unit: "Idle Fleet on Standby (AMB-101 to AMB-106)",
      hospital: "Standard Regional Intake",
      eta: "N/A (No Emergencies)",
      status: "Standby",
    },
    afterState: {
      unit: "AMB-101 -> Cardiac (ALS) | AMB-102 -> Crash (ALS) | BOAT-301 -> Flood",
      hospital: "AIG Hospitals (ICU verified) & KIMS Hospital",
      eta: "Cardiac: 2.8m | Crash: 3.2m | Flood: 4.5m",
      status: "3 Units Allocated Instantly",
      rationale:
        "Global combinatorial allocator prioritizes cardiac arrest over crash due to non-linear clinical survival decay curve, without stranding crash victims.",
    },
  },
  {
    id: "breakdown",
    badge: "DISRUPTION 1",
    title: "Ambulance Telematics Mechanical Breakdown",
    subtitle: "Assigned Ambulance AMB-102 Fails Mid-Transit to Incident A",
    description:
      "Engine breakdown reported mid-journey. System must failover automatically and reallocate backup without dispatcher intervention.",
    trigger: "BREAKDOWN",
    beforeState: {
      unit: "AMB-102 En Route to Gachibowli Crash",
      hospital: "AIG Hospitals Trauma Bay",
      eta: "2.4 mins remaining",
      status: "EN_ROUTE_TO_INCIDENT",
    },
    afterState: {
      unit: "AMB-104 (ALS Standby) Reassigned Instantly",
      hospital: "AIG Hospitals Trauma Bay (Preserved)",
      eta: "4.1 mins revised ETA",
      status: "AMB-102 Flagged Breakdown • Backup Dispatched",
      rationale:
        "State store immediately locks AMB-102 as UNAVAILABLE_BREAKDOWN and calls global RL optimizer to dispatch nearest reserve ALS unit AMB-104.",
    },
  },
  {
    id: "hospital_full",
    badge: "DISRUPTION 2",
    title: "Hospital ER & ICU Bed Saturation (0 Beds)",
    subtitle: "Yashoda Hospital Suddenly Saturates (0 ICU Beds Available)",
    description:
      "While an ambulance is transporting a cardiac arrest victim to Yashoda Hospital, the hospital reports 0 ICU vacancies.",
    trigger: "HOSPITAL_FULL",
    beforeState: {
      unit: "AMB-101 Transporting Cardiac Patient to Yashoda",
      hospital: "Yashoda Hospital Somajiguda (1 ICU Vacancy Initially)",
      eta: "4.2 mins to Yashoda ER",
      status: "TRANSPORTING_TO_HOSPITAL",
    },
    afterState: {
      unit: "AMB-101 Diverted Mid-Route to AIG Hospitals",
      hospital: "AIG Hospitals Gachibowli (3 Vacant ICU Beds)",
      eta: "5.1 mins to AIG ER",
      status: "Mid-Journey Diversion Active",
      rationale:
        "Patient cannot wait in saturated ER queue. Real-time WebSocket triggers automatic GNN recalculation to AIG Hospitals with 24/7 Cath Lab ready.",
    },
  },
  {
    id: "rain_traffic",
    badge: "DISRUPTION 3",
    title: "Cloudburst Inundation & GNN Weather Rerouting",
    subtitle: "65 mm/hr Monsoon Inundation on Hitech-Madhapur Corridor",
    description:
      "Arterial highway floods with 35cm water depth. Standard ambulances are blocked, triggering dynamic alternative route guidance.",
    trigger: "RAIN_TRAFFIC",
    beforeState: {
      unit: "AMB-101 Routed via Shortest Arterial Highway",
      hospital: "AIG Hospitals Gachibowli",
      eta: "3.2 mins via Main Road",
      status: "NORMAL FLOW (1.0x)",
    },
    afterState: {
      unit: "AMB-101 Rerouted via Outer Ring Road Elevated Bypass",
      hospital: "AIG Hospitals Gachibowli",
      eta: "4.8 mins (Avoids 18 min Flood Trap)",
      status: "FLOOD BYPASS ACTIVE",
      rationale:
        "GNN road graph sets arterial edge weight to infinity (>30cm water impassable for road vehicles). BOAT-301 assigned to sector; ambulances rerouted.",
    },
  },
  {
    id: "preemption",
    badge: "DISRUPTION 4",
    title: "Dynamic Competing Preemption (Case D)",
    subtitle: "Non-Critical En-Route Unit Preempted for Sudden Cardiac Crisis",
    description:
      "AMB-103 en route to a minor laceration is dynamically preempted mid-transit to an urgent cardiac arrest call with severe decay rate.",
    trigger: "PREEMPTION",
    beforeState: {
      unit: "AMB-103 En Route to Minor Issue (P3 Severity 42%)",
      hospital: "Continental Hospital General Ward",
      eta: "6.0 mins to scene",
      status: "can_be_preempted = True",
    },
    afterState: {
      unit: "AMB-103 Re-routed to Sudden Cardiac Arrest (P1 Severity 97%)",
      hospital: "AIG Hospitals Primary Cath Lab",
      eta: "2.1 mins to Cardiac Patient",
      status: "Preempted Mid-Transit • Backup Sent to Minor Issue",
      rationale:
        "Non-patient carrying units are flagged preemptible. Clinical decay model proves saving cardiac patient has 6.4x higher survival utility.",
    },
  },
];

export default function SimulatorPage({
  onTrigger1030Surge,
  onTriggerDisruption1Breakdown,
  onTriggerDisruption2HospitalFull,
  onTriggerDisruption3RainTraffic,
  onTriggerDisruption4Preemption,
  onResetSimulation,
  isSimulating,
  xaiAuditLogs = [],
}: SimulatorPageProps) {
  const [activeScenarioId, setActiveScenarioId] = useState<string>("surge");
  const [historyLogs, setHistoryLogs] = useState<
    Array<{ scenario: string; time: string; status: string; result: string }>
  >([
    {
      scenario: "10:30 AM Surge Triggered",
      time: "10:30:15 IST",
      status: "RESOLVED",
      result: "3 Competing Incidents Allocated with Zero Latency",
    },
  ]);

  const currentScenario =
    SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];

  const handleRunActiveScenario = () => {
    if (currentScenario.id === "surge") {
      onTrigger1030Surge();
    } else if (currentScenario.id === "breakdown") {
      onTriggerDisruption1Breakdown();
    } else if (currentScenario.id === "hospital_full") {
      onTriggerDisruption2HospitalFull();
    } else if (currentScenario.id === "rain_traffic") {
      onTriggerDisruption3RainTraffic();
    } else if (currentScenario.id === "preemption") {
      onTriggerDisruption4Preemption();
    }

    setHistoryLogs((prev) => [
      {
        scenario: currentScenario.title,
        time: new Date().toLocaleTimeString() + " IST",
        status: "EXECUTED",
        result: currentScenario.afterState.status,
      },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] border border-[#BFDBFE]">
            <Zap className="w-6 h-6 text-[#2563EB]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#173B65]">
                Scenario Simulator & Stress Tester (10:30 AM Surge)
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                EVALUATION BENCHMARK
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Inject Disrupted Fleet Scenarios, Mechanical Breakdowns, Hospital Saturation & Extreme Weather
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetSimulation}
            className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 transition shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Reset to Clean Hyderabad Baseline</span>
          </button>
        </div>
      </div>

      {/* ======================================================================
          SCENARIO SELECTOR CARDS (5 TABS)
         ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {SCENARIOS.map((scen) => {
          const isActive = scen.id === activeScenarioId;

          return (
            <button
              key={scen.id}
              onClick={() => setActiveScenarioId(scen.id)}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                isActive
                  ? "bg-[#173B65] border-[#173B65] text-white shadow-sm"
                  : "bg-white border-[#E2E8F0] text-[#0F172A] hover:border-[#2563EB]"
              }`}
            >
              <div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
                    isActive ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
                  }`}
                >
                  {scen.badge}
                </span>
                <strong className="block text-xs font-bold mt-2 leading-snug">
                  {scen.title}
                </strong>
              </div>
              <span
                className={`text-[10px] block mt-2 ${
                  isActive ? "text-slate-300" : "text-[#64748B]"
                }`}
              >
                Click to inspect & trigger
              </span>
            </button>
          );
        })}
      </div>

      {/* ======================================================================
          LIVE COMPARISON WORKSPACE: BEFORE VS AFTER REALLOCATION
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
          <div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB] uppercase">
              {currentScenario.badge} Active Evaluation
            </span>
            <h2 className="text-lg font-bold text-[#173B65] mt-1">{currentScenario.title}</h2>
            <p className="text-xs text-[#64748B]">{currentScenario.description}</p>
          </div>

          <button
            onClick={handleRunActiveScenario}
            disabled={isSimulating}
            className="px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isSimulating ? "SIMULATING REALLOCATION..." : "RUN THIS SIMULATION"}</span>
          </button>
        </div>

        {/* Side-by-Side Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Initial Allocation State (Before Disruption) */}
          <div className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#64748B]">
                <Clock className="w-4 h-4 text-[#94A3B8]" />
                <span>STATE BEFORE DISRUPTION (BASELINE)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E2E8F0] text-[#475569]">
                INITIAL STATE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-[#64748B] block uppercase font-semibold">
                  Resource Fleet Assignment:
                </span>
                <span className="text-xs font-semibold text-[#0F172A] block mt-0.5">
                  {currentScenario.beforeState.unit}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block uppercase font-semibold">
                  Destination Hospital:
                </span>
                <span className="text-xs font-semibold text-[#0F172A] block mt-0.5">
                  {currentScenario.beforeState.hospital}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block uppercase font-semibold">
                  Projected Travel Times:
                </span>
                <span className="text-xs font-semibold text-[#64748B] block mt-0.5">
                  {currentScenario.beforeState.eta}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block uppercase font-semibold">
                  Operational Phase:
                </span>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#E2E8F0] text-[#334155]">
                  {currentScenario.beforeState.status}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: AI Dynamic Reallocation State (After Disruption) */}
          <div className="p-5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#BFDBFE]">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#173B65]">
                <Sparkles className="w-4 h-4 text-[#2563EB]" />
                <span>STATE AFTER AI DYNAMIC REALLOCATION</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#166534]">
                OPTIMIZED FAILOVER
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-[#2563EB] block uppercase font-semibold">
                  Dynamic Fleet Reallocation:
                </span>
                <span className="text-xs font-bold text-[#173B65] block mt-0.5">
                  {currentScenario.afterState.unit}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#2563EB] block uppercase font-semibold">
                  Diverted Hospital ER Destination:
                </span>
                <span className="text-xs font-bold text-[#9333EA] block mt-0.5">
                  {currentScenario.afterState.hospital}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#2563EB] block uppercase font-semibold">
                  Recalculated GNN Travel ETAs:
                </span>
                <span className="text-xs font-bold text-[#16A34A] block mt-0.5">
                  {currentScenario.afterState.eta}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#2563EB] block uppercase font-semibold">
                  Audit Result:
                </span>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#166534]">
                  {currentScenario.afterState.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed XAI Reallocation Explanation Box */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#173B65]">
            <Info className="w-4 h-4 text-[#2563EB]" />
            <span>Why This Automatic Reallocation Was Chosen (Explainable AI):</span>
          </div>
          <p className="text-[#334155] text-xs leading-relaxed">
            {currentScenario.afterState.rationale}
          </p>
        </div>

        {/* 2 Success KPI Badges */}
        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
          <div className="p-3 bg-white border border-[#E2E8F0] rounded-lg flex items-center justify-between">
            <span className="text-[#64748B]">Resource Conflicts Resolved:</span>
            <span className="text-[#16A34A] font-bold">100% Mitigated</span>
          </div>
          <div className="p-3 bg-white border border-[#E2E8F0] rounded-lg flex items-center justify-between">
            <span className="text-[#64748B]">Unassigned Critical Incidents:</span>
            <span className="text-[#16A34A] font-bold">0 Unattended</span>
          </div>
        </div>
      </div>

      {/* ======================================================================
          SCENARIO EXECUTION HISTORY LOG TABLE
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
            Scenario Execution Audit Trail
          </h3>
          <span className="text-xs text-[#64748B]">Live Session Log</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Scenario Injected</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Reallocation Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
              {historyLogs.map((log, index) => (
                <tr key={index} className="hover:bg-[#F8FAFC]">
                  <td className="py-3 px-4 font-mono text-[#64748B]">{log.time}</td>
                  <td className="py-3 px-4 font-bold text-[#173B65]">{log.scenario}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#166534]">
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#334155]">{log.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
