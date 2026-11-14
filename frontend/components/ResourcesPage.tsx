"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Clock,
  Compass,
  Edit2,
  Filter,
  Flame,
  Fuel,
  Gauge,
  HeartPulse,
  LifeBuoy,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Truck,
  Users,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { EmergencyUnit, Incident } from "../hooks/useRealtimeState";

interface ResourcesPageProps {
  units: EmergencyUnit[];
  incidents: Incident[];
  onUpdateUnitStatus: (unitId: string, status?: string) => void;
  onAddResource: (resourceData: any) => void;
}

export default function ResourcesPage({
  units = [],
  incidents = [],
  onUpdateUnitStatus,
  onAddResource,
}: ResourcesPageProps) {
  const [activeCategory, setActiveCategory] = useState<"ALL" | "AMBULANCES" | "FIRE" | "RESCUE">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<EmergencyUnit | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Resource Form State
  const [newUnitCode, setNewUnitCode] = useState<string>("AMB-107");
  const [newUnitType, setNewUnitType] = useState<string>("ALS_AMBULANCE");
  const [newZone, setNewZone] = useState<string>("Madhapur Metro Station");
  const [newDriver, setNewDriver] = useState<string>("Ramesh Chander");
  const [newParamedic, setNewParamedic] = useState<string>("EMT Haritha");
  const [newLat, setNewLat] = useState<number>(17.4450);
  const [newLng, setNewLng] = useState<number>(78.3800);

  // KPI Calculations
  const totalResources = units.length;
  const availableResources = units.filter((u) => u.operational_status === "IDLE").length;
  const deployedResources = units.filter(
    (u) =>
      u.operational_status === "EN_ROUTE_TO_INCIDENT" ||
      u.operational_status === "TRANSPORTING_TO_HOSPITAL" ||
      u.operational_status === "ON_SCENE"
  ).length;
  const unavailableResources = units.filter(
    (u) => u.operational_status === "UNAVAILABLE_BREAKDOWN"
  ).length;

  // Filtered Units
  const filteredUnits = units.filter((u) => {
    const matchesCategory =
      activeCategory === "ALL" ||
      (activeCategory === "AMBULANCES" && u.unit_type.includes("AMBULANCE")) ||
      (activeCategory === "FIRE" && u.unit_type === "FIRE_TENDER") ||
      (activeCategory === "RESCUE" && u.unit_type === "FLOOD_RESCUE_BOAT");

    const matchesSearch =
      u.unit_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.code && u.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.driver_name && u.driver_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.station_zone && u.station_zone.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddResource({
      unit_id: newUnitCode,
      code: newUnitCode,
      unit_type: newUnitType,
      station_zone: newZone,
      driver_name: newDriver,
      paramedic: newParamedic,
      lat: newLat,
      lng: newLng,
    });
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* ======================================================================
          TOP 4 KPI CARDS
         ====================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Total Fleet Registry</span>
            <Truck className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F172A]">{totalResources}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Hyderabad 108 Fleet</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Available / Standby</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#16A34A]">{availableResources}</div>
          <span className="text-[11px] text-[#16A34A] block mt-0.5">Ready for instant dispatch</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Deployed to Emergency</span>
            <Navigation className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#2563EB]">{deployedResources}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Active en-route telematics</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Unavailable / Breakdown</span>
            <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#DC2626]">{unavailableResources}</div>
          <span className="text-[11px] text-[#DC2626] block mt-0.5">Requires depot servicing</span>
        </div>
      </div>

      {/* ======================================================================
          TOOLBAR: CATEGORY TABS & ACTIONS
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveCategory("ALL")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeCategory === "ALL" ? "bg-[#173B65] text-white" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            All Resources ({units.length})
          </button>
          <button
            onClick={() => setActiveCategory("AMBULANCES")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeCategory === "AMBULANCES" ? "bg-[#2563EB] text-white" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Ambulances ({units.filter((u) => u.unit_type.includes("AMBULANCE")).length})
          </button>
          <button
            onClick={() => setActiveCategory("FIRE")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeCategory === "FIRE" ? "bg-[#F97316] text-white" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Fire Engines ({units.filter((u) => u.unit_type === "FIRE_TENDER").length})
          </button>
          <button
            onClick={() => setActiveCategory("RESCUE")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeCategory === "RESCUE" ? "bg-[#0284C7] text-white" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Rescue Boats ({units.filter((u) => u.unit_type === "FLOOD_RESCUE_BOAT").length})
          </button>
        </div>

        {/* Search & Add Resource Button */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code, crew, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] w-48"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#173B65] hover:bg-[#1E4A7E] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Resource</span>
          </button>
        </div>
      </div>

      {/* ======================================================================
          RESOURCE REGISTRY TABLE
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Resource ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Capabilities</th>
                <th className="py-3 px-4">Base Station Zone</th>
                <th className="py-3 px-4">Assigned Crew</th>
                <th className="py-3 px-4">Fuel</th>
                <th className="py-3 px-4">Availability Status</th>
                <th className="py-3 px-4">Active Mission</th>
                <th className="py-3 px-4 text-right">Quick Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
              {filteredUnits.map((unit) => {
                const isIdle = unit.operational_status === "IDLE";
                const isBroken = unit.operational_status === "UNAVAILABLE_BREAKDOWN";

                return (
                  <tr
                    key={unit.unit_id}
                    onClick={() => setSelectedUnit(unit)}
                    className="hover:bg-[#F8FAFC] cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-bold text-[#173B65]">{unit.code || unit.unit_id}</td>
                    <td className="py-3 px-4 font-medium text-[#334155]">
                      {unit.unit_type.replace("_", " ")}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {unit.equipment?.has_defibrillator && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EFF6FF] text-[#2563EB]">
                            DEFIB
                          </span>
                        )}
                        {unit.equipment?.has_ventilator && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F3E8FF] text-[#9333EA]">
                            VENT
                          </span>
                        )}
                        {unit.unit_type === "ALS_AMBULANCE" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#DCFCE7] text-[#166534]">
                            ALS
                          </span>
                        )}
                        {unit.unit_type === "FLOOD_RESCUE_BOAT" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#E0F2FE] text-[#0284C7]">
                            BOAT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#64748B]">{unit.station_zone || "Gachibowli Hub"}</td>
                    <td className="py-3 px-4">{unit.paramedic || "Nurse & Paramedic"}</td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${unit.fuel_pct > 40 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                        {unit.fuel_pct}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isBroken
                            ? "bg-[#FEE2E2] text-[#DC2626]"
                            : isIdle
                            ? "bg-[#DCFCE7] text-[#166534]"
                            : "bg-[#EFF6FF] text-[#2563EB]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {unit.operational_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#2563EB]">
                      {unit.assigned_incident_id || "None (Standby)"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isBroken ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateUnitStatus(unit.unit_id, "IDLE");
                          }}
                          className="px-2.5 py-1 rounded bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0] font-bold text-[10px]"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateUnitStatus(unit.unit_id, "UNAVAILABLE_BREAKDOWN");
                          }}
                          className="px-2.5 py-1 rounded bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] font-bold text-[10px]"
                        >
                          Breakdown
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          RESOURCE DETAIL SIDE PANEL
         ====================================================================== */}
      {selectedUnit && (
        <div className="fixed inset-0 z-[2500] bg-black/30 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#E2E8F0] p-6 overflow-y-auto space-y-5 animate-slide-left">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                  Resource Telematics Dossier
                </span>
                <h3 className="text-lg font-bold text-[#173B65]">
                  {selectedUnit.code || selectedUnit.unit_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedUnit(null)}
                className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Telematics HUD */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <div className="text-[10px] text-[#64748B] font-semibold mb-1 flex items-center justify-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-[#2563EB]" /> Speed
                </div>
                <div className="text-lg font-bold text-[#0F172A]">{selectedUnit.speed_kmph} km/h</div>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <div className="text-[10px] text-[#64748B] font-semibold mb-1 flex items-center justify-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-[#9333EA]" /> Heading
                </div>
                <div className="text-lg font-bold text-[#0F172A]">{selectedUnit.heading}° SE</div>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <div className="text-[10px] text-[#64748B] font-semibold mb-1 flex items-center justify-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-[#16A34A]" /> Fuel Tank
                </div>
                <div className="text-lg font-bold text-[#16A34A]">{selectedUnit.fuel_pct}%</div>
              </div>
            </div>

            {/* Crew Roster */}
            <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2 text-xs">
              <span className="font-bold text-[#0F172A] block">On-Duty Emergency Medical Crew</span>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Pilot / Driver:</span>
                <strong className="text-[#0F172A]">{selectedUnit.driver_name || "Pilot Ramesh"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Primary Paramedic:</span>
                <strong className="text-[#2563EB]">{selectedUnit.paramedic || "Nurse Kavitha"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Zone Depot:</span>
                <strong className="text-[#0F172A]">{selectedUnit.station_zone || "Gachibowli Outer Ring Hub"}</strong>
              </div>
            </div>

            {/* Equipment Inventory */}
            <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2 text-xs">
              <span className="font-bold text-[#0F172A] block">Critical Medical Payload</span>
              <div className="flex items-center justify-between">
                <span>Biphasic Defibrillator:</span>
                <span className="font-bold text-[#16A34A]">
                  {selectedUnit.equipment?.has_defibrillator ? "Active & Inspected" : "None"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Transport Ventilator:</span>
                <span className="font-bold text-[#16A34A]">
                  {selectedUnit.equipment?.has_ventilator ? "Active & Inspected" : "None"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Medical Oxygen Cylinders:</span>
                <span className="font-bold text-[#0F172A]">
                  {selectedUnit.equipment?.oxygen_cylinders || 3} Cylinders (2000 PSI)
                </span>
              </div>
            </div>

            {/* Deployment History Table */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-[#0F172A] block">Recent Deployment History</span>
              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[11px]">
                <div className="flex justify-between font-semibold">
                  <span className="text-[#2563EB]">Mission INC-2026-101 (Crash)</span>
                  <span className="text-[#16A34A]">Completed (14m)</span>
                </div>
                <div className="text-[#64748B]">Transported to AIG Hospitals Trauma ER</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-[11px]">
                <div className="flex justify-between font-semibold">
                  <span className="text-[#2563EB]">Mission INC-2026-098 (Cardiac)</span>
                  <span className="text-[#16A34A]">Completed (18m)</span>
                </div>
                <div className="text-[#64748B]">Transported to Yashoda Hospital Cath Lab</div>
              </div>
            </div>

            {/* Availability Toggle Actions */}
            <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
              <button
                onClick={() => onUpdateUnitStatus(selectedUnit.unit_id, "IDLE")}
                className="w-full py-2.5 rounded-lg bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0] font-semibold text-xs transition"
              >
                Mark Available (Standby at Depot)
              </button>
              <button
                onClick={() => onUpdateUnitStatus(selectedUnit.unit_id, "UNAVAILABLE_BREAKDOWN")}
                className="w-full py-2.5 rounded-lg bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] font-semibold text-xs transition"
              >
                Report Mechanical Breakdown (Trigger Failover)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          ADD RESOURCE MODAL
         ====================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#2563EB]" />
                <h3 className="text-base font-bold text-[#173B65]">Add Emergency Fleet Unit</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-[#64748B]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#0F172A] font-semibold mb-1">Unit Code / Identifier</label>
                <input
                  type="text"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-[#0F172A] font-semibold mb-1">Resource Category</label>
                <select
                  value={newUnitType}
                  onChange={(e) => setNewUnitType(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-[#0F172A]"
                >
                  <option value="ALS_AMBULANCE">Advanced Life Support (ALS Ambulance)</option>
                  <option value="BLS_AMBULANCE">Basic Life Support (BLS Ambulance)</option>
                  <option value="FIRE_TENDER">Emergency Fire Tender</option>
                  <option value="FLOOD_RESCUE_BOAT">Flood Inundation Rescue Boat</option>
                </select>
              </div>

              <div>
                <label className="block text-[#0F172A] font-semibold mb-1">Base Station Zone</label>
                <input
                  type="text"
                  value={newZone}
                  onChange={(e) => setNewZone(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#0F172A] font-semibold mb-1">Assigned Driver</label>
                  <input
                    type="text"
                    value={newDriver}
                    onChange={(e) => setNewDriver(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[#0F172A] font-semibold mb-1">Primary EMT</label>
                  <input
                    type="text"
                    value={newParamedic}
                    onChange={(e) => setNewParamedic(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#CBD5E1] bg-white rounded-lg font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#173B65] text-white rounded-lg font-semibold text-xs"
                >
                  Register Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
