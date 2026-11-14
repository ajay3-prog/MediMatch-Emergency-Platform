"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ambulance,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  HeartPulse,
  Info,
  MapPin,
  Navigation,
  Plus,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
  Waves,
  X,
} from "lucide-react";
import { EmergencyUnit, Hospital, Incident } from "../hooks/useRealtimeState";
import MiniLocationMap from "./MiniLocationMap";

interface IncidentsPageProps {
  incidents: Incident[];
  units: EmergencyUnit[];
  hospitals: Hospital[];
  onUpdateStatus: (incidentId: string, status: string) => void;
  onCreateIncident: (data: any) => Promise<any>;
}

export default function IncidentsPage({
  incidents = [],
  units = [],
  hospitals = [],
  onUpdateStatus,
  onCreateIncident,
}: IncidentsPageProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("TODAY");

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // New Incident Form State
  const [newDesc, setNewDesc] = useState<string>("");
  const [newType, setNewType] = useState<string>("ROAD_ACCIDENT");
  const [newAddress, setNewAddress] = useState<string>("Gachibowli Outer Ring Road Junction, Hyderabad");
  const [newLat, setNewLat] = useState<number>(17.4400);
  const [newLng, setNewLng] = useState<number>(78.3500);
  const [newVictims, setNewVictims] = useState<number>(2);
  const [newPhone, setNewPhone] = useState<string>("+91 98480-10800");
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // KPI Calculations
  const totalCount = incidents.length;
  const criticalCount = incidents.filter((i) => i.priority_rank === 1 || i.severity_score >= 85).length;
  const highPriorityCount = incidents.filter((i) => i.priority_rank === 2).length;
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length;

  // Filtered List
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.incident_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.raw_text_description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority =
      priorityFilter === "ALL" ||
      (priorityFilter === "P1" && (inc.priority_rank === 1 || inc.severity_score >= 85)) ||
      (priorityFilter === "P2" && inc.priority_rank === 2) ||
      (priorityFilter === "P3" && inc.priority_rank >= 3);

    const matchesType = typeFilter === "ALL" || inc.emergency_type === typeFilter;
    const matchesStatus = statusFilter === "ALL" || inc.status === statusFilter;

    return matchesSearch && matchesPriority && matchesType && matchesStatus;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) {
      setFormError("Please provide an incident description.");
      return;
    }
    setFormError(null);
    setIsCreating(true);
    try {
      await onCreateIncident({
        raw_text_description: newDesc,
        emergency_type: newType,
        address: newAddress,
        lat: newLat,
        lng: newLng,
        victims_count: newVictims,
        caller_phone: newPhone,
      });
      setShowCreateModal(false);
      setNewDesc("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ======================================================================
          TOP 4 KPI CARDS
         ====================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Total Logged Incidents</span>
            <Radio className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F172A]">{totalCount}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Recorded in current session</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Critical P1 Incidents</span>
            <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#DC2626]">{criticalCount}</div>
          <span className="text-[11px] text-[#DC2626] block mt-0.5">Survival decay rate &gt; 1.5%/min</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>High-Priority P2</span>
            <ShieldAlert className="w-4 h-4 text-[#F97316]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#F97316]">{highPriorityCount}</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Standard ambulance dispatch</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Resolved Incidents</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#16A34A]">{resolvedCount}</div>
          <span className="text-[11px] text-[#16A34A] block mt-0.5">Hospital handoff complete</span>
        </div>
      </div>

      {/* ======================================================================
          FILTER & SEARCH TOOLBAR
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ID, street, keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Priorities</option>
            <option value="P1">P1 Critical (&gt;85)</option>
            <option value="P2">P2 Urgent</option>
            <option value="P3">P3 Standard</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Categories</option>
            <option value="ROAD_ACCIDENT">Road Accident</option>
            <option value="CARDIAC_ARREST">Cardiac Arrest</option>
            <option value="FIRE">Commercial / Residential Fire</option>
            <option value="URBAN_FLOODING">Urban Flooding</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Statuses</option>
            <option value="REPORTED">REPORTED</option>
            <option value="ALLOCATED">ALLOCATED</option>
            <option value="EN_ROUTE">EN_ROUTE</option>
            <option value="ON_SCENE">ON_SCENE</option>
            <option value="TRANSPORTING">TRANSPORTING</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>

        {/* Action Button: Create Emergency */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 rounded-lg bg-[#173B65] hover:bg-[#1E4A7E] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Emergency</span>
        </button>
      </div>

      {/* ======================================================================
          INTERACTIVE INCIDENTS TABLE
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Emergency Type</th>
                <th className="py-3 px-4">Severity / Priority</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Casualties</th>
                <th className="py-3 px-4">Assigned Unit</th>
                <th className="py-3 px-4">Target Hospital</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#64748B]">
                    No emergency incidents match the current filters.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => {
                  const isP1 = inc.priority_rank === 1 || inc.severity_score >= 85;

                  return (
                    <tr
                      key={inc.incident_id}
                      onClick={() => setSelectedIncident(inc)}
                      className="hover:bg-[#F8FAFC] cursor-pointer transition"
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
                      <td className="py-3 px-4">{inc.victims_count} Persons</td>
                      <td className="py-3 px-4 font-semibold text-[#2563EB]">
                        {inc.assigned_unit_ids?.join(", ") || "Unassigned"}
                      </td>
                      <td className="py-3 px-4 truncate max-w-[140px] text-[#9333EA]">
                        {inc.assigned_hospital?.name || "AIG Hospitals"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#166534]">
                          {inc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIncident(inc);
                          }}
                          className="px-2.5 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[11px] font-semibold text-[#0F172A]"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          SLIDE-OVER INCIDENT DETAIL PANEL
         ====================================================================== */}
      {selectedIncident && (
        <div className="fixed inset-0 z-[2500] bg-black/30 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#E2E8F0] p-6 overflow-y-auto space-y-5 animate-slide-left">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                  Incident Detail Dossier
                </span>
                <h3 className="text-lg font-bold text-[#173B65]">{selectedIncident.incident_id}</h3>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Severity Card */}
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>AI Clinical Urgency Score</span>
                <span className="text-[#DC2626] font-bold">
                  {Math.round(selectedIncident.severity_score)}/100 (P{selectedIncident.priority_rank})
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#F97316] to-[#DC2626] h-full rounded-full"
                  style={{ width: `${selectedIncident.severity_score}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#64748B] pt-1">
                <span>Category: {selectedIncident.emergency_type}</span>
                <span>Casualties: {selectedIncident.victims_count}</span>
              </div>
            </div>

            {/* Description & Location */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-[#0F172A] block">Location & Description</span>
              <MiniLocationMap
                lat={selectedIncident.lat}
                lng={selectedIncident.lng}
                label={selectedIncident.address}
                pinType="INCIDENT"
                height="150px"
              />
              <div className="p-3 bg-white border border-[#E2E8F0] rounded-lg text-[#334155] space-y-2">
                <div className="flex items-start gap-1.5 font-semibold text-[#0F172A]">
                  <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                  <span>{selectedIncident.address}</span>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  {selectedIncident.raw_text_description}
                </p>
                <div className="text-[10px] text-[#64748B] pt-1 border-t border-[#E2E8F0] flex justify-between">
                  <span>Caller: {selectedIncident.caller_phone} ({selectedIncident.caller_type})</span>
                  <span className="font-mono text-[#2563EB]">GPS: {selectedIncident.lat.toFixed(4)}, {selectedIncident.lng.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* AI Priority Explanation */}
            <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg text-xs space-y-1">
              <div className="font-bold text-[#173B65] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>AI Urgency & Allocation Rationale</span>
              </div>
              <p className="text-[11px] text-[#1E3A8A] leading-relaxed">
                {selectedIncident.why_this_ambulance ||
                  selectedIncident.why_this_hospital ||
                  "Prioritized based on active cardiovascular or structural collapse risk. Dynamic survival decay requires immediate ALS deployment."}
              </p>
            </div>

            {/* Assignment Details */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-[#0F172A] block">Current Fleet Assignment</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-white border border-[#E2E8F0] rounded-lg">
                  <span className="text-[10px] text-[#64748B] block">Assigned Unit</span>
                  <strong className="text-xs text-[#2563EB] block mt-0.5">
                    {selectedIncident.assigned_unit_ids?.join(", ") || "AMB-101 (ALS)"}
                  </strong>
                  <span className="text-[10px] text-[#16A34A] block mt-0.5">
                    Scene ETA: {selectedIncident.eta_to_scene_mins || 3.0}m
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-[#E2E8F0] rounded-lg">
                  <span className="text-[10px] text-[#64748B] block">Target Hospital</span>
                  <strong className="text-xs text-[#9333EA] block mt-0.5 truncate">
                    {selectedIncident.assigned_hospital?.name || "AIG Hospitals"}
                  </strong>
                  <span className="text-[10px] text-[#64748B] block mt-0.5">
                    Transit ETA: {selectedIncident.eta_to_hospital_mins || 6.0}m
                  </span>
                </div>
              </div>
            </div>

            {/* Status Transition Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <span className="font-bold text-xs text-[#0F172A] block">Update Incident Phase:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => onUpdateStatus(selectedIncident.incident_id, "EN_ROUTE")}
                  className="py-2 px-3 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] font-semibold text-[#0F172A]"
                >
                  Mark En Route
                </button>
                <button
                  onClick={() => onUpdateStatus(selectedIncident.incident_id, "ON_SCENE")}
                  className="py-2 px-3 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] font-semibold text-[#0F172A]"
                >
                  Mark On Scene
                </button>
                <button
                  onClick={() => onUpdateStatus(selectedIncident.incident_id, "TRANSPORTING")}
                  className="py-2 px-3 rounded-lg border border-[#2563EB] bg-[#EFF6FF] font-semibold text-[#2563EB]"
                >
                  Mark Transporting
                </button>
                <button
                  onClick={() => onUpdateStatus(selectedIncident.incident_id, "RESOLVED")}
                  className="py-2 px-3 rounded-lg bg-[#16A34A] hover:bg-[#15803D] font-semibold text-white"
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          CREATE EMERGENCY MODAL
         ====================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#173B65]">Create New Emergency Incident</h3>
                  <span className="text-xs text-[#64748B]">Immediate Dispatch Ingestion</span>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#0F172A] font-semibold mb-1">Emergency Category</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="ROAD_ACCIDENT">Road Accident / Highway Collision</option>
                  <option value="CARDIAC_ARREST">Cardiac Arrest / Acute Myocardial Infarction</option>
                  <option value="FIRE">Commercial / Residential Structural Fire</option>
                  <option value="URBAN_FLOODING">Urban Flooding / Waterlogged Underpass</option>
                </select>
              </div>

              <div>
                <label className="block text-[#0F172A] font-semibold mb-1">
                  Incident Description & Symptoms
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="E.g., 2 car head-on collision at Gachibowli, 3 persons injured, 1 trapped with head trauma..."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#0F172A] font-semibold mb-1">Location Landmark</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-[#0F172A] font-semibold mb-1">People Affected</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newVictims}
                    onChange={(e) => setNewVictims(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#0F172A] font-semibold mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newLat}
                    onChange={(e) => setNewLat(parseFloat(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-[#0F172A] font-semibold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newLng}
                    onChange={(e) => setNewLng(parseFloat(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-[#CBD5E1] bg-white rounded-lg font-semibold text-xs text-[#0F172A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-[#173B65] hover:bg-[#1E4A7E] text-white rounded-lg font-semibold text-xs flex items-center gap-1.5"
                >
                  {isCreating ? "Ingesting & Triaging..." : "Dispatch Emergency"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
