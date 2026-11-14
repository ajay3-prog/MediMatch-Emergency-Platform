"""
PS10: Intelligent Real-Time Emergency Coordination and Dynamic Resource Allocation Platform (YUKTIK-2026)
State Store: High-concurrency In-Memory and Redis Real-Time State Management System.
Pre-seeded with realistic Hyderabad city data across Gachibowli, Madhapur, Hitech City,
Jubilee Hills, Banjara Hills, and Kukatpally.
"""

from __future__ import annotations
import math
import json
import logging
import threading
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any, Tuple
import networkx as nx

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from models import (
    Incident,
    EmergencyUnit,
    Hospital,
    RoadEdge,
    WeatherState,
    UnitEquipment,
    CallerType,
    EmergencyType,
    IncidentStatus,
    UnitType,
    OperationalStatus,
)

logger = logging.getLogger("medimatch.state_store")
logger.setLevel(logging.INFO)


# ==============================================================================
# 1. HAVERSINE GEODETIC DISTANCE HELPER
# ==============================================================================

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes Great-Circle distance between two WGS84 coordinate pairs in kilometers.
    """
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)


# ==============================================================================
# 2. HYDERABAD CITY SEED DATA SPECIFICATIONS
# ==============================================================================

# 6 Major Hyderabad Hospitals
SEEDED_HOSPITALS: List[Dict[str, Any]] = [
    {
        "hospital_id": "hosp-1",
        "name": "Care Hospitals Banjara Hills",
        "lat": 17.4156,
        "lng": 78.4418,
        "accepting_emergencies": True,
        "icu_beds_available": 3,
        "icu_beds_total": 20,
        "er_beds_available": 6,
        "general_beds_available": 30,
        "burn_beds_available": 1,
        "ventilators_available": 3,
        "has_cath_lab": True,
        "has_trauma_team": True,
        "er_waiting_time_mins": 6,
        "incoming_ambulances_count": 0,
        "blood_bank_stock": {"A+": 14, "A-": 4, "B+": 20, "B-": 3, "O+": 25, "O-": 6, "AB+": 10, "AB-": 2},
        "predicted_load_next_2hrs_pct": 74.0,
        "specialty": "Level-1 Trauma & Emergency Care"
    },
    {
        "hospital_id": "hosp-2",
        "name": "Apollo Hospitals Jubilee Hills",
        "lat": 17.4285,
        "lng": 78.4116,
        "accepting_emergencies": True,
        "icu_beds_available": 8,
        "icu_beds_total": 35,
        "er_beds_available": 12,
        "general_beds_available": 55,
        "burn_beds_available": 4,
        "ventilators_available": 7,
        "has_cath_lab": True,
        "has_trauma_team": True,
        "er_waiting_time_mins": 3,
        "incoming_ambulances_count": 2,
        "blood_bank_stock": {"A+": 28, "A-": 10, "B+": 35, "B-": 8, "O+": 45, "O-": 14, "AB+": 18, "AB-": 6},
        "predicted_load_next_2hrs_pct": 62.0,
        "specialty": "Level-1 Polytrauma & Cardiac Care"
    },
    {
        "hospital_id": "hosp-3",
        "name": "AIG Hospitals Gachibowli",
        "lat": 17.4435,
        "lng": 78.3662,
        "accepting_emergencies": True,
        "icu_beds_available": 5,
        "icu_beds_total": 25,
        "er_beds_available": 8,
        "general_beds_available": 42,
        "burn_beds_available": 2,
        "ventilators_available": 4,
        "has_cath_lab": True,
        "has_trauma_team": True,
        "er_waiting_time_mins": 4,
        "incoming_ambulances_count": 1,
        "blood_bank_stock": {"A+": 18, "A-": 6, "B+": 24, "B-": 5, "O+": 32, "O-": 8, "AB+": 12, "AB-": 4},
        "predicted_load_next_2hrs_pct": 68.5,
        "specialty": "Critical Care & Gastro Sciences"
    },
    {
        "hospital_id": "hosp-4",
        "name": "Continental Hospital Financial District",
        "lat": 17.4180,
        "lng": 78.3411,
        "accepting_emergencies": True,
        "icu_beds_available": 6,
        "icu_beds_total": 22,
        "er_beds_available": 9,
        "general_beds_available": 38,
        "burn_beds_available": 2,
        "ventilators_available": 5,
        "has_cath_lab": True,
        "has_trauma_team": True,
        "er_waiting_time_mins": 5,
        "incoming_ambulances_count": 1,
        "blood_bank_stock": {"A+": 16, "A-": 5, "B+": 22, "B-": 4, "O+": 30, "O-": 7, "AB+": 11, "AB-": 3},
        "predicted_load_next_2hrs_pct": 58.0,
        "specialty": "Emergency & Orthopaedic Trauma"
    },
    {
        "hospital_id": "hosp-5",
        "name": "KIMS Hospitals Kondapur",
        "lat": 17.4680,
        "lng": 78.3610,
        "accepting_emergencies": True,
        "icu_beds_available": 4,
        "icu_beds_total": 18,
        "er_beds_available": 7,
        "general_beds_available": 32,
        "burn_beds_available": 1,
        "ventilators_available": 3,
        "has_cath_lab": True,
        "has_trauma_team": True,
        "er_waiting_time_mins": 5,
        "incoming_ambulances_count": 0,
        "blood_bank_stock": {"A+": 15, "A-": 4, "B+": 19, "B-": 3, "O+": 26, "O-": 5, "AB+": 9, "AB-": 2},
        "predicted_load_next_2hrs_pct": 65.0,
        "specialty": "Multi-Specialty Emergency & ICU"
    },
    {
        "hospital_id": "hosp-6",
        "name": "Yashoda Hospitals Somajiguda",
        "lat": 17.4243,
        "lng": 78.4552,
        "accepting_emergencies": True,
        "icu_beds_available": 7,
        "icu_beds_total": 30,
        "er_beds_available": 10,
        "general_beds_available": 50,
        "burn_beds_available": 3,
        "ventilators_available": 6,
        "has_cath_lab": True,
        "has_trauma_team": True,
        "er_waiting_time_mins": 7,
        "incoming_ambulances_count": 2,
        "blood_bank_stock": {"A+": 22, "A-": 8, "B+": 28, "B-": 6, "O+": 38, "O-": 10, "AB+": 15, "AB-": 5},
        "predicted_load_next_2hrs_pct": 79.0,
        "specialty": "Multi-Organ Transplant & Polytrauma"
    }
]

# 10 Seeded Emergency Resource Fleet Units
SEEDED_UNITS: List[Dict[str, Any]] = [
    {
        "unit_id": "AMB-101",
        "unit_type": UnitType.ALS_AMBULANCE,
        "lat": 17.4470,
        "lng": 78.3740,
        "heading": 90.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": True,
            "oxygen_cylinders": 4,
            "paramedic_count": 2,
            "carrying_capacity": 2
        },
        "fuel_pct": 92.0,
        "code": "TS09-EA-1081",
        "driver_name": "Ramesh Kumar",
        "driver_phone": "+91 98480-10801",
        "paramedic": "EMT Nurse Kavitha",
        "rating": "4.9★ • 8 Yrs Trauma Exp",
        "station_zone": "Madhapur"
    },
    {
        "unit_id": "AMB-102",
        "unit_type": UnitType.ALS_AMBULANCE,
        "lat": 17.4330,
        "lng": 78.3480,
        "heading": 180.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": True,
            "oxygen_cylinders": 4,
            "paramedic_count": 2,
            "carrying_capacity": 2
        },
        "fuel_pct": 88.0,
        "code": "TS09-EA-1082",
        "driver_name": "Srinivas Rao",
        "driver_phone": "+91 98480-10802",
        "paramedic": "EMT Rahul Varma",
        "rating": "4.8★ • 6 Yrs Trauma Exp",
        "station_zone": "Gachibowli"
    },
    {
        "unit_id": "AMB-103",
        "unit_type": UnitType.ALS_AMBULANCE,
        "lat": 17.4350,
        "lng": 78.4020,
        "heading": 270.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": True,
            "oxygen_cylinders": 4,
            "paramedic_count": 2,
            "carrying_capacity": 2
        },
        "fuel_pct": 95.0,
        "code": "TS09-EA-1083",
        "driver_name": "Mohammed Ali",
        "driver_phone": "+91 98480-10803",
        "paramedic": "EMT Sneha Patel",
        "rating": "4.9★ • 10 Yrs Trauma Exp",
        "station_zone": "Jubilee Hills"
    },
    {
        "unit_id": "AMB-104",
        "unit_type": UnitType.BLS_AMBULANCE,
        "lat": 17.4560,
        "lng": 78.3840,
        "heading": 45.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": False,
            "oxygen_cylinders": 2,
            "paramedic_count": 1,
            "carrying_capacity": 1
        },
        "fuel_pct": 84.0,
        "code": "TS09-EA-1084",
        "driver_name": "Venkat Reddy",
        "driver_phone": "+91 98480-10804",
        "paramedic": "EMT Anand Verma",
        "rating": "4.7★ • 5 Yrs Trauma Exp",
        "station_zone": "Hitech City"
    },
    {
        "unit_id": "AMB-105",
        "unit_type": UnitType.BLS_AMBULANCE,
        "lat": 17.4090,
        "lng": 78.4360,
        "heading": 120.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": False,
            "oxygen_cylinders": 2,
            "paramedic_count": 1,
            "carrying_capacity": 1
        },
        "fuel_pct": 90.0,
        "code": "TS09-EA-1085",
        "driver_name": "K. Naresh",
        "driver_phone": "+91 98480-10805",
        "paramedic": "EMT Swathi R",
        "rating": "4.8★ • 4 Yrs Trauma Exp",
        "station_zone": "Banjara Hills"
    },
    {
        "unit_id": "AMB-106",
        "unit_type": UnitType.BLS_AMBULANCE,
        "lat": 17.4920,
        "lng": 78.3960,
        "heading": 310.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": False,
            "oxygen_cylinders": 2,
            "paramedic_count": 1,
            "carrying_capacity": 1
        },
        "fuel_pct": 78.0,
        "code": "TS09-EA-1086",
        "driver_name": "P. Rajesh",
        "driver_phone": "+91 98480-10806",
        "paramedic": "EMT Kiran Kumar",
        "rating": "4.6★ • 3 Yrs Trauma Exp",
        "station_zone": "Kukatpally"
    },
    {
        "unit_id": "FIR-201",
        "unit_type": UnitType.FIRE_TENDER,
        "lat": 17.4540,
        "lng": 78.3910,
        "heading": 0.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": False,
            "oxygen_cylinders": 6,
            "paramedic_count": 4,
            "carrying_capacity": 6
        },
        "fuel_pct": 96.0,
        "code": "TS09-FT-201",
        "driver_name": "Station Officer Chandrasekhar",
        "driver_phone": "+91 98480-10101",
        "paramedic": "Fire Rescue Crew Alpha",
        "rating": "4.9★ • High-Rise Fire Ops",
        "station_zone": "Madhapur"
    },
    {
        "unit_id": "FIR-202",
        "unit_type": UnitType.FIRE_TENDER,
        "lat": 17.4640,
        "lng": 78.4390,
        "heading": 180.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": False,
            "oxygen_cylinders": 6,
            "paramedic_count": 4,
            "carrying_capacity": 6
        },
        "fuel_pct": 91.0,
        "code": "TS09-FT-202",
        "driver_name": "Station Officer Venkatesh",
        "driver_phone": "+91 98480-10102",
        "paramedic": "Fire Rescue Crew Bravo",
        "rating": "4.8★ • Industrial Hazmat Certified",
        "station_zone": "Sanath Nagar"
    },
    {
        "unit_id": "BOAT-301",
        "unit_type": UnitType.FLOOD_RESCUE_BOAT,
        "lat": 17.4840,
        "lng": 78.4060,
        "heading": 0.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": False,
            "oxygen_cylinders": 2,
            "paramedic_count": 2,
            "carrying_capacity": 8
        },
        "fuel_pct": 100.0,
        "code": "HYD-SDRF-BOAT-01",
        "driver_name": "Rescue Diver Satyam",
        "driver_phone": "+91 98480-10701",
        "paramedic": "SDRF Water Wing Rapid Unit",
        "rating": "5.0★ • Swiftwater Rescue Certified",
        "station_zone": "Kukatpally Lake Base"
    },
    {
        "unit_id": "BOAT-302",
        "unit_type": UnitType.FLOOD_RESCUE_BOAT,
        "lat": 17.4320,
        "lng": 78.3870,
        "heading": 0.0,
        "speed_kmph": 0.0,
        "operational_status": OperationalStatus.IDLE,
        "can_be_preempted": True,
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "current_route": [],
        "equipment": {
            "has_defibrillator": True,
            "has_ventilator": False,
            "oxygen_cylinders": 2,
            "paramedic_count": 2,
            "carrying_capacity": 8
        },
        "fuel_pct": 100.0,
        "code": "HYD-SDRF-BOAT-02",
        "driver_name": "Rescue Diver Krishna",
        "driver_phone": "+91 98480-10702",
        "paramedic": "NDRF Flood Inundation Team",
        "rating": "4.9★ • Inflatable Zodiac Crew",
        "station_zone": "Durgam Cheruvu Staging"
    }
]

# Hyderabad Road Network Graph Definition
SEEDED_ROAD_EDGES: List[Dict[str, Any]] = [
    {
        "edge_id": "EDGE-GACHI-MINDSPACE",
        "road_name": "Gachibowli Flyover - Mindspace Arterial",
        "source_node": "NODE_GACHIBOWLI",
        "target_node": "NODE_MINDSPACE",
        "path_coords": [[17.4400, 78.3500], [17.4420, 78.3650], [17.4435, 78.3820]],
        "length_km": 3.4,
        "base_speed_kmph": 50.0,
        "live_traffic_speed_kmph": 38.0,
        "congestion_index": 0.24,
        "rainfall_mm_hr": 8.0,
        "waterlogging_depth_cm": 4.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": True
    },
    {
        "edge_id": "EDGE-MINDSPACE-CYBER",
        "road_name": "Mindspace - Hitech City Cyber Towers",
        "source_node": "NODE_MINDSPACE",
        "target_node": "NODE_HITECH_CYBER",
        "path_coords": [[17.4435, 78.3820], [17.4460, 78.3790], [17.4483, 78.3772]],
        "length_km": 1.5,
        "base_speed_kmph": 45.0,
        "live_traffic_speed_kmph": 28.0,
        "congestion_index": 0.38,
        "rainfall_mm_hr": 10.0,
        "waterlogging_depth_cm": 6.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": True
    },
    {
        "edge_id": "EDGE-CYBER-MADHAPUR",
        "road_name": "Cyber Towers - Madhapur Metro Corridor",
        "source_node": "NODE_HITECH_CYBER",
        "target_node": "NODE_MADHAPUR_METRO",
        "path_coords": [[17.4483, 78.3772], [17.4488, 78.3840], [17.4490, 78.3910]],
        "length_km": 1.8,
        "base_speed_kmph": 40.0,
        "live_traffic_speed_kmph": 24.0,
        "congestion_index": 0.40,
        "rainfall_mm_hr": 12.0,
        "waterlogging_depth_cm": 8.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": True
    },
    {
        "edge_id": "EDGE-MADHAPUR-JUBILEE",
        "road_name": "Madhapur - Jubilee Hills Durgam Cheruvu Cable Bridge",
        "source_node": "NODE_MADHAPUR_METRO",
        "target_node": "NODE_JUBILEE_CHECKPOST",
        "path_coords": [[17.4490, 78.3910], [17.4380, 78.3950], [17.4320, 78.4070]],
        "length_km": 3.2,
        "base_speed_kmph": 55.0,
        "live_traffic_speed_kmph": 46.0,
        "congestion_index": 0.16,
        "rainfall_mm_hr": 6.0,
        "waterlogging_depth_cm": 2.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": True
    },
    {
        "edge_id": "EDGE-JUBILEE-BANJARA",
        "road_name": "Jubilee Hills Rd 36 - Banjara Hills Rd 12",
        "source_node": "NODE_JUBILEE_CHECKPOST",
        "target_node": "NODE_BANJARA_RD12",
        "path_coords": [[17.4320, 78.4070], [17.4240, 78.4210], [17.4156, 78.4350]],
        "length_km": 3.8,
        "base_speed_kmph": 45.0,
        "live_traffic_speed_kmph": 32.0,
        "congestion_index": 0.29,
        "rainfall_mm_hr": 8.0,
        "waterlogging_depth_cm": 5.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": False
    },
    {
        "edge_id": "EDGE-BANJARA-SOMAJIGUDA",
        "road_name": "Banjara Hills Rd 1 - Somajiguda Yashoda",
        "source_node": "NODE_BANJARA_RD12",
        "target_node": "NODE_SOMAJIGUDA",
        "path_coords": [[17.4156, 78.4350], [17.4210, 78.4440], [17.4262, 78.4528]],
        "length_km": 2.9,
        "base_speed_kmph": 40.0,
        "live_traffic_speed_kmph": 26.0,
        "congestion_index": 0.35,
        "rainfall_mm_hr": 9.0,
        "waterlogging_depth_cm": 7.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": False
    },
    {
        "edge_id": "EDGE-GACHI-FINANCIAL",
        "road_name": "Gachibowli - Financial District Wipro Circle",
        "source_node": "NODE_GACHIBOWLI",
        "target_node": "NODE_FINANCIAL_DIST",
        "path_coords": [[17.4400, 78.3500], [17.4280, 78.3450], [17.4180, 78.3410]],
        "length_km": 2.8,
        "base_speed_kmph": 60.0,
        "live_traffic_speed_kmph": 52.0,
        "congestion_index": 0.13,
        "rainfall_mm_hr": 5.0,
        "waterlogging_depth_cm": 2.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": True
    },
    {
        "edge_id": "EDGE-CYBER-KONDAPUR",
        "road_name": "Cyber Towers - Kondapur KIMS Road",
        "source_node": "NODE_HITECH_CYBER",
        "target_node": "NODE_KONDAPUR_RTA",
        "path_coords": [[17.4483, 78.3772], [17.4600, 78.3690], [17.4720, 78.3610]],
        "length_km": 3.6,
        "base_speed_kmph": 45.0,
        "live_traffic_speed_kmph": 34.0,
        "congestion_index": 0.24,
        "rainfall_mm_hr": 8.0,
        "waterlogging_depth_cm": 4.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": True
    },
    {
        "edge_id": "EDGE-KONDAPUR-KUKATPALLY",
        "road_name": "Kondapur - Hafeezpet - Kukatpally Y Junction",
        "source_node": "NODE_KONDAPUR_RTA",
        "target_node": "NODE_KUKATPALLY_Y",
        "path_coords": [[17.4720, 78.3610], [17.4830, 78.3800], [17.4947, 78.3996]],
        "length_km": 4.8,
        "base_speed_kmph": 45.0,
        "live_traffic_speed_kmph": 29.0,
        "congestion_index": 0.36,
        "rainfall_mm_hr": 14.0,
        "waterlogging_depth_cm": 12.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": False
    },
    {
        "edge_id": "EDGE-MADHAPUR-KUKATPALLY",
        "road_name": "Madhapur - Hitec MMTS - Kukatpally Low Line",
        "source_node": "NODE_MADHAPUR_METRO",
        "target_node": "NODE_KUKATPALLY_Y",
        "path_coords": [[17.4490, 78.3910], [17.4700, 78.3950], [17.4947, 78.3996]],
        "length_km": 5.2,
        "base_speed_kmph": 40.0,
        "live_traffic_speed_kmph": 18.0,
        "congestion_index": 0.55,
        "rainfall_mm_hr": 22.0,
        "waterlogging_depth_cm": 35.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": False
    },
    {
        "edge_id": "EDGE-GACHI-JUBILEE-EXPRESS",
        "road_name": "Gachibowli - BioDiversity - Jubilee Hills Outer Link",
        "source_node": "NODE_GACHIBOWLI",
        "target_node": "NODE_JUBILEE_CHECKPOST",
        "path_coords": [[17.4400, 78.3500], [17.4350, 78.3750], [17.4320, 78.4070]],
        "length_km": 6.5,
        "base_speed_kmph": 65.0,
        "live_traffic_speed_kmph": 50.0,
        "congestion_index": 0.23,
        "rainfall_mm_hr": 7.0,
        "waterlogging_depth_cm": 3.0,
        "is_flooded_closed": False,
        "is_shortest_route_corridor": True
    }
]

# Hyderabad Node Spatial Registry
NODE_COORDINATES: Dict[str, Tuple[float, float]] = {
    "NODE_GACHIBOWLI": (17.4400, 78.3500),
    "NODE_MINDSPACE": (17.4435, 78.3820),
    "NODE_HITECH_CYBER": (17.4483, 78.3772),
    "NODE_MADHAPUR_METRO": (17.4490, 78.3910),
    "NODE_JUBILEE_CHECKPOST": (17.4320, 78.4070),
    "NODE_BANJARA_RD12": (17.4156, 78.4350),
    "NODE_SOMAJIGUDA": (17.4262, 78.4528),
    "NODE_FINANCIAL_DIST": (17.4180, 78.3410),
    "NODE_KONDAPUR_RTA": (17.4720, 78.3610),
    "NODE_KUKATPALLY_Y": (17.4947, 78.3996)
}

# Pre-seeded Realistic Incidents
SEEDED_INCIDENTS: List[Dict[str, Any]] = [
    {
        "incident_id": "SOS-101",
        "timestamp": datetime.now(timezone.utc),
        "caller_phone": "+91 98490-11223",
        "caller_type": CallerType.BYSTANDER,
        "raw_audio_transcript": "Emergency! Heavy collision at Gachibowli flyover descent! Two cars crushed, two people unconscious and trapped inside!",
        "raw_text_description": "Severe two-car collision near Gachibowli flyover descent, 2 victims unconscious, heavy bleeding, entrapped in crushed cabin.",
        "uploaded_media_url": None,
        "lat": 17.4400,
        "lng": 78.3500,
        "address": "Gachibowli Flyover Junction, Near Biodiversity Park, Hyderabad",
        "emergency_type": EmergencyType.ROAD_ACCIDENT,
        "victims_count": 2,
        "critical_victims_count": 2,
        "trapped_status": True,
        "fire_smoke_detected": False,
        "water_depth_cm": 0.0,
        "vehicle_deformation_score": 0.85,
        "hazmat_leak": False,
        "severity_score": 92.0,
        "survival_decay_rate_per_min": 3.5,
        "priority_rank": 1,
        "required_resources": {
            "ALS_AMBULANCE": 1,
            "FIRE_TENDER": 0,
            "FLOOD_RESCUE_BOAT": 0,
            "needs_icu": True,
            "needs_ventilator": True,
            "needs_trauma_team": True,
            "blood_units_needed": {"O+": 2, "A+": 1}
        },
        "status": IncidentStatus.ALLOCATED,
        "assigned_unit_ids": ["AMB-101"],
        "assigned_hospital_id": "hosp-1",
        "eta_to_scene_mins": 3.0,
        "eta_to_hospital_mins": 6.0,
        "route_coordinates": [[17.4420, 78.3525], [17.4410, 78.3510], [17.4400, 78.3500]],
        "why_this_ambulance": "Dispatched TS09-EA-1081 (Driver: Ramesh Kumar): closest ALS unit (0.4 km away, 3 mins ETA) with mobile ventilator.",
        "why_this_hospital": "Allocated Care Hospital Hitech City (1.8 km away) as closest Level-1 Trauma Center with 3 verified ICU beds and active trauma team."
    },
    {
        "incident_id": "SOS-102",
        "timestamp": datetime.now(timezone.utc),
        "caller_phone": "+91 98490-44556",
        "caller_type": CallerType.VICTIM,
        "raw_audio_transcript": "My father collapsed suddenly at office desk near Cyber Towers! He is clutching chest, gasping and not responding!",
        "raw_text_description": "58-year-old male sudden cardiac arrest near Madhapur Cyber Towers, gasping for breath, unconscious on floor.",
        "uploaded_media_url": None,
        "lat": 17.4480,
        "lng": 78.3780,
        "address": "Cyber Towers Quad, Hitech City Main Road, Madhapur, Hyderabad",
        "emergency_type": EmergencyType.CARDIAC_ARREST,
        "victims_count": 1,
        "critical_victims_count": 1,
        "trapped_status": False,
        "fire_smoke_detected": False,
        "water_depth_cm": 0.0,
        "vehicle_deformation_score": 0.0,
        "hazmat_leak": False,
        "severity_score": 95.0,
        "survival_decay_rate_per_min": 5.0,
        "priority_rank": 1,
        "required_resources": {
            "ALS_AMBULANCE": 1,
            "FIRE_TENDER": 0,
            "FLOOD_RESCUE_BOAT": 0,
            "needs_icu": True,
            "needs_ventilator": True,
            "needs_cath_lab": True,
            "blood_units_needed": {"B+": 1}
        },
        "status": IncidentStatus.ALLOCATED,
        "assigned_unit_ids": ["AMB-102"],
        "assigned_hospital_id": "hosp-3",
        "eta_to_scene_mins": 2.5,
        "eta_to_hospital_mins": 5.0,
        "route_coordinates": [[17.4405, 78.3750], [17.4450, 78.3770], [17.4480, 78.3780]],
        "why_this_ambulance": "Dispatched TS09-EA-1082: ALS unit equipped with biphasic defibrillator, only 0.9 km away.",
        "why_this_hospital": "Allocated AIG Hospitals Gachibowli: immediate 24/7 cardiac cath lab ready and 5 ICU beds available."
    }
]


# ==============================================================================
# 3. REAL-TIME HYBRID IN-MEMORY & REDIS STATE STORE
# ==============================================================================

class StateStore:
    """
    Centralized Real-Time State Store for PS10 YUKTIK-2026.
    Provides sub-millisecond in-memory lookups, thread-safe mutations,
    dynamic NetworkX graph shortest-path routing, and Redis Pub/Sub syncing.
    """

    def __init__(self, redis_url: Optional[str] = "redis://localhost:6379/0"):
        self._lock = threading.RLock()
        self.redis_client = None
        self.redis_enabled = False

        # Internal collections
        self._incidents: Dict[str, Incident] = {}
        self._units: Dict[str, EmergencyUnit] = {}
        self._hospitals: Dict[str, Hospital] = {}
        self._road_edges: Dict[str, RoadEdge] = {}
        self._weather_state: WeatherState = WeatherState()
        self._road_graph: nx.DiGraph = nx.DiGraph()

        # Attempt Redis connection if library is present
        if REDIS_AVAILABLE and redis_url:
            try:
                client = redis.from_url(redis_url, decode_responses=True, socket_timeout=1.0)
                client.ping()
                self.redis_client = client
                self.redis_enabled = True
                logger.info("Connected to Redis server for distributed real-time state sync.")
            except Exception as e:
                logger.warning("Redis not available on %s (%s). Falling back to pure in-memory state store.", redis_url, e)
                self.redis_client = None
                self.redis_enabled = False

        # Pre-seed initial state
        self.seed_initial_state()

    # --------------------------------------------------------------------------
    # Initial Seeding
    # --------------------------------------------------------------------------
    def seed_initial_state(self) -> None:
        with self._lock:
            # 1. Hospitals
            self._hospitals.clear()
            for h_data in SEEDED_HOSPITALS:
                h = Hospital(**h_data)
                self._hospitals[h.hospital_id] = h

            # 2. Units
            self._units.clear()
            for u_data in SEEDED_UNITS:
                u = EmergencyUnit(**u_data)
                self._units[u.unit_id] = u

            # 3. Road Edges & NetworkX Graph
            self._road_edges.clear()
            self._road_graph.clear()
            for e_data in SEEDED_ROAD_EDGES:
                edge = RoadEdge(**e_data)
                self._road_edges[edge.edge_id] = edge
                self._add_edge_to_graph(edge)

            # 4. Weather & Environmental Context
            self._weather_state = WeatherState(
                timestamp=datetime.now(timezone.utc),
                rainfall_mm_hr=12.5,
                condition="NORMAL FLOW (1.0x)",
                visibility_meters=8500.0,
                flood_alert_level="GREEN",
                hour_of_day=12,
                day_of_week=3,
                is_holiday_event=False,
                zone_accident_risk={
                    "Gachibowli": 0.78,
                    "Madhapur": 0.72,
                    "Hitech City": 0.65,
                    "Jubilee Hills": 0.58,
                    "Banjara Hills": 0.55,
                    "Kukatpally": 0.82
                },
                zone_flood_risk={
                    "Gachibowli": 0.45,
                    "Madhapur": 0.62,
                    "Hitech City": 0.52,
                    "Jubilee Hills": 0.28,
                    "Banjara Hills": 0.32,
                    "Kukatpally": 0.88
                }
            )

            # 5. Seed Incidents
            self._incidents.clear()
            for inc_data in SEEDED_INCIDENTS:
                inc = Incident(**inc_data)
                self._incidents[inc.incident_id] = inc

            logger.info("StateStore pre-seeded successfully: %d hospitals, %d units, %d road edges, %d incidents.",
                        len(self._hospitals), len(self._units), len(self._road_edges), len(self._incidents))

    def _add_edge_to_graph(self, edge: RoadEdge) -> None:
        """
        Adds or updates bidirectional edges in NetworkX with travel time (minutes) as weight.
        """
        speed = max(5.0, edge.live_traffic_speed_kmph)
        # Weight in minutes: (distance_km / speed_kmph) * 60
        travel_time_mins = (edge.length_km / speed) * 60.0
        # If flooded closed, weight is effectively infinite
        if edge.is_flooded_closed:
            travel_time_mins = 99999.0

        # Add directed edge in both directions for arterial road network
        self._road_graph.add_edge(
            edge.source_node,
            edge.target_node,
            edge_id=edge.edge_id,
            road_name=edge.road_name,
            length_km=edge.length_km,
            weight=travel_time_mins,
            is_flooded=edge.is_flooded_closed,
            path_coords=edge.path_coords
        )
        self._road_graph.add_edge(
            edge.target_node,
            edge.source_node,
            edge_id=f"{edge.edge_id}-REV",
            road_name=edge.road_name,
            length_km=edge.length_km,
            weight=travel_time_mins,
            is_flooded=edge.is_flooded_closed,
            path_coords=list(reversed(edge.path_coords))
        )

    # --------------------------------------------------------------------------
    # Incident CRUD Operations
    # --------------------------------------------------------------------------
    def get_incidents(self) -> List[Incident]:
        with self._lock:
            # Sort by severity descending for command center triage queue
            return sorted(self._incidents.values(), key=lambda x: x.severity_score, reverse=True)

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        with self._lock:
            return self._incidents.get(incident_id)

    def add_incident(self, incident: Incident) -> Incident:
        with self._lock:
            self._incidents[incident.incident_id] = incident
            self._publish_update("incident_created", incident.model_dump())
            return incident

    def update_incident(self, incident_id: str, updates: Dict[str, Any]) -> Optional[Incident]:
        with self._lock:
            inc = self._incidents.get(incident_id)
            if not inc:
                return None
            data = inc.model_dump()
            data.update(updates)
            updated_inc = Incident(**data)
            self._incidents[incident_id] = updated_inc
            self._publish_update("incident_updated", updated_inc.model_dump())
            return updated_inc

    # --------------------------------------------------------------------------
    # Emergency Resource Fleet CRUD Operations
    # --------------------------------------------------------------------------
    def get_units(self) -> List[EmergencyUnit]:
        with self._lock:
            return list(self._units.values())

    def get_unit(self, unit_id: str) -> Optional[EmergencyUnit]:
        with self._lock:
            return self._units.get(unit_id)

    def update_unit(self, unit_id: str, updates: Dict[str, Any]) -> Optional[EmergencyUnit]:
        with self._lock:
            unit = self._units.get(unit_id)
            if not unit:
                return None
            data = unit.model_dump()
            data.update(updates)
            updated_unit = EmergencyUnit(**data)
            self._units[unit_id] = updated_unit
            self._publish_update("unit_updated", updated_unit.model_dump())
            return updated_unit

    # --------------------------------------------------------------------------
    # Healthcare Facility CRUD Operations
    # --------------------------------------------------------------------------
    def get_hospitals(self) -> List[Hospital]:
        with self._lock:
            return list(self._hospitals.values())

    def get_hospital(self, hospital_id: str) -> Optional[Hospital]:
        with self._lock:
            return self._hospitals.get(hospital_id)

    def update_hospital(self, hospital_id: str, updates: Dict[str, Any]) -> Optional[Hospital]:
        with self._lock:
            hosp = self._hospitals.get(hospital_id)
            if not hosp:
                return None
            data = hosp.model_dump()
            data.update(updates)
            updated_hosp = Hospital(**data)
            self._hospitals[hospital_id] = updated_hosp
            self._publish_update("hospital_updated", updated_hosp.model_dump())
            return updated_hosp

    # --------------------------------------------------------------------------
    # Road Network Graph Operations
    # --------------------------------------------------------------------------
    def get_road_edges(self) -> List[RoadEdge]:
        with self._lock:
            return list(self._road_edges.values())

    def update_road_edge(self, edge_id: str, updates: Dict[str, Any]) -> Optional[RoadEdge]:
        with self._lock:
            edge = self._road_edges.get(edge_id)
            if not edge:
                return None
            data = edge.model_dump()
            data.update(updates)
            updated_edge = RoadEdge(**data)
            self._road_edges[edge_id] = updated_edge
            self._add_edge_to_graph(updated_edge)
            self._publish_update("road_updated", updated_edge.model_dump())
            return updated_edge

    def get_road_graph(self) -> nx.DiGraph:
        with self._lock:
            return self._road_graph.copy()

    def find_nearest_node(self, lat: float, lng: float) -> str:
        """
        Finds the nearest Hyderabad network node key to given coordinates.
        """
        best_node = "NODE_GACHIBOWLI"
        min_dist = float("inf")
        for node_id, (nlat, nlng) in NODE_COORDINATES.items():
            dist = haversine_km(lat, lng, nlat, nlng)
            if dist < min_dist:
                min_dist = dist
                best_node = node_id
        return best_node

    def calculate_shortest_route(
        self,
        start_lat: float,
        start_lng: float,
        end_lat: float,
        end_lng: float,
        avoid_floods: bool = True
    ) -> Dict[str, Any]:
        """
        Calculates time-optimal route across Hyderabad network considering
        live traffic speeds and waterlogged / flooded roads.
        """
        with self._lock:
            start_node = self.find_nearest_node(start_lat, start_lng)
            end_node = self.find_nearest_node(end_lat, end_lng)

            if start_node == end_node:
                return {
                    "total_distance_km": round(haversine_km(start_lat, start_lng, end_lat, end_lng), 2),
                    "estimated_time_mins": round(max(1.5, haversine_km(start_lat, start_lng, end_lat, end_lng) * 2.2), 1),
                    "path_nodes": [start_node],
                    "route_coordinates": [[start_lat, start_lng], [end_lat, end_lng]],
                    "is_rerouted_for_flooding": False
                }

            # Build sub-graph filtering flooded edges if avoid_floods is True
            graph_to_use = self._road_graph
            if avoid_floods:
                edges_to_keep = [
                    (u, v) for u, v, d in self._road_graph.edges(data=True)
                    if not d.get("is_flooded", False)
                ]
                graph_to_use = self._road_graph.edge_subgraph(edges_to_keep)

            try:
                path = nx.dijkstra_path(graph_to_use, start_node, end_node, weight="weight")
                total_time = nx.dijkstra_path_length(graph_to_use, start_node, end_node, weight="weight")

                coords: List[List[float]] = [[start_lat, start_lng]]
                total_km = haversine_km(start_lat, start_lng, NODE_COORDINATES[start_node][0], NODE_COORDINATES[start_node][1])

                for i in range(len(path) - 1):
                    u, v = path[i], path[i + 1]
                    edge_data = self._road_graph.get_edge_data(u, v)
                    if edge_data and "path_coords" in edge_data:
                        coords.extend(edge_data["path_coords"])
                        total_km += edge_data.get("length_km", 1.0)

                coords.append([end_lat, end_lng])
                total_km += haversine_km(NODE_COORDINATES[end_node][0], NODE_COORDINATES[end_node][1], end_lat, end_lng)

                return {
                    "total_distance_km": round(total_km, 2),
                    "estimated_time_mins": round(max(2.0, total_time), 1),
                    "path_nodes": path,
                    "route_coordinates": coords,
                    "is_rerouted_for_flooding": False
                }
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                # Fallback to direct geodetic routing if disconnected by floods
                direct_dist = haversine_km(start_lat, start_lng, end_lat, end_lng)
                return {
                    "total_distance_km": round(direct_dist, 2),
                    "estimated_time_mins": round(max(2.0, direct_dist * 2.5), 1),
                    "path_nodes": [start_node, end_node],
                    "route_coordinates": [[start_lat, start_lng], [end_lat, end_lng]],
                    "is_rerouted_for_flooding": True
                }

    # --------------------------------------------------------------------------
    # Weather & Environmental Context Operations
    # --------------------------------------------------------------------------
    def get_weather_state(self) -> WeatherState:
        with self._lock:
            return self._weather_state

    def update_weather_state(self, updates: Dict[str, Any]) -> WeatherState:
        with self._lock:
            data = self._weather_state.model_dump()
            data.update(updates)
            self._weather_state = WeatherState(**data)
            self._publish_update("weather_updated", self._weather_state.model_dump())
            return self._weather_state

    # --------------------------------------------------------------------------
    # Redis Pub/Sub Broadcaster
    # --------------------------------------------------------------------------
    def _publish_update(self, event_type: str, payload: Any) -> None:
        if self.redis_enabled and self.redis_client:
            try:
                message = json.dumps({"event": event_type, "timestamp": datetime.now(timezone.utc).isoformat(), "payload": payload}, default=str)
                self.redis_client.publish("medimatch:state_updates", message)
            except Exception as e:
                logger.warning("Failed to publish Redis state update: %s", e)

    # --------------------------------------------------------------------------
    # Full System Snapshot (Compatible with existing frontend /api/state)
    # --------------------------------------------------------------------------
    def get_system_snapshot(self) -> Dict[str, Any]:
        with self._lock:
            incidents_list = [i.model_dump(mode="json") for i in self.get_incidents()]
            units_list = [u.model_dump(mode="json") for u in self._units.values()]
            hospitals_list = [h.model_dump(mode="json") for h in self._hospitals.values()]
            edges_list = [e.model_dump(mode="json") for e in self._road_edges.values()]
            weather_data = self._weather_state.model_dump(mode="json")

            # Format traffic summary compatible with existing frontend traffic banner
            heavy_traffic = weather_data.get("rainfall_mm_hr", 0.0) > 15.0 or any(e["congestion_index"] > 0.6 for e in edges_list)
            multiplier = 1.8 if heavy_traffic else 1.0
            condition = "SEVERE MONSOON GRIDLOCK (1.8x DELAY)" if heavy_traffic else "NORMAL FLOW (1.0x)"

            return {
                "hospitals": hospitals_list,
                "ambulances": units_list,
                "units": units_list,
                "incidents": incidents_list,
                "traffic": {
                    "heavy_traffic": heavy_traffic,
                    "multiplier": multiplier,
                    "condition": condition
                },
                "road_edges": edges_list,
                "weather": weather_data
            }

    def reset_state(self) -> None:
        self.seed_initial_state()


# Global Singleton State Store Instance
state_store = StateStore()
