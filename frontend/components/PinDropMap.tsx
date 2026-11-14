"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Compass, Layers, MapPin, Navigation, Ambulance, Building2 } from "lucide-react";
import { EmergencyUnit, Hospital } from "../hooks/useRealtimeState";

// Dynamically import Leaflet components to prevent SSR issues
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

interface PinDropMapProps {
  latitude: number;
  longitude: number;
  selectedLandmark: string;
  onLocationSelect: (data: { lat: number; lng: number; landmark: string }) => void;
  units?: EmergencyUnit[];
  hospitals?: Hospital[];
  height?: string;
}

const HYDERABAD_LANDMARKS = [
  { name: "Gachibowli Junction Flyover", lat: 17.4400, lng: 78.3500 },
  { name: "Madhapur Cyber Towers Quad", lat: 17.4480, lng: 78.3780 },
  { name: "Hitech City Mindspace Circle", lat: 17.4420, lng: 78.3810 },
  { name: "Jubilee Hills Checkpost (Rd 36)", lat: 17.4320, lng: 78.4070 },
  { name: "Banjara Hills Road 12 Complex", lat: 17.4150, lng: 78.4350 },
  { name: "Kukatpally Y-Junction Lowline", lat: 17.4947, lng: 78.3996 },
  { name: "Kondapur Botanical Garden Road", lat: 17.4610, lng: 78.3610 },
  { name: "Financial District Outer Ring Road", lat: 17.4180, lng: 78.3390 },
];

function findNearestLandmark(lat: number, lng: number): string {
  let closest = HYDERABAD_LANDMARKS[0].name;
  let minDist = Number.MAX_VALUE;

  for (const lm of HYDERABAD_LANDMARKS) {
    const dist = Math.hypot(lm.lat - lat, lm.lng - lng);
    if (dist < minDist) {
      minDist = dist;
      closest = lm.name;
    }
  }

  // If clicked within ~1km of a known landmark, use landmark name, otherwise include sector
  return minDist < 0.03 ? closest : `${closest} Sector (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`;
}

export default function PinDropMap({
  latitude = 17.4401,
  longitude = 78.3489,
  selectedLandmark,
  onLocationSelect,
  units = [],
  hospitals = [],
  height = "480px",
}: PinDropMapProps) {
  const [isClient, setIsClient] = useState<boolean>(false);
  const [L, setL] = useState<any>(null);

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
          <span>Loading Interactive Pin-Drop Map...</span>
        </div>
      </div>
    );
  }

  // Distance helper
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // Custom Emergency Origin Pin with pulsing beacon
  const createPinIcon = () => {
    return L.divIcon({
      className: "custom-pindrop-marker",
      html: `
        <div style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: max-content; cursor: pointer;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(220, 38, 38, 0.35); animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; background: #DC2626; color: #ffffff; border: 2px solid #ffffff; border-radius: 9999px; padding: 3px 9px; font-size: 11px; font-weight: 800; box-shadow: 0 3px 6px rgba(0,0,0,0.3); width: max-content; z-index: 20;">
            <span>📍 EMERGENCY ORIGIN</span>
          </div>
        </div>
      `,
      iconSize: [120, 26],
      iconAnchor: [60, 13],
      popupAnchor: [0, -14],
    });
  };

  // Custom marker for nearby fleet
  const createUnitIcon = (unit: EmergencyUnit) => {
    const isDeployed = unit.operational_status !== "IDLE";
    const color = isDeployed ? "#2563EB" : "#16A34A";
    const shortCode = unit.unit_id || "AMB";
    const icon = unit.unit_type === "FLOOD_RESCUE_BOAT" ? "🚤" : unit.unit_type === "FIRE_TENDER" ? "🚒" : "🚑";

    return L.divIcon({
      className: "custom-vehicle-marker",
      html: `
        <div style="white-space: nowrap; display: inline-flex; align-items: center; gap: 3px; background: ${color}; color: white; padding: 2px 7px; font-size: 9px; font-weight: 700; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.25); border: 1.5px solid white;">
          <span>${icon}</span>
          <span>${shortCode}</span>
        </div>
      `,
      iconSize: [80, 22],
      iconAnchor: [40, 11],
      popupAnchor: [0, -12],
    });
  };

  // Custom marker for nearby hospitals
  const createHospIcon = (hosp: Hospital) => {
    const shortName = hosp.name.split(" ")[0];
    return L.divIcon({
      className: "custom-hospital-marker",
      html: `
        <div style="white-space: nowrap; display: inline-flex; align-items: center; gap: 3px; background: white; color: #173B65; padding: 2px 6px; font-size: 9px; font-weight: 700; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); border: 1.5px solid #9333EA;">
          <span style="background: #9333EA; color: white; border-radius: 9999px; width: 12px; height: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800;">H</span>
          <span>${shortName}</span>
          <span style="background: #DCFCE7; color: #166534; padding: 0 3px; border-radius: 9999px; font-size: 8px; font-weight: 800;">ICU:${hosp.icu_beds_available}</span>
        </div>
      `,
      iconSize: [85, 22],
      iconAnchor: [42, 11],
      popupAnchor: [0, -12],
    });
  };

  // Helper component to bind map click event
  const MapClickHandler = () => {
    const { useMapEvents } = require("react-leaflet");
    useMapEvents({
      click(e: any) {
        const lat = parseFloat(e.latlng.lat.toFixed(4));
        const lng = parseFloat(e.latlng.lng.toFixed(4));
        const landmark = findNearestLandmark(lat, lng);
        onLocationSelect({ lat, lng, landmark });
      },
    });
    return null;
  };

  // Auto-fly to coordinates whenever they change
  const MapFlyRecenter = ({ lat, lng }: { lat: number; lng: number }) => {
    const { useMap } = require("react-leaflet");
    const map = useMap();
    useEffect(() => {
      if (map && lat && lng) {
        map.flyTo([lat, lng], 13, { duration: 1.0 });
      }
    }, [lat, lng, map]);
    return null;
  };

  // Sort units and hospitals by proximity to current pin
  const closestUnit =
    units.length > 0
      ? units
          .map((u) => ({ ...u, dist: getDistanceKm(latitude, longitude, u.lat, u.lng) }))
          .sort((a, b) => a.dist - b.dist)[0]
      : null;

  const closestHospital =
    hospitals.length > 0
      ? hospitals
          .map((h) => ({ ...h, dist: getDistanceKm(latitude, longitude, h.lat, h.lng) }))
          .sort((a, b) => a.dist - b.dist)[0]
      : null;

  return (
    <div className="space-y-2">
      {/* Quick 1-Click Landmark Selector Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold text-[#64748B] shrink-0 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-[#2563EB]" /> QUICK HOTSPOTS:
        </span>
        {HYDERABAD_LANDMARKS.slice(0, 6).map((lm) => (
          <button
            key={lm.name}
            type="button"
            onClick={() => onLocationSelect({ lat: lm.lat, lng: lm.lng, landmark: lm.name })}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition shrink-0 ${
              selectedLandmark === lm.name
                ? "bg-[#173B65] text-white border-[#173B65]"
                : "bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]"
            }`}
          >
            {lm.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Map Container */}
      <div
        className="relative w-full rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm bg-white"
        style={{ height }}
      >
        {/* Floating Instruction Banner */}
        <div className="absolute top-2.5 left-2.5 z-[1000] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-[#E2E8F0] shadow-sm text-xs font-semibold text-[#173B65] flex items-center gap-1.5 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse" />
          <span>Click anywhere to adjust emergency pin • Auto-zooms to speech</span>
        </div>

        {/* Selected Coordinates Readout Badge */}
        <div className="absolute top-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-[#E2E8F0] shadow-sm text-[11px] text-[#0F172A] space-y-0.5 text-right">
          <div className="font-bold text-[#2563EB] flex items-center justify-end gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>{selectedLandmark.split(",")[0]}</span>
          </div>
          <div className="font-mono text-[#64748B] text-[10px]">
            {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
          </div>
        </div>

        {/* Live Proximity Readout Footer Strip */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-xs px-3 py-2 rounded-lg border border-[#E2E8F0] shadow-sm text-[11px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span className="text-[#64748B]">Closest Emergency Unit:</span>
            <strong className="text-[#2563EB]">
              {closestUnit ? `${closestUnit.unit_id} (${closestUnit.dist} km • ~${Math.max(2, Math.round(closestUnit.dist * 2.2))}m ETA)` : "AMB-101 (0.8 km)"}
            </strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">Receiving ER Trauma:</span>
            <strong className="text-[#9333EA]">
              {closestHospital ? `${closestHospital.name.split(" ")[0]} (${closestHospital.dist} km • ${closestHospital.icu_beds_available} ICU Beds)` : "AIG (1.6 km • 5 ICU)"}
            </strong>
          </div>
        </div>

        <MapContainer
          center={[latitude, longitude]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <MapClickHandler />
          <MapFlyRecenter lat={latitude} lng={longitude} />

          {/* 1. Emergency Origin Pin */}
          <Marker position={[latitude, longitude]} icon={createPinIcon()}>
            <Popup>
              <div className="p-2 text-xs font-sans">
                <strong className="text-[#DC2626] block">Emergency Incident Origin</strong>
                <span className="text-[#0F172A] block mt-0.5 font-semibold">{selectedLandmark}</span>
                <span className="text-[#64748B] text-[10px] block mt-0.5 font-mono">
                  {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
                </span>
              </div>
            </Popup>
          </Marker>

          {/* 2. Nearby Emergency Fleet Units */}
          {units.map((unit) => (
            <Marker key={unit.unit_id} position={[unit.lat, unit.lng]} icon={createUnitIcon(unit)}>
              <Popup>
                <div className="p-1.5 text-xs font-sans">
                  <strong className="text-[#2563EB] block">{unit.unit_id} ({unit.unit_type.replace("_", " ")})</strong>
                  <span className="text-[#64748B] text-[10px] block">Status: {unit.operational_status}</span>
                  <span className="text-[#16A34A] text-[10px] block font-semibold">
                    Distance: {getDistanceKm(latitude, longitude, unit.lat, unit.lng)} km
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* 3. Nearby Hospitals */}
          {hospitals.map((hosp) => (
            <Marker key={hosp.hospital_id} position={[hosp.lat, hosp.lng]} icon={createHospIcon(hosp)}>
              <Popup>
                <div className="p-1.5 text-xs font-sans">
                  <strong className="text-[#9333EA] block">{hosp.name}</strong>
                  <span className="text-[#0F172A] text-[10px] block font-bold">
                    ICU Beds Available: {hosp.icu_beds_available} / {hosp.icu_beds_total}
                  </span>
                  <span className="text-[#64748B] text-[10px] block">
                    Distance: {getDistanceKm(latitude, longitude, hosp.lat, hosp.lng)} km
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
