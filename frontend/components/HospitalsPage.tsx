"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  Building2,
  CheckCircle2,
  Clock,
  Droplets,
  Edit2,
  ExternalLink,
  Flame,
  HeartPulse,
  Info,
  MapPin,
  Plus,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Users,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { Hospital, Incident } from "../hooks/useRealtimeState";
import LiveMap from "./LiveMap";
import MiniLocationMap from "./MiniLocationMap";

interface HospitalsPageProps {
  hospitals: Hospital[];
  incidents: Incident[];
  onUpdateHospitalCapacity: (
    hospitalId: string,
    payload: {
      icu_beds_available?: number;
      er_beds_available?: number;
      ventilators_available?: number;
      general_beds_available?: number;
      burn_beds_available?: number;
      er_waiting_time_mins?: number;
      has_cath_lab?: boolean;
      has_trauma_team?: boolean;
      accepting_emergencies?: boolean;
    }
  ) => void;
}

export default function HospitalsPage({
  hospitals = [],
  incidents = [],
  onUpdateHospitalCapacity,
}: HospitalsPageProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"TABLE" | "MAP">("TABLE");
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);

  // KPIs
  const totalHospitals = hospitals.length;
  const availableIcuBeds = hospitals.reduce((acc, h) => acc + (h.icu_beds_available || 0), 0);
  const availableGeneralBeds = hospitals.reduce((acc, h) => acc + (h.general_beds_available || 0), 0);
  const acceptingCount = hospitals.filter((h) => h.accepting_emergencies).length;

  const filteredHospitals = hospitals.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.hospital_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACCEPTING" && h.accepting_emergencies) ||
      (statusFilter === "DIVERTING" && !h.accepting_emergencies);

    const matchesSpecialty =
      specialtyFilter === "ALL" ||
      (specialtyFilter === "CATH" && h.has_cath_lab) ||
      (specialtyFilter === "TRAUMA" && h.has_trauma_team);

    return matchesSearch && matchesStatus && matchesSpecialty;
  });

  const handleBedDelta = (
    hosp: Hospital,
    field: "icu_beds_available" | "er_beds_available",
    delta: number
  ) => {
    const current = hosp[field] || 0;
    const updated = Math.max(0, current + delta);
    onUpdateHospitalCapacity(hosp.hospital_id, { [field]: updated });
  };

  const handleSimulateIcuFull = (hosp: Hospital) => {
    onUpdateHospitalCapacity(hosp.hospital_id, { icu_beds_available: 0 });
  };

  return (
    <div className="space-y-6">
      {/* ======================================================================
          TOP 4 KPI CARDS
         ====================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Designated Hospital Hubs</span>
            <Building2 className="w-4 h-4 text-[#9333EA]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F172A]">{totalHospitals}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Hyderabad Tertiary Network</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Available ICU Beds</span>
            <HeartPulse className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#16A34A]">{availableIcuBeds}</div>
          <span className="text-[11px] text-[#16A34A] block mt-0.5">Critical care capacity verified</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Available General Beds</span>
            <Stethoscope className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#2563EB]">{availableGeneralBeds}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Inpatient surgical beds</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Accepting Emergency ER</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#16A34A]">
            {acceptingCount} / {totalHospitals}
          </div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">ER intake bays operational</span>
        </div>
      </div>

      {/* ======================================================================
          TOOLBAR: FILTERS & SEARCH
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search hospital name, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Intake Statuses</option>
            <option value="ACCEPTING">Accepting Emergencies</option>
            <option value="DIVERTING">Diverting Intake</option>
          </select>

          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Specialities</option>
            <option value="CATH">Active Cath Lab (PCI)</option>
            <option value="TRAUMA">Level-1 Trauma Team</option>
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setViewMode("TABLE")}
              className={`px-3 py-1 rounded-md transition ${
                viewMode === "TABLE" ? "bg-[#173B65] text-white" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("MAP")}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                viewMode === "MAP" ? "bg-[#9333EA] text-white" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Hospital Map View</span>
            </button>
          </div>
        </div>

        <span className="text-xs text-[#64748B]">Click any hospital row/pin to adjust beds or simulate Case C</span>
      </div>

      {/* ======================================================================
          HOSPITAL CAPACITY TABLE OR INTERACTIVE MAP
         ====================================================================== */}
      {viewMode === "MAP" ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-[#64748B]">
            <span>Click any purple hospital marker to open ICU bed management popup</span>
            <span className="font-semibold text-[#9333EA]">Showing {hospitals.length} Healthcare Hubs</span>
          </div>
          <LiveMap
            hospitals={hospitals}
            incidents={incidents}
            units={[]}
            height="500px"
            onSelectHospital={(h) => setSelectedHospital(h)}
          />
        </div>
      ) : (
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Hospital Facility</th>
                <th className="py-3 px-4">Emergency Intake</th>
                <th className="py-3 px-4">ICU Vacancy</th>
                <th className="py-3 px-4">ER Trauma Bays</th>
                <th className="py-3 px-4">Burn Beds</th>
                <th className="py-3 px-4">Ventilators</th>
                <th className="py-3 px-4">Specialities</th>
                <th className="py-3 px-4">ER Wait</th>
                <th className="py-3 px-4 text-right">Quick Bed Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
              {filteredHospitals.map((hosp) => {
                const hasIcu = hosp.icu_beds_available > 0;
                const isAccepting = hosp.accepting_emergencies;

                return (
                  <tr
                    key={hosp.hospital_id}
                    onClick={() => setSelectedHospital(hosp)}
                    className="hover:bg-[#F8FAFC] cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 font-bold text-[#173B65]">
                      <div>{hosp.name}</div>
                      <span className="text-[10px] text-[#64748B] font-normal">
                        Lat: {hosp.lat.toFixed(4)}, Lng: {hosp.lng.toFixed(4)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isAccepting ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#DC2626]"
                        }`}
                      >
                        {isAccepting ? "ACCEPTING" : "DIVERTING"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`font-black text-sm ${hasIcu ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                        {hosp.icu_beds_available}
                      </span>
                      <span className="text-[#64748B] text-[11px]"> / {hosp.icu_beds_total}</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#2563EB] text-sm">
                      {hosp.er_beds_available}
                    </td>
                    <td className="py-3.5 px-4 text-[#F97316] font-semibold">
                      {hosp.burn_beds_available || 2}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                      {hosp.ventilators_available}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {hosp.has_cath_lab && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F3E8FF] text-[#9333EA]">
                            CATH LAB
                          </span>
                        )}
                        {hosp.has_trauma_team && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EFF6FF] text-[#2563EB]">
                            TRAUMA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#64748B]">
                      {hosp.er_waiting_time_mins || 5} mins
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBedDelta(hosp, "icu_beds_available", -1);
                          }}
                          className="w-6 h-6 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] font-bold text-xs"
                        >
                          -
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBedDelta(hosp, "icu_beds_available", +1);
                          }}
                          className="w-6 h-6 rounded bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#166534] font-bold text-xs"
                        >
                          +
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSimulateIcuFull(hosp);
                          }}
                          className="ml-2 px-2 py-1 rounded bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] font-bold text-[10px]"
                        >
                          0 ICU
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ======================================================================
          HOSPITAL DETAIL SIDE PANEL
         ====================================================================== */}
      {selectedHospital && (
        <div className="fixed inset-0 z-[2500] bg-black/30 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#E2E8F0] p-6 overflow-y-auto space-y-5 animate-slide-left">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                  Healthcare Facility Profile
                </span>
                <h3 className="text-lg font-bold text-[#173B65]">{selectedHospital.name}</h3>
              </div>
              <button
                onClick={() => setSelectedHospital(null)}
                className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mini Map View of Hospital */}
            <MiniLocationMap
              lat={selectedHospital.lat}
              lng={selectedHospital.lng}
              label={selectedHospital.name}
              pinType="HOSPITAL"
              height="150px"
            />

            {/* Live Bed Counts Steppers */}
            <div className="space-y-3">
              <span className="font-bold text-xs text-[#0F172A] block">Bed Vacancy Controller</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* ICU Beds */}
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] text-[#64748B] font-semibold">ICU BEDS VACANT</span>
                  <div className="text-xl font-bold text-[#16A34A] my-1">
                    {selectedHospital.icu_beds_available} / {selectedHospital.icu_beds_total}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleBedDelta(selectedHospital, "icu_beds_available", -1)}
                      className="flex-1 py-1 rounded bg-white border border-[#CBD5E1] font-bold"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => handleBedDelta(selectedHospital, "icu_beds_available", +1)}
                      className="flex-1 py-1 rounded bg-[#DCFCE7] text-[#166534] font-bold"
                    >
                      +1
                    </button>
                  </div>
                </div>

                {/* ER Beds */}
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] text-[#64748B] font-semibold">ER TRAUMA BAYS</span>
                  <div className="text-xl font-bold text-[#2563EB] my-1">
                    {selectedHospital.er_beds_available}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleBedDelta(selectedHospital, "er_beds_available", -1)}
                      className="flex-1 py-1 rounded bg-white border border-[#CBD5E1] font-bold"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => handleBedDelta(selectedHospital, "er_beds_available", +1)}
                      className="flex-1 py-1 rounded bg-[#EFF6FF] text-[#2563EB] font-bold"
                    >
                      +1
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Blood Bank Live Stock */}
            <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl space-y-2 text-xs">
              <span className="font-bold text-[#0F172A] block flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-[#DC2626]" />
                <span>Blood Bank Inventory (Units Available)</span>
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] font-semibold">
                <div className="p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
                  <span className="text-[#DC2626]">O+</span>: {selectedHospital.blood_bank_stock?.["O+"] ?? 15}
                </div>
                <div className="p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
                  <span className="text-[#DC2626]">A+</span>: {selectedHospital.blood_bank_stock?.["A+"] ?? 12}
                </div>
                <div className="p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
                  <span className="text-[#DC2626]">B+</span>: {selectedHospital.blood_bank_stock?.["B+"] ?? 9}
                </div>
                <div className="p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded">
                  <span className="text-[#DC2626]">AB-</span>: {selectedHospital.blood_bank_stock?.["AB-"] ?? 4}
                </div>
              </div>
            </div>

            {/* Incoming Ambulances Radar */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-[#0F172A] block">Incoming Ambulances Radar</span>
              {incidents.filter((i) => i.assigned_hospital_id === selectedHospital.hospital_id).length === 0 ? (
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-center text-[#64748B]">
                  No active ambulance transfers en route to this ER.
                </div>
              ) : (
                incidents
                  .filter((i) => i.assigned_hospital_id === selectedHospital.hospital_id)
                  .map((inc) => (
                    <div key={inc.incident_id} className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1">
                      <div className="flex justify-between font-bold">
                        <span className="text-[#173B65]">{inc.incident_id}</span>
                        <span className="text-[#DC2626]">ETA: {inc.eta_to_hospital_mins || 5.0}m</span>
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">{inc.raw_text_description}</div>
                      <div className="text-[10px] text-[#2563EB]">Assigned: {inc.assigned_unit_ids?.join(", ")}</div>
                    </div>
                  ))
              )}
            </div>

            {/* Case C Benchmark Trigger Button */}
            <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
              <button
                onClick={() => handleSimulateIcuFull(selectedHospital)}
                className="w-full py-2.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>SIMULATE SUDDEN ICU FULL (0 BEDS)</span>
              </button>
              <p className="text-[10px] text-[#64748B] text-center leading-tight">
                Simulates sudden ER saturation. En-route ambulances automatically divert to nearest vacant ICU facility.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
