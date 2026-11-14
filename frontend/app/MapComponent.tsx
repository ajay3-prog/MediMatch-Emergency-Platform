"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapProps {
  hospitals: any[];
  incidents: any[];
  ambulances?: any[];
  heavyTraffic: boolean;
  onToggleTraffic?: () => void;
  compact?: boolean;
  height?: string;
}

export default function MapComponent({
  hospitals = [],
  incidents = [],
  ambulances = [],
  heavyTraffic = false,
  onToggleTraffic,
  compact = false,
  height = "520px",
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const movingAmbulanceMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const animProgressRef = useRef<number>(0);

  const [mapType, setMapType] = useState<"m" | "s,h">("m");

  // 1. Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Center on Gachibowli Flyover / Hyderabad IT Corridor
    const map = L.map(containerRef.current, {
      zoomControl: !compact,
    }).setView([17.4400, 78.3650], compact ? 13 : 13);

    const initialLyrs = heavyTraffic ? "m,traffic" : "m";
    const googleTiles = L.tileLayer(
      `https://{s}.google.com/vt/lyrs=${initialLyrs}&x={x}&y={y}&z={z}`,
      {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        attribution: "Google Maps &copy; Hyderabad Traffic Police / EMRI 108",
      }
    ).addTo(map);

    tileLayerRef.current = googleTiles;
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [compact]);

  // 2. Update Google Maps Tile Layers on mapType or heavyTraffic change
  useEffect(() => {
    if (!tileLayerRef.current) return;
    let lyrs: string = mapType;
    if (heavyTraffic && mapType === "m") {
      lyrs = "m,traffic";
    }
    tileLayerRef.current.setUrl(
      `https://{s}.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`
    );
  }, [mapType, heavyTraffic]);

  // 3. Render Static Markers, Route Polylines, and Setup Moving Ambulance Markers
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;
    const group = layerGroupRef.current;
    group.clearLayers();
    movingAmbulanceMarkersRef.current.clear();

    const createBadgeIcon = (
      bgColor: string,
      borderColor: string,
      textColor: string,
      htmlContent: string
    ) =>
      L.divIcon({
        className: "custom-pin",
        html: `
          <div style="
            background: ${bgColor};
            color: ${textColor};
            padding: 6px 12px;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 11px;
            border: 2px solid ${borderColor};
            box-shadow: 0 4px 14px rgba(51, 38, 33, 0.22);
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            letter-spacing: -0.01em;
          ">
            ${htmlContent}
          </div>
        `,
        iconSize: [160, 32],
        iconAnchor: [80, 16],
      });

    // If no incidents, show Standby Gachibowli Origin Marker
    if (incidents.length === 0) {
      const originMarker = L.marker([17.4400, 78.3500], {
        icon: createBadgeIcon(
          "#FAF2EB",
          "#E5D1C3",
          "#332621",
          `<span>📍</span><span>Gachibowli Flyover (Standby Origin)</span>`
        ),
      });
      originMarker.bindPopup(`
        <div style="font-family:sans-serif;line-height:1.5;padding:4px;color:#332621;">
          <b style="font-size:13px;color:#D95338;">Standby Emergency Location</b><br/>
          <span style="font-size:12px;color:#7A6258;">Gachibowli Flyover Junction (17.4400° N, 78.3500° E)</span><br/>
          <span style="font-size:11px;color:#7A6258;">Ready for immediate 1-Click SOS Dispatch</span>
        </div>
      `);
      originMarker.addTo(group);

      // Also show available standby ambulances on the map
      ambulances.forEach((amb) => {
        const ambMarker = L.marker([amb.lat, amb.lng], {
          icon: createBadgeIcon(
            "#FAF2EB",
            "#2B6CB0",
            "#2B6CB0",
            `<span>🚑</span><span>${amb.code} (${amb.driver.split(" ")[0]})</span>`
          ),
        });
        ambMarker.bindPopup(`
          <div style="font-family:sans-serif;line-height:1.5;padding:4px;color:#332621;">
            <b style="font-size:13px;color:#2B6CB0;">${amb.code} - ${amb.unit_type}</b><br/>
            <span style="font-size:12px;color:#7A6258;">Driver: <b>${amb.driver}</b> (${amb.driver_phone})</span><br/>
            <span style="font-size:11px;color:#7A6258;">Rating: ${amb.rating}</span><br/>
            <span style="font-size:11px;color:#2E7D5B;font-weight:bold;">Status: STANDBY AVAILABLE</span>
          </div>
        `);
        ambMarker.addTo(group);
      });
    }

    // 4. Render 5 Hospital Markers
    hospitals.forEach((h) => {
      const hasIcu = h.icu_beds > 0;
      const shortName = h.name.split(" ")[0];
      const gmapsHospUrl = `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`;

      const hospMarker = L.marker([h.lat, h.lng], {
        icon: createBadgeIcon(
          hasIcu ? "#2E7D5B" : "#D95338",
          hasIcu ? "#236348" : "#B53B23",
          "#FFFFFF",
          `<span>🏥</span><span>${shortName} [${h.icu_beds > 0 ? h.icu_beds + " ICU" : "0 ICU FULL"}]</span>`
        ),
      });

      hospMarker.bindPopup(`
        <div style="font-family:-apple-system,sans-serif;line-height:1.5;padding:6px;min-width:200px;color:#332621;">
          <div style="font-size:14px;font-weight:800;color:${hasIcu ? "#2E7D5B" : "#D95338"};margin-bottom:4px;">
            ${h.name}
          </div>
          <div style="font-size:12px;color:#7A6258;margin-bottom:6px;">
            ${h.specialty}
          </div>
          <div style="font-size:12px;margin-bottom:3px;">
            <b>Available ICU Beds:</b> <span style="font-weight:bold;color:${hasIcu ? "#2E7D5B" : "#D95338"};">${h.icu_beds} / ${h.max_icu || 6}</span>
          </div>
          <div style="font-size:12px;margin-bottom:8px;">
            <b>Ventilators:</b> <b>${h.ventilators}</b> | <b>General Beds:</b> ${h.general_beds}
          </div>
          <a href="${gmapsHospUrl}" target="_blank" rel="noopener noreferrer" style="
            display:inline-block;
            background:#FAF2EB;
            color:#2B6CB0;
            border:1px solid #E5D1C3;
            padding:5px 10px;
            border-radius:6px;
            font-size:11px;
            font-weight:700;
            text-decoration:none;
          ">
            📍 View Hospital on Google Maps &rarr;
          </a>
        </div>
      `);
      hospMarker.addTo(group);
    });

    // 5. Render Active Incidents, 2-Leg Route Lines & Live Moving Ambulance Marker
    incidents.forEach((inc) => {
      const isCritical = inc.triage?.severity_level === "CRITICAL";
      const isRerouted = inc.rerouted || (inc.rerouted_from && inc.rerouted_from.length > 0);

      const amb = inc.assigned_ambulance;
      const hosp = inc.assigned_hospital;

      // Leg 1: Ambulance starting spot -> Accident Spot
      const ambStartLat = amb?.lat || 17.4420;
      const ambStartLng = amb?.lng || 78.3525;
      const accLat = inc.lat;
      const accLng = inc.lng;
      const hospLat = hosp?.lat || 17.4410;
      const hospLng = hosp?.lng || 78.3670;

      // Route Line 1: Pickup Route (Ambulance -> Accident Spot)
      // Dashed Calm Medical Blue polyline (#2B6CB0)
      L.polyline(
        [
          [ambStartLat, ambStartLng],
          [accLat, accLng],
        ],
        {
          color: "#2B6CB0",
          weight: 4,
          dashArray: "8, 8",
          opacity: 0.9,
        }
      ).addTo(group);

      // Route Line 2: Hospital Route (Accident Spot -> Hospital)
      // Solid Healing Sage Green (#2E7D5B) or Warm Amber (#D97724) or Red (#D94E3B)
      const hospRouteColor = heavyTraffic
        ? "#D94E3B"
        : isRerouted
        ? "#D97724"
        : "#2E7D5B";

      if (heavyTraffic) {
        // Red traffic glow underlay
        L.polyline(
          [
            [accLat, accLng],
            [hospLat, hospLng],
          ],
          {
            color: "#D94E3B",
            weight: 12,
            opacity: 0.3,
          }
        ).addTo(group);
      }

      L.polyline(
        [
          [accLat, accLng],
          [hospLat, hospLng],
        ],
        {
          color: hospRouteColor,
          weight: heavyTraffic ? 6 : 5,
          opacity: 0.95,
        }
      ).addTo(group);

      // Pin 2: Accident Spot Marker (🚨)
      const accMarker = L.marker([accLat, accLng], {
        icon: createBadgeIcon(
          "#D95338",
          "#B53B23",
          "#FFFFFF",
          `<span>🚨</span><span>${inc.id} (${inc.triage?.severity_percentage}% CRITICAL)</span>`
        ),
      });

      const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${accLat},${accLng}&destination=${hospLat},${hospLng}&travelmode=driving`;
      accMarker.bindPopup(`
        <div style="font-family:-apple-system,sans-serif;line-height:1.5;padding:6px;min-width:220px;color:#332621;">
          <div style="font-size:14px;font-weight:800;color:#D95338;margin-bottom:4px;">
            ${inc.id} • ${inc.triage?.severity_percentage}% ${inc.triage?.severity_level}
          </div>
          <div style="font-size:12px;color:#7A6258;margin-bottom:6px;">
            ${inc.description}
          </div>
          <div style="font-size:12px;margin-bottom:2px;">
            <b>Destination:</b> ${hosp.name} (${hosp.distance_km} km)
          </div>
          <div style="font-size:12px;margin-bottom:2px;">
            <b>Ambulance:</b> ${amb?.code} (Driver: ${amb?.driver})
          </div>
          <div style="font-size:12px;margin-bottom:8px;">
            <b>Live ETA:</b> <span style="font-weight:800;color:${heavyTraffic ? "#D94E3B" : "#2E7D5B"};">${inc.eta_mins} mins ${heavyTraffic ? "(Traffic Gridlock)" : ""}</span>
          </div>
          <a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="
            display:inline-block;
            background:#D95338;
            color:#FFFFFF;
            padding:6px 12px;
            border-radius:6px;
            font-size:11px;
            font-weight:700;
            text-decoration:none;
          ">
            🗺️ Google Maps Driving Directions &rarr;
          </a>
        </div>
      `);
      accMarker.addTo(group);

      // Pin 1: Live Ambulance Moving Marker (🚑)
      const ambMarker = L.marker([ambStartLat, ambStartLng], {
        icon: createBadgeIcon(
          "#2B6CB0",
          "#1E4A78",
          "#FFFFFF",
          `<span>🚑</span><span>${amb?.code || "TS09-EA-1081"} (${(amb?.driver || "Ramesh").split(" ")[0]})</span>`
        ),
      });

      const ambDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${ambStartLat},${ambStartLng}&destination=${accLat},${accLng}&travelmode=driving`;
      ambMarker.bindPopup(`
        <div style="font-family:-apple-system,sans-serif;line-height:1.5;padding:6px;min-width:230px;color:#332621;">
          <div style="font-size:14px;font-weight:800;color:#2B6CB0;margin-bottom:4px;">
            Ambulance ${amb?.code}
          </div>
          <div style="font-size:12px;color:#7A6258;margin-bottom:2px;">
            <b>Unit Type:</b> ${amb?.unit_type || "ALS - Advanced Life Support"}
          </div>
          <div style="font-size:12px;color:#7A6258;margin-bottom:2px;">
            <b>Driver:</b> ${amb?.driver} (${amb?.driver_phone || "+91 98480-10801"})
          </div>
          <div style="font-size:12px;color:#7A6258;margin-bottom:2px;">
            <b>Paramedic:</b> ${amb?.paramedic || "EMT Nurse Kavitha"}
          </div>
          <div style="font-size:12px;color:#7A6258;margin-bottom:6px;">
            <b>Equipment:</b> ${amb?.equipment || "Mobile Ventilator, Defibrillator"}
          </div>
          <div style="font-size:12px;margin-bottom:8px;">
            <b>Pickup ETA:</b> <span style="font-weight:bold;color:#2B6CB0;">${inc.pickup_eta_mins || 2} mins</span>
          </div>
          <a href="${ambDirectionsUrl}" target="_blank" rel="noopener noreferrer" style="
            display:inline-block;
            background:#2B6CB0;
            color:#FFFFFF;
            padding:6px 12px;
            border-radius:6px;
            font-size:11px;
            font-weight:700;
            text-decoration:none;
          ">
            🚑 Turn-by-Turn Pickup Route &rarr;
          </a>
        </div>
      `);
      ambMarker.addTo(group);
      movingAmbulanceMarkersRef.current.set(inc.id, ambMarker);
    });

    // Auto fit bounds if incident exists
    if (incidents.length > 0 && mapRef.current) {
      const activeInc = incidents[0];
      const points: L.LatLngTuple[] = [
        [activeInc.lat, activeInc.lng],
        [activeInc.assigned_hospital.lat, activeInc.assigned_hospital.lng],
        [
          activeInc.assigned_ambulance?.lat || 17.4420,
          activeInc.assigned_ambulance?.lng || 78.3525,
        ],
      ];
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [hospitals, incidents, ambulances, heavyTraffic]);

  // 6. Smooth Animation Loop for the Moving Ambulance Marker
  useEffect(() => {
    if (incidents.length === 0) return;

    let lastTimestamp = performance.now();

    const animate = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      // Cycle duration ~14 seconds for realistic smooth driving simulation
      animProgressRef.current = (animProgressRef.current + delta * 0.07) % 1.0;
      const t = animProgressRef.current;

      incidents.forEach((inc) => {
        const marker = movingAmbulanceMarkersRef.current.get(inc.id);
        if (!marker) return;

        const ambStartLat = inc.assigned_ambulance?.lat || 17.4420;
        const ambStartLng = inc.assigned_ambulance?.lng || 78.3525;
        const accLat = inc.lat;
        const accLng = inc.lng;
        const hospLat = inc.assigned_hospital.lat;
        const hospLng = inc.assigned_hospital.lng;

        let curLat = ambStartLat;
        let curLng = ambStartLng;

        // Leg 1 (Pickup): 0.0 <= t < 0.4
        // Leg 2 (Hospital Transit): 0.4 <= t <= 1.0
        if (t < 0.4) {
          const f = t / 0.4;
          curLat = ambStartLat + f * (accLat - ambStartLat);
          curLng = ambStartLng + f * (accLng - ambStartLng);
        } else {
          const f = (t - 0.4) / 0.6;
          curLat = accLat + f * (hospLat - accLat);
          curLng = accLng + f * (hospLng - accLng);
        }

        marker.setLatLng([curLat, curLng]);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [incidents]);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-[#E5D1C3] shadow-sm bg-[#FAF2EB]"
      style={{ height, minHeight: compact ? "340px" : "480px" }}
    >
      {/* Top Left Floating Traffic Toggle */}
      {onToggleTraffic && (
        <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleTraffic}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md border transition-all flex items-center gap-2 cursor-pointer ${
              heavyTraffic
                ? "bg-[#D95338] text-white border-[#B53B23] animate-pulse"
                : "bg-[#FFFDFB] text-[#332621] border-[#E5D1C3] hover:bg-[#F7E8DE]"
            }`}
          >
            <span>
              {heavyTraffic
                ? "⚠️ MONSOON GRIDLOCK ACTIVE (1.8x ETA)"
                : "🚦 Simulate Heavy Traffic / Gridlock"}
            </span>
          </button>
        </div>
      )}

      {/* Top Right Map Style Switcher */}
      <div className="absolute top-3 right-3 z-[1000] flex gap-1 bg-[#FFFDFB]/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-[#E5D1C3] text-xs font-bold text-[#332621]">
        <button
          type="button"
          onClick={() => setMapType("m")}
          className={`px-3 py-1.5 rounded-lg cursor-pointer transition ${
            mapType === "m"
              ? "bg-[#2B6CB0] text-white shadow-sm"
              : "text-[#7A6258] hover:text-[#332621] hover:bg-[#FAF2EB]"
          }`}
        >
          Google Streets
        </button>
        <button
          type="button"
          onClick={() => setMapType("s,h")}
          className={`px-3 py-1.5 rounded-lg cursor-pointer transition ${
            mapType === "s,h"
              ? "bg-[#2B6CB0] text-white shadow-sm"
              : "text-[#7A6258] hover:text-[#332621] hover:bg-[#FAF2EB]"
          }`}
        >
          Satellite Hybrid
        </button>
      </div>

      {/* Map Container */}
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
