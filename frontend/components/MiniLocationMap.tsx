"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Navigation } from "lucide-react";

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

interface MiniLocationMapProps {
  lat: number;
  lng: number;
  label?: string;
  pinType?: "INCIDENT" | "HOSPITAL" | "AMBULANCE";
  height?: string;
}

export default function MiniLocationMap({
  lat = 17.4401,
  lng = 78.3489,
  label = "Incident Location",
  pinType = "INCIDENT",
  height = "160px",
}: MiniLocationMapProps) {
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
        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-center justify-center text-[#64748B] text-xs"
      >
        <Navigation className="w-4 h-4 text-[#2563EB] animate-spin mr-1.5" />
        <span>Loading map view...</span>
      </div>
    );
  }

  const color = pinType === "HOSPITAL" ? "#9333EA" : pinType === "AMBULANCE" ? "#2563EB" : "#DC2626";

  const icon = L.divIcon({
    className: "custom-mini-marker",
    html: `
      <div style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; background: ${color}; color: #ffffff; padding: 2px 7px; font-size: 10px; font-weight: 700; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.25); border: 1.5px solid #ffffff; width: max-content; cursor: pointer;">
        <span>${pinType === "HOSPITAL" ? "🏥" : pinType === "AMBULANCE" ? "🚑" : "📍"}</span>
        <span>${label.split(" ")[0]}</span>
      </div>
    `,
    iconSize: [85, 24],
    iconAnchor: [42, 12],
    popupAnchor: [0, -14],
  });

  return (
    <div className="w-full rounded-lg overflow-hidden border border-[#E2E8F0] shadow-2xs relative" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Marker position={[lat, lng]} icon={icon}>
          <Popup>
            <div className="p-1 text-xs">
              <strong className="text-[#0F172A] block">{label}</strong>
              <span className="text-[#64748B] text-[10px]">
                {lat.toFixed(4)}° N, {lng.toFixed(4)}° E
              </span>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
