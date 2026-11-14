"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  FilePlus2,
  Flame,
  Globe,
  HeartPulse,
  HelpCircle,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Navigation,
  PlayCircle,
  Radio,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Sun,
  Truck,
  User,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { useRealtimeState } from "../hooks/useRealtimeState";

// 8 Operational Pages
import CommandCentre from "../components/CommandCentre";
import IncidentsPage from "../components/IncidentsPage";
import ResourcesPage from "../components/ResourcesPage";
import HospitalsPage from "../components/HospitalsPage";
import DecisionEnginePage from "../components/DecisionEnginePage";
import AnalyticsPage from "../components/AnalyticsPage";
import PublicReportPage from "../components/PublicReportPage";
import SimulatorPage from "../components/SimulatorPage";

type ActivePageId =
  | "command"
  | "incidents"
  | "resources"
  | "hospitals"
  | "ai_engine"
  | "analytics"
  | "reporting_portal"
  | "simulator";

interface NavItem {
  id: ActivePageId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "command",
    label: "Command Centre",
    subtitle: "Situational Awareness, Map & Real-Time Queue",
    icon: LayoutDashboard,
  },
  {
    id: "reporting_portal",
    label: "Reporting Portal (108 SOS)",
    subtitle: "108 Citizen Voice & Multi-Modal Ingestion",
    icon: Radio,
    badge: "PRIMARY",
  },
  {
    id: "incidents",
    label: "Emergency Incidents",
    subtitle: "Active Triage Dossiers & Casualties",
    icon: AlertTriangle,
  },
  {
    id: "resources",
    label: "Resource Management",
    subtitle: "Ambulances, Fire Tenders & Rescue Fleet",
    icon: Truck,
  },
  {
    id: "hospitals",
    label: "Hospitals",
    subtitle: "ICU Bed Capacity & Intake Saturation",
    icon: Building2,
  },
  {
    id: "ai_engine",
    label: "AI Decision Engine",
    subtitle: "Combinatorial Allocator & Explainable AI",
    icon: Cpu,
  },
  {
    id: "analytics",
    label: "Analytics & Reports",
    subtitle: "Operational KPIs, Response Trends & Export",
    icon: BarChart3,
  },
  {
    id: "simulator",
    label: "Scenario Simulator",
    subtitle: "10:30 AM Surge & Edge-Case Benchmark",
    icon: Zap,
    badge: "BENCHMARK",
  },
];

export default function MediMatchApp() {
  const [activePage, setActivePage] = useState<ActivePageId>("command");
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("--:--:-- IST");

  // Real-Time System State Hook
  const {
    incidents,
    units,
    hospitals,
    roadEdges,
    xaiAuditLogs,
    wsConnected,
    isSimulating,
    actionNotice,
    trigger1030Surge,
    triggerDisruption1Breakdown,
    triggerDisruption2HospitalFull,
    triggerDisruption3RainTraffic,
    triggerDisruption4Preemption,
    resetSimulation,
    updateUnitStatus,
    updateHospitalCapacity,
    reportEmergencyIncident,
    updateIncidentStatus,
    addResource,
  } = useRealtimeState();

  // Live Clock (IST)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " IST"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeNav = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0F172A] flex">
      {/* ======================================================================
          FIXED LEFT SIDEBAR (220px, WHITE, #E2E8F0 BORDER)
         ====================================================================== */}
      <aside className="w-[220px] bg-white border-r border-[#E2E8F0] flex flex-col justify-between fixed top-0 bottom-0 left-0 z-40 select-none">
        {/* Top: MediMatch Brand */}
        <div>
          <div className="p-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#173B65] flex items-center justify-center text-white shadow-xs">
                <Shield className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#173B65] tracking-tight flex items-center gap-1">
                  <span>MEDIMATCH</span>
                  <span className="text-[10px] text-[#2563EB] font-mono">PS10</span>
                </div>
                <div className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                  Emergency Coordination
                </div>
              </div>
            </div>
          </div>

          {/* High-Impact Primary SOS Quick Launch Button */}
          <div className="px-3 pt-3">
            <button
              onClick={() => setActivePage("reporting_portal")}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition shadow-xs ${
                activePage === "reporting_portal"
                  ? "bg-[#DC2626] text-white ring-2 ring-[#DC2626]/40 shadow-sm"
                  : "bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              }`}
            >
              <Radio className="w-4 h-4 text-white animate-pulse" />
              <span>🚨 REPORT 108 SOS</span>
            </button>
          </div>

          {/* Section: WORKSPACE */}
          <div className="px-3 pt-3">
            <span className="text-[10px] font-bold text-[#94A3B8] tracking-wider uppercase px-2 mb-1.5 block">
              Workspace
            </span>

            {/* 8 Navigation Items */}
            <nav className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const IconComponent = item.icon;
                const isActive = activePage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition text-left ${
                      isActive
                        ? "bg-[#EFF6FF] text-[#2563EB] shadow-2xs font-bold"
                        : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <IconComponent
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-[#2563EB]" : "text-[#64748B]"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-[#DCFCE7] text-[#166534]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom: Fleet Status & WebSocket Connection */}
        <div className="p-3 border-t border-[#E2E8F0] space-y-2 text-xs">
          <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">108 Telematics:</span>
              <span className="flex items-center gap-1 font-bold text-[#16A34A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                {wsConnected ? "LIVE WS" : "HTTP 2.5s"}
              </span>
            </div>
            <div className="text-[10px] text-[#64748B] flex justify-between">
              <span>Hyderabad Zone:</span>
              <strong className="text-[#0F172A]">6 Sectors</strong>
            </div>
          </div>

          <div className="text-[10px] text-[#94A3B8] text-center font-medium">
            YUKTIK-2026 • PS10 Enterprise
          </div>
        </div>
      </aside>

      {/* ======================================================================
          MAIN CONTENT AREA (OFFSET 220px LEFT)
         ====================================================================== */}
      <div className="flex-1 ml-[220px] flex flex-col min-w-0">
        {/* Sticky Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between shadow-2xs">
          {/* Left: Dynamic Breadcrumb & Page Info */}
          <div>
            <div className="text-[11px] text-[#64748B] flex items-center gap-1 font-medium">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-[#2563EB] font-semibold">{activeNav.label}</span>
            </div>
            <h1 className="text-base font-bold text-[#173B65] tracking-tight leading-none mt-0.5">
              {activeNav.label}
            </h1>
          </div>

          {/* Right Controls: Live Badge, Clock, Notifications, Profile */}
          <div className="flex items-center gap-2.5">
            {/* Prominent Quick-Launch 108 Emergency Button */}
            <button
              onClick={() => setActivePage("reporting_portal")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition active:scale-95 ${
                activePage === "reporting_portal"
                  ? "bg-[#173B65] text-white ring-2 ring-[#173B65]/40"
                  : "bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
              <span>🚨 + Report 108 Emergency</span>
            </button>

            {/* Action Notice Alert Pill */}
            {actionNotice && (
              <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#1E3A8A] font-medium animate-fade-in">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                <span className="truncate max-w-xs">{actionNotice}</span>
              </div>
            )}

            {/* LIVE Telemetry Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] border border-[#BBF7D0] text-[#166534] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-ping" />
              <span>LIVE</span>
            </div>

            {/* Live Ticking Clock (IST) */}
            <div className="hidden sm:flex items-center gap-1 text-xs font-mono font-semibold text-[#475569] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
              <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>{currentTimeStr}</span>
            </div>

            {/* Help Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
              title="Help & System Documentation"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] relative transition"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626]" />
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-10 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-xl p-4 z-50 text-xs space-y-3 animate-scale-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="font-bold text-[#173B65]">Operational Alerts (3)</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-[#64748B] hover:text-[#0F172A]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <div className="p-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg">
                      <strong className="text-[#DC2626] block font-bold">P1 Incident Dispatched</strong>
                      <span className="text-[#991B1B] text-[11px] block mt-0.5">
                        AMB-101 en route to Cardiac Arrest at Madhapur Cyber Towers.
                      </span>
                    </div>
                    <div className="p-2 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
                      <strong className="text-[#B45309] block font-bold">Flood Corridor Alert</strong>
                      <span className="text-[#78350F] text-[11px] block mt-0.5">
                        Kukatpally underpass water depth 85cm. GNN rerouted ambulances.
                      </span>
                    </div>
                    <div className="p-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
                      <strong className="text-[#1D4ED8] block font-bold">Hospital ICU Verification</strong>
                      <span className="text-[#1E3A8A] text-[11px] block mt-0.5">
                        AIG Hospitals verified 3 vacant beds and active Cath Lab.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dispatcher User Profile Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-full bg-[#173B65] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                SR
              </div>
              <div className="hidden md:block text-left leading-tight">
                <span className="text-xs font-bold text-[#0F172A] block">Off. S. Reddy</span>
                <span className="text-[10px] text-[#64748B] block font-medium">Chief Dispatcher</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Main Container */}
        <main className="p-6 flex-1">
          {activePage === "command" && (
            <CommandCentre
              incidents={incidents}
              units={units}
              hospitals={hospitals}
              roadEdges={roadEdges}
              xaiAuditLogs={xaiAuditLogs}
              onApproveRecommendation={(id) => updateIncidentStatus(id, "EN_ROUTE")}
              onNavigateToTab={(tab) => setActivePage(tab as ActivePageId)}
            />
          )}

          {activePage === "incidents" && (
            <IncidentsPage
              incidents={incidents}
              units={units}
              hospitals={hospitals}
              onUpdateStatus={updateIncidentStatus}
              onCreateIncident={reportEmergencyIncident}
            />
          )}

          {activePage === "resources" && (
            <ResourcesPage
              units={units}
              incidents={incidents}
              onUpdateUnitStatus={updateUnitStatus}
              onAddResource={addResource}
            />
          )}

          {activePage === "hospitals" && (
            <HospitalsPage
              hospitals={hospitals}
              incidents={incidents}
              onUpdateHospitalCapacity={updateHospitalCapacity}
            />
          )}

          {activePage === "ai_engine" && (
            <DecisionEnginePage
              incidents={incidents}
              units={units}
              hospitals={hospitals}
              roadEdges={roadEdges}
              xaiAuditLogs={xaiAuditLogs}
              onApprove={(id) => updateIncidentStatus(id, "EN_ROUTE")}
            />
          )}

          {activePage === "analytics" && <AnalyticsPage />}

          {activePage === "reporting_portal" && (
            <PublicReportPage
              units={units}
              hospitals={hospitals}
              onReportEmergency={reportEmergencyIncident}
              onNavigateToCommandCentre={() => setActivePage("command")}
            />
          )}

          {activePage === "simulator" && (
            <SimulatorPage
              onTrigger1030Surge={trigger1030Surge}
              onTriggerDisruption1Breakdown={triggerDisruption1Breakdown}
              onTriggerDisruption2HospitalFull={triggerDisruption2HospitalFull}
              onTriggerDisruption3RainTraffic={triggerDisruption3RainTraffic}
              onTriggerDisruption4Preemption={triggerDisruption4Preemption}
              onResetSimulation={resetSimulation}
              isSimulating={isSimulating}
              xaiAuditLogs={xaiAuditLogs}
            />
          )}
        </main>
      </div>

      {/* ======================================================================
          HELP & SYSTEM DOCUMENTATION MODAL
         ====================================================================== */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] max-w-xl w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#2563EB]" />
                <h3 className="text-base font-bold text-[#173B65]">
                  MediMatch PS10 – Operational Quick Reference
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#334155] leading-relaxed">
              <p>
                <strong>Welcome to MediMatch:</strong> An autonomous multi-modal emergency dispatch and dynamic resource allocation platform engineered for the YUKTIK-2026 Hackathon (PS10).
              </p>
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1.5">
                <strong className="text-[#0F172A] block">How to Demonstrate to Judges:</strong>
                <div>1. <strong>Command Centre:</strong> View the live Leaflet map and approve the AI allocation recommendation.</div>
                <div>2. <strong>Scenario Simulator:</strong> Click <em>Run This Simulation</em> on the 10:30 AM surge and disruptions.</div>
                <div>3. <strong>Hospitals:</strong> Click <em>0 ICU</em> on Yashoda to trigger automatic mid-route ambulance diversion.</div>
                <div>4. <strong>AI Decision Engine:</strong> Inspect the SHAP feature weights and Explainable AI reasoning.</div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-[#173B65] text-white rounded-lg font-semibold text-xs"
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
