"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Ambulance,
  Building2,
  Compass,
  Flame,
  Heart,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Radio,
  RotateCcw,
  ShieldAlert,
  Users,
  Waves,
  Wind,
} from "lucide-react";
import { EmergencyUnit, Hospital, Incident, RoadEdge } from "../hooks/useRealtimeState";

// Dynamically import Leaflet components to prevent SSR window issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

interface LiveMapProps {
  incidents: Incident[];
  units: EmergencyUnit[];
  hospitals: Hospital[];
  roadEdges?: RoadEdge[];
  onSelectIncident?: (incident: Incident) => void;
  onSelectUnit?: (unit: EmergencyUnit) => void;
  onSelectHospital?: (hospital: Hospital) => void;
  height?: string;
}

export default function LiveMap({
  incidents = [],
  units = [],
  hospitals = [],
  roadEdges = [],
  onSelectIncident,
  onSelectUnit,
  onSelectHospital,
  height = "520px",
}: LiveMapProps) {
  const [isClient, setIsClient] = useState<boolean>(false);
  const [L, setL] = useState<any>(null);
  const [selectedLayer, setSelectedLayer] = useState<"ALL" | "INCIDENTS" | "FLEET" | "HOSPITALS">("ALL");

  useEffect(() => {
    setIsClient(true);
    import("leaflet").then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  if (!isClient || !L) {
    return (
      <div
        style={{ height }}
        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-center text-[#64748B] text-xs font-medium"
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#2563EB] animate-spin" />
          <span>Loading Hyderabad Operational Cartography...</span>
        </div>
      </div>
    );
  }

  // Custom Icon Factory for Incidents (Red/Orange operational pill badge)
  const createIncidentIcon = (incident: Incident) => {
    const isCritical = incident.priority_rank === 1 || incident.severity_score >= 85;
    const color = isCritical ? "#DC2626" : "#F97316";
    const typeLabel =
      incident.emergency_type === "CARDIAC_ARREST"
        ? "CARDIAC"
        : incident.emergency_type === "FIRE"
        ? "FIRE"
        : incident.emergency_type === "URBAN_FLOODING"
        ? "FLOOD"
        : "CRASH";
    const shortLabel = `${typeLabel} P${incident.priority_rank || 1}`;

    return L.divIcon({
      className: "custom-incident-marker",
      html: `
        <div style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: max-content; cursor: pointer;">
          <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: ${color}33; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; background: ${color}; color: #ffffff; padding: 2px 7px; font-size: 10px; font-weight: 700; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); border: 1.5px solid #ffffff; width: max-content; z-index: 10;">
            <span>⚠️</span>
            <span>${shortLabel}</span>
            <span style="background: rgba(0,0,0,0.25); padding: 0.5px 4px; border-radius: 4px; font-size: 9px;">${incident.victims_count}v</span>
          </div>
        </div>
      `,
      iconSize: [85, 24],
      iconAnchor: [42, 12],
      popupAnchor: [0, -14],
    });
  };

  // Custom Icon Factory for Emergency Fleet (Navy/Blue/Green operational pill badge)
  const createVehicleIcon = (unit: EmergencyUnit) => {
    const isBroken = unit.operational_status === "UNAVAILABLE_BREAKDOWN";
    const isDeployed =
      unit.operational_status === "EN_ROUTE_TO_INCIDENT" ||
      unit.operational_status === "TRANSPORTING_TO_HOSPITAL" ||
      unit.operational_status === "ON_SCENE";
    const color = isBroken ? "#DC2626" : isDeployed ? "#2563EB" : "#16A34A";

    // Clean code mapping: e.g. AMB-101, FIR-202, BOAT-01
    let shortCode = unit.unit_id || "AMB";
    if (shortCode === "BOAT-301") shortCode = "BOAT-01";
    else if (shortCode === "BOAT-302") shortCode = "BOAT-02";
    else if (shortCode.startsWith("TS09-EA-108")) {
      shortCode = "AMB-10" + shortCode.slice(-1);
    } else if (shortCode.startsWith("HYD-SDRF-BOAT-0")) {
      shortCode = "BOAT-0" + shortCode.slice(-1);
    } else if (shortCode.startsWith("TS09-FT-")) {
      shortCode = "FIR-" + shortCode.replace("TS09-FT-", "");
    }

    const iconEmoji =
      unit.unit_type === "FLOOD_RESCUE_BOAT" ? "🚤" :
      unit.unit_type === "FIRE_TENDER" ? "🚒" : "🚑";

    return L.divIcon({
      className: "custom-vehicle-marker",
      html: `
        <div style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; background: ${color}; color: #ffffff; padding: 2px 7px; font-size: 10px; font-weight: 700; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); border: 1.5px solid #ffffff; width: max-content; cursor: pointer;">
          <span>${iconEmoji}</span>
          <span>${shortCode}</span>
        </div>
      `,
      iconSize: [85, 24],
      iconAnchor: [42, 12],
      popupAnchor: [0, -14],
    });
  };

  // Custom Icon Factory for Hospitals (Purple #9333EA with ICU bed badge)
  const createHospitalIcon = (hosp: Hospital) => {
    const hasIcu = hosp.icu_beds_available > 0;
    const isAccepting = hosp.accepting_emergencies;
    const color = !hasIcu ? "#DC2626" : isAccepting ? "#9333EA" : "#F97316";

    // Short name extraction: Apollo, Care, AIG, Cont, KIMS, Yashoda
    let shortName = hosp.name.split(" ")[0];
    const lower = hosp.name.toLowerCase();
    if (lower.includes("apollo")) shortName = "Apollo";
    else if (lower.includes("care")) shortName = "Care";
    else if (lower.includes("aig")) shortName = "AIG";
    else if (lower.includes("continental")) shortName = "Cont";
    else if (lower.includes("kims")) shortName = "KIMS";
    else if (lower.includes("yashoda")) shortName = "Yashoda";

    return L.divIcon({
      className: "custom-hospital-marker",
      html: `
        <div style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; background: #ffffff; color: #0F172A; border: 1.5px solid ${color}; padding: 2px 7px; font-size: 10px; font-weight: 700; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); width: max-content; cursor: pointer;">
          <span style="background: ${color}; color: #ffffff; border-radius: 9999px; width: 13px; height: 13px; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800;">H</span>
          <span>${shortName}</span>
          <span style="background: ${hasIcu ? '#DCFCE7' : '#FEE2E2'}; color: ${hasIcu ? '#166534' : '#991B1B'}; padding: 0.5px 4px; border-radius: 9999px; font-size: 9px; font-weight: 800;">
            ${hosp.icu_beds_available}
          </span>
        </div>
      `,
      iconSize: [85, 24],
      iconAnchor: [42, 12],
      popupAnchor: [0, -14],
    });
  };

  const hyderabadCenter: [number, number] = [17.4420, 78.3950];

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm bg-white" style={{ height }}>
      {/* Map Filter Controls Floating Header */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 bg-white/95 backdrop-blur-sm p-1 rounded-lg border border-[#E2E8F0] shadow-sm text-xs font-medium text-[#0F172A]">
        <span className="px-2 text-[11px] font-semibold text-[#64748B] flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-[#2563EB]" /> LAYERS:
        </span>
        <button
          onClick={() => setSelectedLayer("ALL")}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
            selectedLayer === "ALL" ? "bg-[#173B65] text-white" : "hover:bg-[#F1F5F9] text-[#64748B]"
          }`}
        >
          All ({incidents.length + units.length + hospitals.length})
        </button>
        <button
          onClick={() => setSelectedLayer("INCIDENTS")}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
            selectedLayer === "INCIDENTS" ? "bg-[#DC2626] text-white" : "hover:bg-[#F1F5F9] text-[#DC2626]"
          }`}
        >
          Incidents ({incidents.length})
        </button>
        <button
          onClick={() => setSelectedLayer("FLEET")}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
            selectedLayer === "FLEET" ? "bg-[#2563EB] text-white" : "hover:bg-[#F1F5F9] text-[#2563EB]"
          }`}
        >
          Fleet ({units.length})
        </button>
        <button
          onClick={() => setSelectedLayer("HOSPITALS")}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
            selectedLayer === "HOSPITALS" ? "bg-[#9333EA] text-white" : "hover:bg-[#F1F5F9] text-[#9333EA]"
          }`}
        >
          Hospitals ({hospitals.length})
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm p-2.5 rounded-lg border border-[#E2E8F0] shadow-sm text-[11px] text-[#0F172A] space-y-1">
        <div className="font-bold text-[10px] text-[#64748B] uppercase tracking-wider mb-1">Live Map Legend</div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
          <span>Critical P1 Incident</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
          <span>High P2 Incident</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
          <span>Deployed Unit / Route</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
          <span>Available / Idle Unit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#9333EA]" />
          <span>Hospital (ICU Ready)</span>
        </div>
      </div>

      {/* Leaflet Map Container with 100% Free OpenStreetMap Light Tiles */}
      <MapContainer
        center={hyderabadCenter}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* 1. Road Network Edges / Corridors */}
        {roadEdges.map((edge) => {
          const isFlooded = edge.is_flooded_closed || edge.waterlogging_depth_cm > 30;
          const isHeavy = edge.congestion_index > 1.4;
          const color = isFlooded ? "#0284C7" : isHeavy ? "#DC2626" : "#94A3B8";
          const dashArray = isFlooded ? "6, 6" : undefined;
          const weight = isFlooded || isHeavy ? 5 : 3;

          return (
            <Polyline
              key={edge.edge_id}
              positions={edge.path_coords}
              pathOptions={{ color, weight, dashArray, opacity: 0.75 }}
            >
              <Popup>
                <div className="p-2 text-xs font-sans">
                  <div className="font-bold text-[#0F172A]">{edge.road_name}</div>
                  <div className="text-[#64748B] mt-0.5">
                    Speed: {edge.live_traffic_speed_kmph} km/h • Congestion: {edge.congestion_index}x
                  </div>
                  {isFlooded && (
                    <div className="mt-1 text-[#0284C7] font-semibold text-[10px]">
                      WATERLOGGED: {edge.waterlogging_depth_cm}cm (Rescue Boat Priority)
                    </div>
                  )}
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* 2. Active Incident Markers */}
        {(selectedLayer === "ALL" || selectedLayer === "INCIDENTS") &&
          incidents.map((incident) => (
            <Marker
              key={incident.incident_id}
              position={[incident.lat, incident.lng]}
              icon={createIncidentIcon(incident)}
              eventHandlers={{
                click: () => onSelectIncident?.(incident),
              }}
            >
              <Popup>
                <div className="p-3 text-xs font-sans max-w-[260px]">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E2E8F0] mb-2">
                    <span className="font-bold text-[#DC2626]">{incident.incident_id}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#DC2626] text-white">
                      P{incident.priority_rank} ({Math.round(incident.severity_score)}/100)
                    </span>
                  </div>
                  <div className="font-semibold text-[#0F172A] mb-1">{incident.address}</div>
                  <p className="text-[#64748B] text-[11px] mb-2">{incident.raw_text_description}</p>
                  <div className="grid grid-cols-2 gap-1 text-[11px] bg-[#F8FAFC] p-1.5 rounded border border-[#E2E8F0]">
                    <div>
                      <span className="text-[#64748B]">Affected:</span>{" "}
                      <strong className="text-[#0F172A]">{incident.victims_count}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Status:</span>{" "}
                      <strong className="text-[#2563EB]">{incident.status}</strong>
                    </div>
                  </div>
                  {incident.assigned_unit_ids?.length > 0 && (
                    <div className="mt-2 text-[11px] text-[#16A34A] font-semibold">
                      Assigned: {incident.assigned_unit_ids.join(", ")}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

        {/* 3. Emergency Fleet Markers */}
        {(selectedLayer === "ALL" || selectedLayer === "FLEET") &&
          units.map((unit) => (
            <Marker
              key={unit.unit_id}
              position={[unit.lat, unit.lng]}
              icon={createVehicleIcon(unit)}
              eventHandlers={{
                click: () => onSelectUnit?.(unit),
              }}
            >
              <Popup>
                <div className="p-3 text-xs font-sans max-w-[240px]">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E2E8F0] mb-2">
                    <span className="font-bold text-[#0F172A]">{unit.code || unit.unit_id}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EFF6FF] text-[#2563EB]">
                      {unit.unit_type.replace("_", " ")}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-[#64748B]">
                    <div>Status: <strong className="text-[#0F172A]">{unit.operational_status}</strong></div>
                    <div>Speed: <strong className="text-[#0F172A]">{unit.speed_kmph} km/h</strong></div>
                    <div>Fuel: <strong className="text-[#16A34A]">{unit.fuel_pct}%</strong></div>
                    <div>Crew: <strong className="text-[#0F172A]">{unit.paramedic || "Nurse & Paramedic"}</strong></div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* 4. Hospital Markers */}
        {(selectedLayer === "ALL" || selectedLayer === "HOSPITALS") &&
          hospitals.map((hosp) => (
            <Marker
              key={hosp.hospital_id}
              position={[hosp.lat, hosp.lng]}
              icon={createHospitalIcon(hosp)}
              eventHandlers={{
                click: () => onSelectHospital?.(hosp),
              }}
            >
              <Popup>
                <div className="p-3 text-xs font-sans max-w-[250px]">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E2E8F0] mb-2">
                    <span className="font-bold text-[#9333EA]">{hosp.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      hosp.accepting_emergencies ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]"
                    }`}>
                      {hosp.accepting_emergencies ? "ACCEPTING" : "DIVERTING"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] my-2">
                    <div className="p-1.5 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                      <span className="text-[#64748B] block text-[10px]">ICU BEDS:</span>
                      <strong className={hosp.icu_beds_available > 0 ? "text-[#16A34A] text-sm" : "text-[#DC2626] text-sm"}>
                        {hosp.icu_beds_available} / {hosp.icu_beds_total}
                      </strong>
                    </div>
                    <div className="p-1.5 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                      <span className="text-[#64748B] block text-[10px]">ER TRAUMA:</span>
                      <strong className="text-[#2563EB] text-sm">{hosp.er_beds_available}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Specialities: <strong className="text-[#0F172A]">{hosp.has_cath_lab ? "Cath Lab, " : ""}{hosp.has_trauma_team ? "Trauma Team" : "General"}</strong>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* 5. Active Dynamic Route Polylines */}
        {units
          .filter((u) => u.current_route && u.current_route.length > 1)
          .map((u) => (
            <Polyline
              key={`route-${u.unit_id}`}
              positions={u.current_route!}
              pathOptions={{ color: "#2563EB", weight: 4, dashArray: "5, 8", opacity: 0.85 }}
            />
          ))}
      </MapContainer>
    </div>
  );
}
