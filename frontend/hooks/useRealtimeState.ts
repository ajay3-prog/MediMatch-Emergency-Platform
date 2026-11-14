"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface Incident {
  incident_id: string;
  id?: string;
  timestamp: string;
  caller_phone: string;
  caller_type: string;
  raw_text_description: string;
  uploaded_media_url?: string;
  photo_url?: string;
  lat: number;
  lng: number;
  address: string;
  emergency_type: string;
  victims_count: number;
  critical_victims_count: number;
  trapped_status: boolean;
  fire_smoke_detected: boolean;
  water_depth_cm: number;
  vehicle_deformation_score: number;
  hazmat_leak: boolean;
  severity_score: number;
  survival_decay_rate_per_min: number;
  priority_rank: number;
  status: string;
  assigned_unit_ids: string[];
  assigned_hospital_id?: string;
  eta_to_scene_mins?: number;
  eta_to_hospital_mins?: number;
  route_coordinates?: [number, number][];
  why_this_ambulance?: string;
  why_this_hospital?: string;
  rerouted?: boolean;
  rerouted_from?: string[];
  assigned_hospital?: any;
  assigned_ambulance?: any;
}

export interface EmergencyUnit {
  unit_id: string;
  id?: string;
  code?: string;
  unit_type: "ALS_AMBULANCE" | "BLS_AMBULANCE" | "FIRE_TENDER" | "FLOOD_RESCUE_BOAT";
  lat: number;
  lng: number;
  heading: number;
  speed_kmph: number;
  operational_status: "IDLE" | "EN_ROUTE_TO_INCIDENT" | "ON_SCENE" | "TRANSPORTING_TO_HOSPITAL" | "UNAVAILABLE_BREAKDOWN";
  can_be_preempted: boolean;
  assigned_incident_id?: string;
  target_hospital_id?: string;
  current_route?: [number, number][];
  driver_name?: string;
  driver_phone?: string;
  paramedic?: string;
  station_zone?: string;
  fuel_pct: number;
  equipment: {
    has_defibrillator: boolean;
    has_ventilator: boolean;
    oxygen_cylinders: number;
    paramedic_count: number;
    carrying_capacity: number;
  };
}

export interface Hospital {
  hospital_id: string;
  id?: string;
  name: string;
  lat: number;
  lng: number;
  accepting_emergencies: boolean;
  icu_beds_available: number;
  icu_beds_total: number;
  er_beds_available: number;
  general_beds_available: number;
  burn_beds_available: number;
  ventilators_available: number;
  has_cath_lab: boolean;
  has_trauma_team: boolean;
  er_waiting_time_mins: number;
  incoming_ambulances_count: number;
  blood_bank_stock: Record<string, number>;
  predicted_load_next_2hrs_pct: number;
}

export interface RoadEdge {
  edge_id: string;
  road_name: string;
  source_node: string;
  target_node: string;
  path_coords: [number, number][];
  length_km: number;
  base_speed_kmph: number;
  live_traffic_speed_kmph: number;
  congestion_index: number;
  rainfall_mm_hr: number;
  waterlogging_depth_cm: number;
  is_flooded_closed: boolean;
  is_shortest_route_corridor: boolean;
}

export interface WeatherState {
  timestamp: string;
  rainfall_mm_hr: number;
  condition: string;
  visibility_meters: number;
  flood_alert_level: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  hour_of_day: number;
  day_of_week: number;
  is_holiday_event: boolean;
  zone_accident_risk: Record<string, number>;
  zone_flood_risk: Record<string, number>;
}

export interface XAIDecisionLog {
  decision_type: string;
  human_readable_reason: string;
  shap_feature_weights: Record<string, number>;
  timestamp: string;
  unit_id?: string;
  incident_id?: string;
  hospital_id?: string;
}

export interface SystemForecast {
  timestamp: string;
  temporal_context: {
    hour_of_day: number;
    is_rush_hour: boolean;
    rainfall_intensity_mm_hr: number;
  };
  hospital_icu_forecasts: Record<string, any>;
  zone_demand_forecasts: Record<string, any>;
}

// ==============================================================================
// RESILIENT STRUCTURED HYDERABAD SEED DATA (ZERO BLANK SCREENS GUARANTEED)
// ==============================================================================

const SEED_HOSPITALS: Hospital[] = [
  {
    hospital_id: "hosp-1",
    name: "AIG Hospitals Gachibowli",
    lat: 17.4435,
    lng: 78.3662,
    accepting_emergencies: true,
    icu_beds_available: 3,
    icu_beds_total: 12,
    er_beds_available: 14,
    general_beds_available: 45,
    burn_beds_available: 4,
    ventilators_available: 8,
    has_cath_lab: true,
    has_trauma_team: true,
    er_waiting_time_mins: 4,
    incoming_ambulances_count: 1,
    blood_bank_stock: { "O+": 16, "A+": 14, "B+": 10, "AB-": 4 },
    predicted_load_next_2hrs_pct: 78.5,
  },
  {
    hospital_id: "hosp-2",
    name: "Yashoda Hospital Somajiguda",
    lat: 17.4243,
    lng: 78.4552,
    accepting_emergencies: true,
    icu_beds_available: 2,
    icu_beds_total: 10,
    er_beds_available: 12,
    general_beds_available: 38,
    burn_beds_available: 2,
    ventilators_available: 6,
    has_cath_lab: true,
    has_trauma_team: true,
    er_waiting_time_mins: 6,
    incoming_ambulances_count: 0,
    blood_bank_stock: { "O+": 12, "A+": 10, "B+": 8, "AB-": 2 },
    predicted_load_next_2hrs_pct: 84.0,
  },
  {
    hospital_id: "hosp-3",
    name: "CARE Hospitals Banjara Hills",
    lat: 17.4156,
    lng: 78.4418,
    accepting_emergencies: true,
    icu_beds_available: 4,
    icu_beds_total: 10,
    er_beds_available: 16,
    general_beds_available: 42,
    burn_beds_available: 3,
    ventilators_available: 7,
    has_cath_lab: true,
    has_trauma_team: true,
    er_waiting_time_mins: 5,
    incoming_ambulances_count: 0,
    blood_bank_stock: { "O+": 14, "A+": 11, "B+": 9, "AB-": 3 },
    predicted_load_next_2hrs_pct: 74.0,
  },
  {
    hospital_id: "hosp-4",
    name: "Apollo Hospitals Jubilee Hills",
    lat: 17.4290,
    lng: 78.4116,
    accepting_emergencies: true,
    icu_beds_available: 3,
    icu_beds_total: 14,
    er_beds_available: 18,
    general_beds_available: 50,
    burn_beds_available: 5,
    ventilators_available: 9,
    has_cath_lab: true,
    has_trauma_team: true,
    er_waiting_time_mins: 4,
    incoming_ambulances_count: 1,
    blood_bank_stock: { "O+": 20, "A+": 16, "B+": 12, "AB-": 5 },
    predicted_load_next_2hrs_pct: 82.0,
  },
  {
    hospital_id: "hosp-5",
    name: "Continental Hospitals Financial District",
    lat: 17.4180,
    lng: 78.3411,
    accepting_emergencies: true,
    icu_beds_available: 2,
    icu_beds_total: 8,
    er_beds_available: 10,
    general_beds_available: 30,
    burn_beds_available: 2,
    ventilators_available: 5,
    has_cath_lab: false,
    has_trauma_team: true,
    er_waiting_time_mins: 8,
    incoming_ambulances_count: 0,
    blood_bank_stock: { "O+": 9, "A+": 8, "B+": 6, "AB-": 2 },
    predicted_load_next_2hrs_pct: 70.0,
  },
  {
    hospital_id: "hosp-6",
    name: "KIMS Hospitals Kondapur",
    lat: 17.4680,
    lng: 78.3610,
    accepting_emergencies: true,
    icu_beds_available: 4,
    icu_beds_total: 14,
    er_beds_available: 14,
    general_beds_available: 40,
    burn_beds_available: 3,
    ventilators_available: 6,
    has_cath_lab: true,
    has_trauma_team: true,
    er_waiting_time_mins: 5,
    incoming_ambulances_count: 1,
    blood_bank_stock: { "O+": 15, "A+": 12, "B+": 8, "AB-": 3 },
    predicted_load_next_2hrs_pct: 68.0,
  },
];

const SEED_UNITS: EmergencyUnit[] = [
  {
    unit_id: "AMB-101",
    code: "AMB-101",
    unit_type: "ALS_AMBULANCE",
    lat: 17.4460,
    lng: 78.3750,
    heading: 142,
    speed_kmph: 58.0,
    operational_status: "EN_ROUTE_TO_INCIDENT",
    can_be_preempted: false,
    assigned_incident_id: "INC-2026-102",
    target_hospital_id: "hosp-1",
    driver_name: "Ramesh Chander",
    paramedic: "EMT Kavitha (Trauma Nurse)",
    station_zone: "Madhapur Cyber Towers Hub",
    fuel_pct: 88,
    equipment: { has_defibrillator: true, has_ventilator: true, oxygen_cylinders: 4, paramedic_count: 2, carrying_capacity: 1 },
    current_route: [[17.4460, 78.3750], [17.4475, 78.3770], [17.4480, 78.3780]],
  },
  {
    unit_id: "AMB-102",
    code: "AMB-102",
    unit_type: "ALS_AMBULANCE",
    lat: 17.4330,
    lng: 78.3480,
    heading: 95,
    speed_kmph: 54.0,
    operational_status: "EN_ROUTE_TO_INCIDENT",
    can_be_preempted: false,
    assigned_incident_id: "INC-2026-101",
    target_hospital_id: "hosp-1",
    driver_name: "Suresh Babu",
    paramedic: "EMT Raju (Critical Care)",
    station_zone: "Gachibowli Stadium Base",
    fuel_pct: 82,
    equipment: { has_defibrillator: true, has_ventilator: true, oxygen_cylinders: 3, paramedic_count: 2, carrying_capacity: 2 },
    current_route: [[17.4330, 78.3480], [17.4370, 78.3485], [17.4410, 78.3490]],
  },
  {
    unit_id: "AMB-103",
    code: "AMB-103",
    unit_type: "BLS_AMBULANCE",
    lat: 17.4520,
    lng: 78.3840,
    heading: 210,
    speed_kmph: 0.0,
    operational_status: "IDLE",
    can_be_preempted: true,
    driver_name: "Venkatesh Rao",
    paramedic: "EMT Anitha",
    station_zone: "Hitech City Mindspace Hub",
    fuel_pct: 94,
    equipment: { has_defibrillator: false, has_ventilator: false, oxygen_cylinders: 2, paramedic_count: 2, carrying_capacity: 2 },
  },
  {
    unit_id: "AMB-104",
    code: "AMB-104",
    unit_type: "ALS_AMBULANCE",
    lat: 17.4320,
    lng: 78.4070,
    heading: 45,
    speed_kmph: 0.0,
    operational_status: "IDLE",
    can_be_preempted: true,
    driver_name: "Mohammed Arif",
    paramedic: "EMT Vikram (ICU Spec)",
    station_zone: "Jubilee Hills Road 36",
    fuel_pct: 79,
    equipment: { has_defibrillator: true, has_ventilator: true, oxygen_cylinders: 4, paramedic_count: 2, carrying_capacity: 1 },
  },
  {
    unit_id: "AMB-105",
    code: "AMB-105",
    unit_type: "BLS_AMBULANCE",
    lat: 17.4150,
    lng: 78.4350,
    heading: 180,
    speed_kmph: 0.0,
    operational_status: "IDLE",
    can_be_preempted: true,
    driver_name: "K. Prasad",
    paramedic: "EMT Deepa",
    station_zone: "Banjara Hills Road 12",
    fuel_pct: 85,
    equipment: { has_defibrillator: false, has_ventilator: false, oxygen_cylinders: 2, paramedic_count: 2, carrying_capacity: 2 },
  },
  {
    unit_id: "AMB-106",
    code: "AMB-106",
    unit_type: "BLS_AMBULANCE",
    lat: 17.4910,
    lng: 78.3960,
    heading: 320,
    speed_kmph: 0.0,
    operational_status: "IDLE",
    can_be_preempted: true,
    driver_name: "M. Naresh",
    paramedic: "EMT Rajender",
    station_zone: "Kukatpally Housing Board",
    fuel_pct: 91,
    equipment: { has_defibrillator: false, has_ventilator: false, oxygen_cylinders: 3, paramedic_count: 2, carrying_capacity: 2 },
  },
  {
    unit_id: "FIR-201",
    code: "FIR-201",
    unit_type: "FIRE_TENDER",
    lat: 17.4490,
    lng: 78.3790,
    heading: 90,
    speed_kmph: 0.0,
    operational_status: "IDLE",
    can_be_preempted: false,
    driver_name: "Capt. Jagadeesh",
    paramedic: "Leading Fireman Srinivas",
    station_zone: "Madhapur Fire Station",
    fuel_pct: 95,
    equipment: { has_defibrillator: true, has_ventilator: false, oxygen_cylinders: 6, paramedic_count: 4, carrying_capacity: 4 },
  },
  {
    unit_id: "FIR-202",
    code: "FIR-202",
    unit_type: "FIRE_TENDER",
    lat: 17.4640,
    lng: 78.4390,
    heading: 270,
    speed_kmph: 0.0,
    operational_status: "IDLE",
    can_be_preempted: false,
    driver_name: "Capt. Mallesh",
    paramedic: "Fire Specialist Harish",
    station_zone: "Sanath Nagar / Industrial Area Base",
    fuel_pct: 92,
    equipment: { has_defibrillator: true, has_ventilator: false, oxygen_cylinders: 6, paramedic_count: 4, carrying_capacity: 4 },
  },
  {
    unit_id: "BOAT-301",
    code: "BOAT-301",
    unit_type: "FLOOD_RESCUE_BOAT",
    lat: 17.4840,
    lng: 78.4060,
    heading: 180,
    speed_kmph: 28.0,
    operational_status: "EN_ROUTE_TO_INCIDENT",
    can_be_preempted: false,
    assigned_incident_id: "INC-2026-103",
    driver_name: "Coxswain Krishna",
    paramedic: "Rescue Diver Shiva",
    station_zone: "Kukatpally Lake Rescue Unit",
    fuel_pct: 89,
    equipment: { has_defibrillator: true, has_ventilator: false, oxygen_cylinders: 2, paramedic_count: 3, carrying_capacity: 8 },
  },
  {
    unit_id: "BOAT-302",
    code: "BOAT-302",
    unit_type: "FLOOD_RESCUE_BOAT",
    lat: 17.4340,
    lng: 78.3880,
    heading: 0,
    speed_kmph: 0.0,
    operational_status: "IDLE",
    can_be_preempted: true,
    driver_name: "Coxswain Vinay",
    paramedic: "Rescue Diver Arun",
    station_zone: "Durgam Cheruvu Rapid Staging",
    fuel_pct: 96,
    equipment: { has_defibrillator: true, has_ventilator: false, oxygen_cylinders: 2, paramedic_count: 3, carrying_capacity: 8 },
  },
];

const SEED_INCIDENTS: Incident[] = [
  {
    incident_id: "INC-2026-101",
    timestamp: new Date().toISOString(),
    caller_phone: "+91 98480-10800",
    caller_type: "BYSTANDER",
    raw_text_description: "Multi-vehicle collision on Gachibowli flyover junction, 5 victims injured, 2 unconscious with heavy bleeding and mechanical vehicle entrapment.",
    lat: 17.4400,
    lng: 78.3500,
    address: "Gachibowli Flyover Junction, Hyderabad",
    emergency_type: "ROAD_ACCIDENT",
    victims_count: 5,
    critical_victims_count: 2,
    trapped_status: true,
    fire_smoke_detected: false,
    water_depth_cm: 0.0,
    vehicle_deformation_score: 0.88,
    hazmat_leak: false,
    severity_score: 92.0,
    survival_decay_rate_per_min: 1.4,
    priority_rank: 1,
    status: "EN_ROUTE",
    assigned_unit_ids: ["AMB-102"],
    assigned_hospital_id: "hosp-1",
    eta_to_scene_mins: 3.2,
    eta_to_hospital_mins: 5.8,
    assigned_hospital: { name: "AIG Hospitals Gachibowli", icu_beds: 3 },
    why_this_ambulance: "Dispatched closest ALS unit with extrication gear; transit ETA 3.2m.",
    why_this_hospital: "Reserved AIG Hospitals trauma resuscitation surgical team with 3 verified ICU beds.",
  },
  {
    incident_id: "INC-2026-102",
    timestamp: new Date().toISOString(),
    caller_phone: "+91 98490-11223",
    caller_type: "BYSTANDER",
    raw_text_description: "Elderly male collapsed near Cyber Towers quad with acute crushing chest pain, unresponsive, cyanotic lips, suspected cardiac arrest.",
    lat: 17.4480,
    lng: 78.3780,
    address: "Cyber Towers Quad, Madhapur, Hyderabad",
    emergency_type: "CARDIAC_ARREST",
    victims_count: 1,
    critical_victims_count: 1,
    trapped_status: false,
    fire_smoke_detected: false,
    water_depth_cm: 0.0,
    vehicle_deformation_score: 0.0,
    hazmat_leak: false,
    severity_score: 97.0,
    survival_decay_rate_per_min: 2.5,
    priority_rank: 1,
    status: "EN_ROUTE",
    assigned_unit_ids: ["AMB-101"],
    assigned_hospital_id: "hosp-1",
    eta_to_scene_mins: 2.8,
    eta_to_hospital_mins: 5.2,
    assigned_hospital: { name: "AIG Hospitals Gachibowli", icu_beds: 3 },
    why_this_ambulance: "Allocated ALS Mobile ICU AMB-101 equipped with biphasic defibrillator and transport ventilator.",
    why_this_hospital: "Reserved Level-1 Cath Lab with active 24/7 Primary PCI team on-duty.",
  },
  {
    incident_id: "INC-2026-103",
    timestamp: new Date().toISOString(),
    caller_phone: "+91 94401-22334",
    caller_type: "VICTIM",
    raw_text_description: "Kukatpally Y-Junction low-lying underpass flash flooded, 85cm water depth, auto rickshaw trapped with 3 elderly passengers inside.",
    lat: 17.4947,
    lng: 78.3996,
    address: "Kukatpally Y-Junction Lowline Underpass, Hyderabad",
    emergency_type: "URBAN_FLOODING",
    victims_count: 3,
    critical_victims_count: 1,
    trapped_status: true,
    fire_smoke_detected: false,
    water_depth_cm: 85.0,
    vehicle_deformation_score: 0.35,
    hazmat_leak: false,
    severity_score: 86.0,
    survival_decay_rate_per_min: 1.1,
    priority_rank: 2,
    status: "ALLOCATED",
    assigned_unit_ids: ["BOAT-301"],
    assigned_hospital_id: "hosp-6",
    eta_to_scene_mins: 4.5,
    eta_to_hospital_mins: 7.0,
    assigned_hospital: { name: "KIMS Hospital Secunderabad", icu_beds: 2 },
    why_this_ambulance: "Road impassable for wheeled ambulances (>30cm water). Deployed twin-outboard flood rescue boat BOAT-301.",
    why_this_hospital: "KIMS Hospital ER ready for hypothermia and aspiration intake.",
  },
];

const SEED_ROAD_EDGES: RoadEdge[] = [
  {
    edge_id: "edge-gachibowli-madhapur",
    road_name: "Gachibowli - Madhapur Arterial Corridor",
    source_node: "Gachibowli",
    target_node: "Madhapur",
    path_coords: [[17.4400, 78.3500], [17.4440, 78.3650], [17.4480, 78.3780]],
    length_km: 3.8,
    base_speed_kmph: 50.0,
    live_traffic_speed_kmph: 42.0,
    congestion_index: 1.15,
    rainfall_mm_hr: 5.0,
    waterlogging_depth_cm: 0.0,
    is_flooded_closed: false,
    is_shortest_route_corridor: true,
  },
  {
    edge_id: "edge-madhapur-kukatpally",
    road_name: "Hitech - Kukatpally Lowline Highway",
    source_node: "Madhapur",
    target_node: "Kukatpally",
    path_coords: [[17.4480, 78.3780], [17.4720, 78.3880], [17.4947, 78.3996]],
    length_km: 5.6,
    base_speed_kmph: 45.0,
    live_traffic_speed_kmph: 24.0,
    congestion_index: 1.85,
    rainfall_mm_hr: 45.0,
    waterlogging_depth_cm: 35.0,
    is_flooded_closed: true,
    is_shortest_route_corridor: true,
  },
];

const SEED_XAI_LOGS: XAIDecisionLog[] = [
  {
    decision_type: "SURVIVAL_DECAY_ALLOCATION",
    human_readable_reason: "Prioritized Incident INC-2026-102 (Cardiac Arrest, 97/100) for closest ALS unit AMB-101 over minor crash to prevent irreversible ischemic brain damage.",
    shap_feature_weights: { survival_decay_rate: 42.0, proximity: 28.0, icu_capacity: 18.0, flood_bypass: 12.0 },
    timestamp: new Date().toISOString(),
    unit_id: "AMB-101",
    incident_id: "INC-2026-102",
    hospital_id: "hosp-1",
  },
  {
    decision_type: "GNN_FLOOD_REROUTE",
    human_readable_reason: "Hitech-Kukatpally corridor inundated with 35cm flood water. Rerouted road ambulances via Outer Ring Road elevated bypass; dispatched BOAT-301 into sector.",
    shap_feature_weights: { waterlogging_depth: 55.0, detour_time: 25.0, vehicle_clearance: 20.0 },
    timestamp: new Date().toISOString(),
    unit_id: "BOAT-301",
    incident_id: "INC-2026-103",
  },
];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000/ws";

export function useRealtimeState() {
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [units, setUnits] = useState<EmergencyUnit[]>(SEED_UNITS);
  const [hospitals, setHospitals] = useState<Hospital[]>(SEED_HOSPITALS);
  const [roadEdges, setRoadEdges] = useState<RoadEdge[]>(SEED_ROAD_EDGES);
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [xaiAuditLogs, setXaiAuditLogs] = useState<XAIDecisionLog[]>(SEED_XAI_LOGS);

  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 5000);
  };

  const applySnapshot = useCallback((data: any) => {
    if (!data) return;
    if (data.incidents && data.incidents.length > 0) setIncidents(data.incidents);
    if (data.units && data.units.length > 0) setUnits(data.units);
    else if (data.ambulances && data.ambulances.length > 0) setUnits(data.ambulances);
    if (data.hospitals && data.hospitals.length > 0) setHospitals(data.hospitals);
    if (data.road_edges && data.road_edges.length > 0) setRoadEdges(data.road_edges);
    if (data.weather) setWeather(data.weather);
    if (data.xai_audit_logs && data.xai_audit_logs.length > 0) setXaiAuditLogs(data.xai_audit_logs);
    setLastSyncTime(new Date());
  }, []);

  const fetchStateHttp = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/state`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        applySnapshot(data);
      }
    } catch (e) {
      // Backend not yet reachable; structured seed state handles this seamlessly
    }
  }, [applySnapshot]);

  // Connect WebSocket
  useEffect(() => {
    let unmounted = false;
    setLastSyncTime(new Date());

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(WS_BASE);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!unmounted) setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.state) {
              applySnapshot(msg.state);
            }
          } catch (err) {
            console.warn("WS parse error", err);
          }
        };

        ws.onclose = () => {
          if (!unmounted) {
            setWsConnected(false);
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
          }
        };

        ws.onerror = () => {
          if (!unmounted) setWsConnected(false);
        };
      } catch (err) {
        if (!unmounted) {
          setWsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2500);
        }
      }
    };

    connectWebSocket();
    fetchStateHttp();

    const interval = setInterval(fetchStateHttp, 2500);

    return () => {
      unmounted = true;
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [fetchStateHttp, applySnapshot]);

  // Operational Actions
  const updateUnitStatus = async (
    unitId: string,
    status?: string,
    upgradeSeverity?: number,
    victimsCount?: number
  ) => {
    // Immediate optimistic local update
    setUnits((prev) =>
      prev.map((u) => (u.unit_id === unitId ? { ...u, operational_status: (status as any) || u.operational_status } : u))
    );

    try {
      const payload: any = {};
      if (status) payload.operational_status = status;
      if (upgradeSeverity !== undefined) payload.triage_severity_upgrade = upgradeSeverity;
      if (victimsCount !== undefined) payload.victims_count_update = victimsCount;

      const res = await fetch(`${API_BASE}/api/units/${unitId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) fetchStateHttp();
    } catch (e) {
      console.warn("Failed to update unit", e);
    }
  };

  const updateHospitalCapacity = async (
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
  ) => {
    // Immediate optimistic update
    setHospitals((prev) =>
      prev.map((h) => (h.hospital_id === hospitalId ? { ...h, ...payload } : h))
    );

    try {
      const res = await fetch(`${API_BASE}/api/hospitals/${hospitalId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) fetchStateHttp();
    } catch (e) {
      console.warn("Failed to update hospital", e);
    }
  };

  const reportEmergencyIncident = async (data: {
    raw_text_description: string;
    emergency_type?: string;
    address?: string;
    lat: number;
    lng: number;
    caller_phone?: string;
    caller_type?: string;
    photo_url?: string;
    victims_count?: number;
  }): Promise<Incident | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/incidents/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text_description: data.raw_text_description,
          emergency_type: data.emergency_type || "ROAD_ACCIDENT",
          address: data.address || "Hyderabad Regional Road",
          lat: data.lat,
          lng: data.lng,
          caller_phone: data.caller_phone || "+91 98480-10800",
          caller_type: data.caller_type || "BYSTANDER",
          uploaded_media_url: data.photo_url,
          victims_count: data.victims_count || 2,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        triggerNotice(`🚨 Emergency Incident Logged (${json.incident.incident_id})`);
        fetchStateHttp();
        return json.incident;
      }
    } catch (e) {
      console.warn("Failed to post report, using local ingestion fallback", e);
    }

    // Local fallback creation
    const newInc: Incident = {
      incident_id: `INC-2026-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      caller_phone: data.caller_phone || "+91 98480-10800",
      caller_type: data.caller_type || "BYSTANDER",
      raw_text_description: data.raw_text_description,
      lat: data.lat,
      lng: data.lng,
      address: data.address || "Hyderabad Central Corridor",
      emergency_type: data.emergency_type || "ROAD_ACCIDENT",
      victims_count: data.victims_count || 2,
      critical_victims_count: 1,
      trapped_status: true,
      fire_smoke_detected: false,
      water_depth_cm: 0.0,
      vehicle_deformation_score: 0.8,
      hazmat_leak: false,
      severity_score: 91.0,
      survival_decay_rate_per_min: 1.5,
      priority_rank: 1,
      status: "ALLOCATED",
      assigned_unit_ids: ["AMB-101"],
      eta_to_scene_mins: 3.2,
      eta_to_hospital_mins: 5.8,
      assigned_hospital: { name: "AIG Hospitals Gachibowli", icu_beds: 3 },
      why_this_ambulance: "Dispatched nearest ALS unit with transport ventilator.",
    };

    setIncidents((prev) => [newInc, ...prev]);
    triggerNotice(`🚨 Emergency Incident Logged Locally (${newInc.incident_id})`);
    return newInc;
  };

  const updateIncidentStatus = (incidentId: string, status: string) => {
    setIncidents((prev) =>
      prev.map((i) => (i.incident_id === incidentId ? { ...i, status } : i))
    );
    triggerNotice(`Incident ${incidentId} status updated to ${status}`);
  };

  const addResource = (resourceData: any) => {
    const newUnit: EmergencyUnit = {
      unit_id: resourceData.unit_id,
      code: resourceData.code || resourceData.unit_id,
      unit_type: resourceData.unit_type || "ALS_AMBULANCE",
      lat: resourceData.lat || 17.4420,
      lng: resourceData.lng || 78.3880,
      heading: 0,
      speed_kmph: 0.0,
      operational_status: "IDLE",
      can_be_preempted: true,
      driver_name: resourceData.driver_name,
      paramedic: resourceData.paramedic,
      station_zone: resourceData.station_zone,
      fuel_pct: 100,
      equipment: {
        has_defibrillator: true,
        has_ventilator: resourceData.unit_type === "ALS_AMBULANCE",
        oxygen_cylinders: 4,
        paramedic_count: 2,
        carrying_capacity: 2,
      },
    };
    setUnits((prev) => [newUnit, ...prev]);
    triggerNotice(`New Resource Registered: ${newUnit.code}`);
  };

  // Scenario Simulator Triggers
  const trigger1030Surge = async () => {
    setIsSimulating(true);
    triggerNotice("🚨 10:30 AM Surge Injected: Road Accident + Cardiac Arrest + Urban Flood");
    try {
      await fetch(`${API_BASE}/api/simulator/trigger-1030-surge`, { method: "POST" });
    } catch (e) {}
    setTimeout(() => {
      setIsSimulating(false);
      fetchStateHttp();
    }, 700);
  };

  const triggerDisruption1Breakdown = async () => {
    setIsSimulating(true);
    triggerNotice("⚠️ Disruption 1 Triggered: AMB-102 Breakdown -> Failover dispatched");
    try {
      await fetch(`${API_BASE}/api/simulator/disruption-1-ambulance-breakdown`, { method: "POST" });
    } catch (e) {}
    setTimeout(() => {
      setIsSimulating(false);
      fetchStateHttp();
    }, 700);
  };

  const triggerDisruption2HospitalFull = async () => {
    setIsSimulating(true);
    triggerNotice("🏥 Disruption 2 Triggered: Hospital ICU Full (0 Beds) -> Ambulance Diverted Mid-Route");
    try {
      await fetch(`${API_BASE}/api/simulator/disruption-2-hospital-icu-full`, { method: "POST" });
    } catch (e) {}
    setTimeout(() => {
      setIsSimulating(false);
      fetchStateHttp();
    }, 700);
  };

  const triggerDisruption3RainTraffic = async () => {
    setIsSimulating(true);
    triggerNotice("🌧️ Disruption 3 Triggered: Cloudburst Inundation (65mm/hr) -> Road blocked, GNN Rerouted");
    try {
      await fetch(`${API_BASE}/api/simulator/disruption-3-heavy-rain-traffic`, { method: "POST" });
    } catch (e) {}
    setTimeout(() => {
      setIsSimulating(false);
      fetchStateHttp();
    }, 700);
  };

  const triggerDisruption4Preemption = async () => {
    setIsSimulating(true);
    triggerNotice("⚡ Disruption 4 Triggered: Dynamic Preemption of Unit to Higher-Acuity Cardiac Emergency");
    try {
      await fetch(`${API_BASE}/api/simulator/disruption-4-dynamic-preemption`, { method: "POST" });
    } catch (e) {}
    setTimeout(() => {
      setIsSimulating(false);
      fetchStateHttp();
    }, 700);
  };

  const resetSimulation = async () => {
    triggerNotice("🔄 Resetting simulation state to baseline Hyderabad data...");
    try {
      await fetch(`${API_BASE}/api/simulator/reset`, { method: "POST" });
    } catch (e) {}
    setIncidents(SEED_INCIDENTS);
    setUnits(SEED_UNITS);
    setHospitals(SEED_HOSPITALS);
    setRoadEdges(SEED_ROAD_EDGES);
    setTimeout(fetchStateHttp, 500);
  };

  return {
    incidents,
    units,
    hospitals,
    roadEdges,
    weather,
    xaiAuditLogs,
    wsConnected,
    lastSyncTime,
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
    refreshState: fetchStateHttp,
  };
}
