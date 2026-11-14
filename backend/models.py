"""
PS10: Intelligent Real-Time Emergency Coordination and Dynamic Resource Allocation Platform (YUKTIK-2026)
Data Layer: Pydantic v2 domain schemas, PostGIS/PostgreSQL ORM schemas, and spatial DDL definitions.
"""

from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel, Field, ConfigDict, model_validator
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    JSON,
    Text,
)
from sqlalchemy.orm import declarative_base
from geoalchemy2 import Geometry


# ==============================================================================
# 1. CORE ENUMERATIONS
# ==============================================================================

class CallerType(str, Enum):
    VICTIM = "VICTIM"
    BYSTANDER = "BYSTANDER"
    OPERATOR_108 = "OPERATOR_108"
    IOT_SENSOR = "IOT_SENSOR"


class EmergencyType(str, Enum):
    ROAD_ACCIDENT = "ROAD_ACCIDENT"
    CARDIAC_ARREST = "CARDIAC_ARREST"
    FIRE = "FIRE"
    URBAN_FLOODING = "URBAN_FLOODING"
    NATURAL_DISASTER = "NATURAL_DISASTER"


class IncidentStatus(str, Enum):
    REPORTED = "REPORTED"
    ALLOCATED = "ALLOCATED"
    EN_ROUTE = "EN_ROUTE"
    ON_SCENE = "ON_SCENE"
    TRANSPORTING = "TRANSPORTING"
    RESOLVED = "RESOLVED"


class UnitType(str, Enum):
    ALS_AMBULANCE = "ALS_AMBULANCE"
    BLS_AMBULANCE = "BLS_AMBULANCE"
    FIRE_TENDER = "FIRE_TENDER"
    FLOOD_RESCUE_BOAT = "FLOOD_RESCUE_BOAT"


class OperationalStatus(str, Enum):
    IDLE = "IDLE"
    EN_ROUTE_TO_INCIDENT = "EN_ROUTE_TO_INCIDENT"
    ON_SCENE = "ON_SCENE"
    TRANSPORTING_TO_HOSPITAL = "TRANSPORTING_TO_HOSPITAL"
    UNAVAILABLE_BREAKDOWN = "UNAVAILABLE_BREAKDOWN"


# ==============================================================================
# 2. EMBEDDED SUBMODELS
# ==============================================================================

class UnitEquipment(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    has_defibrillator: bool = Field(..., description="Equipped with automated external / manual biphasic defibrillator")
    has_ventilator: bool = Field(..., description="Equipped with invasive/non-invasive transport ventilator")
    oxygen_cylinders: int = Field(..., ge=0, description="Number of pressurized medical oxygen cylinders onboard")
    paramedic_count: int = Field(..., ge=0, description="Certified Emergency Medical Technicians / paramedics onboard")
    carrying_capacity: int = Field(..., ge=1, description="Number of patients / evacuees that can be transported simultaneously")


class BloodBankStock(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    A_pos: int = Field(default=0, alias="A+")
    A_neg: int = Field(default=0, alias="A-")
    B_pos: int = Field(default=0, alias="B+")
    B_neg: int = Field(default=0, alias="B-")
    O_pos: int = Field(default=0, alias="O+")
    O_neg: int = Field(default=0, alias="O-")
    AB_pos: int = Field(default=0, alias="AB+")
    AB_neg: int = Field(default=0, alias="AB-")


# ==============================================================================
# 3. PYDANTIC DOMAIN MODELS
# ==============================================================================

class Incident(BaseModel):
    """
    Incident Domain Model with complete AI triage extraction, dynamic priority scoring,
    and PostGIS compatible spatial coordinates.
    """
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    # 1. Base Caller & Telemetry Parameters
    incident_id: str = Field(..., description="Unique alphanumeric identifier (e.g. SOS-101, INC-HYD-001)")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="UTC timestamp of the incident report")
    caller_phone: str = Field(..., description="Verified phone number of reporting entity")
    caller_type: CallerType = Field(..., description="Origin source category: VICTIM, BYSTANDER, OPERATOR_108, IOT_SENSOR")
    raw_audio_transcript: Optional[str] = Field(default=None, description="Speech-to-text transcript from 108 voice call")
    raw_text_description: str = Field(..., description="Text description provided by caller or transcribed by dispatcher")
    uploaded_media_url: Optional[str] = Field(default=None, description="URL or base64 data URI of accident scene photo/video")
    lat: float = Field(..., ge=-90.0, le=90.0, description="WGS84 Latitude")
    lng: float = Field(..., ge=-180.0, le=180.0, description="WGS84 Longitude")
    address: str = Field(..., description="Human-readable Hyderabad landmark or street address")

    # 2. AI Extracted Fields (Gemini 2.5 Flash Multimodal Emergency Triage)
    emergency_type: EmergencyType = Field(..., description="Categorized emergency type")
    victims_count: int = Field(default=1, ge=0, description="Estimated total number of casualties on scene")
    critical_victims_count: int = Field(default=0, ge=0, description="Casualties with life-threatening hemodynamic instability")
    trapped_status: bool = Field(default=False, description="Whether victims require heavy hydraulic extrication")
    fire_smoke_detected: bool = Field(default=False, description="Thermal or visual smoke/fire confirmed on scene")
    water_depth_cm: float = Field(default=0.0, ge=0.0, description="Urban flood or waterlogging depth in centimeters")
    vehicle_deformation_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Normalized crash deformation index from computer vision (0.0-1.0)")
    hazmat_leak: bool = Field(default=False, description="Presence of chemical, gas, or flammable hazmat leakage")

    # 3. AI Priority & Resource Dispatch Fields
    severity_score: float = Field(..., ge=0.0, le=100.0, description="AI calculated severity index (0.0 to 100.0)")
    survival_decay_rate_per_min: float = Field(..., ge=0.0, description="Estimated survival percentage decay rate per elapsed minute")
    priority_rank: int = Field(..., ge=1, le=5, description="1 (P1 Immediate Life Threat) down to 5 (P5 Non-urgent)")
    required_resources: Dict[str, Any] = Field(
        default_factory=dict,
        description="Dictionary defining required fleet vehicle types, counts, and hospital facility capabilities"
    )
    status: IncidentStatus = Field(default=IncidentStatus.REPORTED, description="State lifecycle status of emergency")
    assigned_unit_ids: List[str] = Field(default_factory=list, description="IDs of emergency fleet units currently dispatched")
    assigned_hospital_id: Optional[str] = Field(default=None, description="Target healthcare facility allocated for casualty transfer")
    eta_to_scene_mins: Optional[float] = Field(default=None, ge=0.0, description="Estimated time of arrival to scene in minutes")
    eta_to_hospital_mins: Optional[float] = Field(default=None, ge=0.0, description="Estimated transit time from scene to hospital in minutes")
    route_coordinates: List[List[float]] = Field(
        default_factory=list,
        description="Waypoints list of [lat, lng] pairs representing optimal dispatch and transport route"
    )

    # 4. Backward Compatibility Aliases & UI Helpers
    id: Optional[str] = Field(default=None, description="Alias for incident_id")
    description: Optional[str] = Field(default=None, description="Alias for raw_text_description")
    photo_url: Optional[str] = Field(default=None, description="Alias for uploaded_media_url")
    triage: Optional[Dict[str, Any]] = Field(default=None, description="Detailed JSON triage summary for frontend UI")
    decision_log: Optional[Dict[str, Any]] = Field(default=None, description="XAI mathematical reasoning and candidate scoring log")
    assigned_ambulance: Optional[Dict[str, Any]] = Field(default=None, description="Dispatched unit snapshot for frontend compatibility")
    assigned_hospital: Optional[Dict[str, Any]] = Field(default=None, description="Allocated hospital snapshot for frontend compatibility")
    rerouted: bool = Field(default=False, description="Whether incident was dynamically rerouted due to capacity/congestion")
    rerouted_from: List[str] = Field(default_factory=list, description="List of hospitals rejected due to zero capacity")
    why_this_ambulance: Optional[str] = Field(default=None, description="Explainable AI dispatch narrative")
    why_this_hospital: Optional[str] = Field(default=None, description="Explainable AI hospital allocation narrative")

    @model_validator(mode="after")
    def sync_aliases(self) -> Incident:
        if not self.id:
            self.id = self.incident_id
        if not self.description:
            self.description = self.raw_text_description
        if not self.photo_url and self.uploaded_media_url:
            self.photo_url = self.uploaded_media_url
        return self


class EmergencyUnit(BaseModel):
    """
    Emergency Resource Fleet Unit Domain Model.
    Covers ALS Cardiac Ambulances, BLS Ambulances, Fire Tenders, and Flood Rescue Boats.
    """
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    unit_id: str = Field(..., description="Unique fleet unit identifier (e.g. AMB-101, FIR-201, BOAT-301)")
    unit_type: UnitType = Field(..., description="ALS_AMBULANCE, BLS_AMBULANCE, FIRE_TENDER, FLOOD_RESCUE_BOAT")
    lat: float = Field(..., ge=-90.0, le=90.0, description="Current WGS84 Latitude")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Current WGS84 Longitude")
    heading: float = Field(default=0.0, ge=0.0, le=360.0, description="Current compass heading in degrees (0-360)")
    speed_kmph: float = Field(default=0.0, ge=0.0, description="Real-time telematics speed in km/h")
    operational_status: OperationalStatus = Field(
        default=OperationalStatus.IDLE,
        description="IDLE, EN_ROUTE_TO_INCIDENT, ON_SCENE, TRANSPORTING_TO_HOSPITAL, UNAVAILABLE_BREAKDOWN"
    )
    can_be_preempted: bool = Field(
        ...,
        description="True if unit can be preempted for a higher-priority emergency (IDLE or EN_ROUTE without patient)"
    )
    assigned_incident_id: Optional[str] = Field(default=None, description="Active emergency incident ID if currently dispatched")
    target_hospital_id: Optional[str] = Field(default=None, description="Destination hospital ID if in transit with patient")
    current_route: List[List[float]] = Field(
        default_factory=list,
        description="Active GPS navigation route as list of [lat, lng] coordinates"
    )
    equipment: UnitEquipment = Field(..., description="Medical, fire rescue, or flood life-support payload configuration")
    fuel_pct: float = Field(default=100.0, ge=0.0, le=100.0, description="Remaining fuel / battery percentage (0.0-100.0)")

    # Metadata & UI convenience fields
    id: Optional[str] = Field(default=None, description="Alias for unit_id")
    code: Optional[str] = Field(default=None, description="Official registration plate (e.g. TS09-EA-1081)")
    driver_name: Optional[str] = Field(default=None, description="Designated vehicle pilot / driver")
    driver_phone: Optional[str] = Field(default=None, description="Emergency pilot contact phone")
    paramedic: Optional[str] = Field(default=None, description="Lead paramedic or rescue commander on board")
    rating: Optional[str] = Field(default="4.9★", description="Service & trauma performance rating")
    station_zone: Optional[str] = Field(default=None, description="Home base zone (Gachibowli, Madhapur, Hitech City, etc.)")
    status: Optional[str] = Field(default=None, description="Frontend display status alias (AVAILABLE, DISPATCHED, ON_SCENE)")

    @model_validator(mode="after")
    def sync_unit_fields(self) -> EmergencyUnit:
        if not self.id:
            self.id = self.unit_id
        if not self.status:
            if self.operational_status == OperationalStatus.IDLE:
                self.status = "AVAILABLE"
            elif self.operational_status in (OperationalStatus.EN_ROUTE_TO_INCIDENT, OperationalStatus.TRANSPORTING_TO_HOSPITAL):
                self.status = "DISPATCHED"
            elif self.operational_status == OperationalStatus.ON_SCENE:
                self.status = "ON_SCENE"
            else:
                self.status = "UNAVAILABLE"
        # Ensure can_be_preempted logic matches operational constraints:
        # True if IDLE or EN_ROUTE_TO_INCIDENT (no patient aboard), False if ON_SCENE or TRANSPORTING
        if self.operational_status in (OperationalStatus.ON_SCENE, OperationalStatus.TRANSPORTING_TO_HOSPITAL, OperationalStatus.UNAVAILABLE_BREAKDOWN):
            self.can_be_preempted = False
        return self


class Hospital(BaseModel):
    """
    Healthcare Facility / Major Hyderabad Hospital Domain Model.
    Tracks live bed capacities, cath labs, trauma teams, and blood bank stock.
    """
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    hospital_id: str = Field(..., description="Unique hospital identifier (e.g. HOSP-01, hosp-1)")
    name: str = Field(..., description="Full hospital name (e.g. AIG Hospitals Gachibowli)")
    lat: float = Field(..., ge=-90.0, le=90.0, description="WGS84 Latitude")
    lng: float = Field(..., ge=-180.0, le=180.0, description="WGS84 Longitude")
    accepting_emergencies: bool = Field(default=True, description="Whether hospital is accepting emergency intake")
    icu_beds_available: int = Field(..., ge=0, description="Real-time vacant Intensive Care Unit beds")
    icu_beds_total: int = Field(..., ge=1, description="Total licensed ICU bed capacity")
    er_beds_available: int = Field(..., ge=0, description="Real-time vacant Emergency Room trauma observation beds")
    general_beds_available: int = Field(..., ge=0, description="Real-time vacant Inpatient General Ward beds")
    burn_beds_available: int = Field(..., ge=0, description="Specialized Burn ICU / isolation beds available")
    ventilators_available: int = Field(..., ge=0, description="Operational invasive mechanical ventilators available")
    has_cath_lab: bool = Field(..., description="Active 24/7 cardiac catheterization laboratory for primary PCI")
    has_trauma_team: bool = Field(..., description="Level-1/Level-2 dedicated on-duty trauma resuscitation surgical team")
    er_waiting_time_mins: int = Field(..., ge=0, description="Average intake waiting time in emergency triage in minutes")
    incoming_ambulances_count: int = Field(default=0, ge=0, description="Number of ambulances currently en route to this ER")
    blood_bank_stock: Dict[str, int] = Field(
        ...,
        description="Current blood inventory units categorized by group (A+, A-, B+, B-, O+, O-, AB+, AB-)"
    )
    predicted_load_next_2hrs_pct: float = Field(
        ..., ge=0.0, le=100.0,
        description="Predictive surge AI estimation of bed occupancy in next 120 minutes (0-100%)"
    )

    # Backward compatibility and UI helpers
    id: Optional[str] = Field(default=None, description="Alias for hospital_id")
    specialty: Optional[str] = Field(default="Level-1 Trauma & Emergency Care", description="Primary clinical specialty")
    icu_beds: Optional[int] = Field(default=None, description="Alias for icu_beds_available")
    max_icu: Optional[int] = Field(default=None, description="Alias for icu_beds_total")
    general_beds: Optional[int] = Field(default=None, description="Alias for general_beds_available")
    ventilators: Optional[int] = Field(default=None, description="Alias for ventilators_available")

    @model_validator(mode="after")
    def sync_hospital_aliases(self) -> Hospital:
        if not self.id:
            self.id = self.hospital_id
        if self.icu_beds is None:
            self.icu_beds = self.icu_beds_available
        if self.max_icu is None:
            self.max_icu = self.icu_beds_total
        if self.general_beds is None:
            self.general_beds = self.general_beds_available
        if self.ventilators is None:
            self.ventilators = self.ventilators_available
        return self


class RoadEdge(BaseModel):
    """
    Hyderabad Road Network Graph Edge Model.
    Maintains real-time speed, congestion indices, monsoon flood states, and corridor priority.
    """
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    edge_id: str = Field(..., description="Unique edge identifier (e.g. EDGE-GACHI-HITECH-01)")
    road_name: str = Field(..., description="Name of arterial road / corridor (e.g. Gachibowli - Hitech City ISB Rd)")
    source_node: str = Field(..., description="Source intersection or landmark node key")
    target_node: str = Field(..., description="Target intersection or landmark node key")
    path_coords: List[List[float]] = Field(..., description="List of [lat, lng] waypoints representing the road geometry")
    length_km: float = Field(..., gt=0.0, description="Segment distance in kilometers")
    base_speed_kmph: float = Field(..., gt=0.0, description="Free-flow speed limit in km/h")
    live_traffic_speed_kmph: float = Field(..., ge=0.0, description="Current monitored speed in km/h from Google/telematics")
    congestion_index: float = Field(..., ge=0.0, le=1.0, description="Congestion score (0.0 = free flow, 1.0 = gridlock)")
    rainfall_mm_hr: float = Field(default=0.0, ge=0.0, description="Precipitation rate over road segment in mm/hour")
    waterlogging_depth_cm: float = Field(default=0.0, ge=0.0, description="Accumulated water depth on road surface in cm")
    is_flooded_closed: bool = Field(default=False, description="True if closed to low-clearance vehicles due to flooding (>30cm)")
    is_shortest_route_corridor: bool = Field(default=False, description="Designated emergency green corridor priority route")


class WeatherState(BaseModel):
    """
    Environmental, Temporal, and Historical Context Model for Hyderabad City.
    Provides city-wide precipitation, visibility, and zone-specific risk indices.
    """
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Current observation timestamp")
    rainfall_mm_hr: float = Field(default=0.0, ge=0.0, description="City-wide average rainfall rate in mm/hour")
    condition: str = Field(default="NORMAL FLOW (1.0x)", description="Human-readable weather status")
    visibility_meters: float = Field(default=10000.0, ge=0.0, description="Horizontal meteorological visibility in meters")
    flood_alert_level: str = Field(default="GREEN", description="Disaster management alert level: GREEN, YELLOW, ORANGE, RED")
    hour_of_day: int = Field(default=12, ge=0, le=23, description="Hour of the day (0-23) for temporal congestion models")
    day_of_week: int = Field(default=3, ge=0, le=6, description="Day of week (0 = Monday, 6 = Sunday)")
    is_holiday_event: bool = Field(default=False, description="True if public holiday, IPL match, or large cultural gathering")
    zone_accident_risk: Dict[str, float] = Field(
        default_factory=dict,
        description="Historical accident frequency multiplier by zone (0.0 to 1.0)"
    )
    zone_flood_risk: Dict[str, float] = Field(
        default_factory=dict,
        description="Historical topography flood vulnerability score by zone (0.0 to 1.0)"
    )


# ==============================================================================
# 4. POSTGIS / POSTGRESQL SQLALCHEMY SPATIAL SCHEMAS
# ==============================================================================

Base = declarative_base()


class IncidentTable(Base):
    """
    PostgreSQL / PostGIS compatible spatial table for emergency incidents.
    Uses PostGIS GEOMETRY(Point, 4326) for fast spatial queries.
    """
    __tablename__ = "incidents"

    incident_id = Column(String(64), primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    caller_phone = Column(String(32), nullable=False)
    caller_type = Column(String(32), nullable=False)
    raw_audio_transcript = Column(Text, nullable=True)
    raw_text_description = Column(Text, nullable=False)
    uploaded_media_url = Column(Text, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String(256), nullable=False)

    # PostGIS Spatial Column: Point (SRID 4326 = WGS84)
    geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=True), nullable=True)

    emergency_type = Column(String(32), nullable=False)
    victims_count = Column(Integer, default=1)
    critical_victims_count = Column(Integer, default=0)
    trapped_status = Column(Boolean, default=False)
    fire_smoke_detected = Column(Boolean, default=False)
    water_depth_cm = Column(Float, default=0.0)
    vehicle_deformation_score = Column(Float, default=0.0)
    hazmat_leak = Column(Boolean, default=False)

    severity_score = Column(Float, nullable=False)
    survival_decay_rate_per_min = Column(Float, nullable=False)
    priority_rank = Column(Integer, nullable=False)
    required_resources = Column(JSON, nullable=False)
    status = Column(String(32), default="REPORTED", index=True)
    assigned_unit_ids = Column(JSON, default=list)
    assigned_hospital_id = Column(String(64), nullable=True)
    eta_to_scene_mins = Column(Float, nullable=True)
    eta_to_hospital_mins = Column(Float, nullable=True)
    route_coordinates = Column(JSON, default=list)


class EmergencyUnitTable(Base):
    """
    PostgreSQL / PostGIS compatible spatial table for emergency fleet units.
    """
    __tablename__ = "emergency_units"

    unit_id = Column(String(64), primary_key=True, index=True)
    unit_type = Column(String(32), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    heading = Column(Float, default=0.0)
    speed_kmph = Column(Float, default=0.0)
    operational_status = Column(String(32), default="IDLE", index=True)
    can_be_preempted = Column(Boolean, default=True)
    assigned_incident_id = Column(String(64), nullable=True)
    target_hospital_id = Column(String(64), nullable=True)
    fuel_pct = Column(Float, default=100.0)
    equipment = Column(JSON, nullable=False)

    # Spatial columns
    geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=True), nullable=True)
    route_geom = Column(Geometry(geometry_type="LINESTRING", srid=4326, spatial_index=True), nullable=True)


class HospitalTable(Base):
    """
    PostgreSQL / PostGIS compatible spatial table for hospital capacities.
    """
    __tablename__ = "hospitals"

    hospital_id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    accepting_emergencies = Column(Boolean, default=True)
    icu_beds_available = Column(Integer, nullable=False)
    icu_beds_total = Column(Integer, nullable=False)
    er_beds_available = Column(Integer, nullable=False)
    general_beds_available = Column(Integer, nullable=False)
    burn_beds_available = Column(Integer, nullable=False)
    ventilators_available = Column(Integer, nullable=False)
    has_cath_lab = Column(Boolean, nullable=False)
    has_trauma_team = Column(Boolean, nullable=False)
    er_waiting_time_mins = Column(Integer, nullable=False)
    incoming_ambulances_count = Column(Integer, default=0)
    blood_bank_stock = Column(JSON, nullable=False)
    predicted_load_next_2hrs_pct = Column(Float, nullable=False)

    geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=True), nullable=True)


class RoadEdgeTable(Base):
    """
    PostgreSQL / PostGIS compatible spatial table for road edges with Linestring geometry.
    """
    __tablename__ = "road_edges"

    edge_id = Column(String(64), primary_key=True, index=True)
    road_name = Column(String(128), nullable=False)
    source_node = Column(String(64), nullable=False, index=True)
    target_node = Column(String(64), nullable=False, index=True)
    length_km = Column(Float, nullable=False)
    base_speed_kmph = Column(Float, nullable=False)
    live_traffic_speed_kmph = Column(Float, nullable=False)
    congestion_index = Column(Float, nullable=False)
    rainfall_mm_hr = Column(Float, default=0.0)
    waterlogging_depth_cm = Column(Float, default=0.0)
    is_flooded_closed = Column(Boolean, default=False)
    is_shortest_route_corridor = Column(Boolean, default=False)

    geom = Column(Geometry(geometry_type="LINESTRING", srid=4326, spatial_index=True), nullable=True)


# ==============================================================================
# 5. POSTGIS DDL GENERATOR SCRIPT
# ==============================================================================

def generate_postgis_ddl() -> str:
    """
    Generates standalone, production-ready PostgreSQL + PostGIS DDL script
    with GIST spatial indexing for ultra-fast spatial emergency queries.
    """
    return """
-- =====================================================================
-- PS10 YUKTIK-2026: PostGIS Spatial Schema & Indexing Initialization
-- Hyderabad Emergency Coordination & Dynamic Resource Allocation
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. INCIDENTS TABLE
CREATE TABLE IF NOT EXISTS incidents (
    incident_id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    caller_phone VARCHAR(32) NOT NULL,
    caller_type VARCHAR(32) NOT NULL,
    raw_audio_transcript TEXT,
    raw_text_description TEXT NOT NULL,
    uploaded_media_url TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    address VARCHAR(256) NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
    emergency_type VARCHAR(32) NOT NULL,
    victims_count INT NOT NULL DEFAULT 1,
    critical_victims_count INT NOT NULL DEFAULT 0,
    trapped_status BOOLEAN NOT NULL DEFAULT FALSE,
    fire_smoke_detected BOOLEAN NOT NULL DEFAULT FALSE,
    water_depth_cm DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    vehicle_deformation_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    hazmat_leak BOOLEAN NOT NULL DEFAULT FALSE,
    severity_score DOUBLE PRECISION NOT NULL,
    survival_decay_rate_per_min DOUBLE PRECISION NOT NULL,
    priority_rank INT NOT NULL,
    required_resources JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'REPORTED',
    assigned_unit_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    assigned_hospital_id VARCHAR(64),
    eta_to_scene_mins DOUBLE PRECISION,
    eta_to_hospital_mins DOUBLE PRECISION,
    route_coordinates JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_incidents_spatial_gist ON incidents USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents (severity_score DESC);

-- 2. EMERGENCY RESOURCE FLEET TABLE
CREATE TABLE IF NOT EXISTS emergency_units (
    unit_id VARCHAR(64) PRIMARY KEY,
    unit_type VARCHAR(32) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    speed_kmph DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'IDLE',
    can_be_preempted BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_incident_id VARCHAR(64),
    target_hospital_id VARCHAR(64),
    current_route JSONB NOT NULL DEFAULT '[]'::jsonb,
    equipment JSONB NOT NULL,
    fuel_pct DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE INDEX IF NOT EXISTS idx_units_spatial_gist ON emergency_units USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_units_status ON emergency_units (operational_status);
CREATE INDEX IF NOT EXISTS idx_units_preempt ON emergency_units (can_be_preempted);

-- 3. HOSPITALS TABLE
CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accepting_emergencies BOOLEAN NOT NULL DEFAULT TRUE,
    icu_beds_available INT NOT NULL,
    icu_beds_total INT NOT NULL,
    er_beds_available INT NOT NULL,
    general_beds_available INT NOT NULL,
    burn_beds_available INT NOT NULL,
    ventilators_available INT NOT NULL,
    has_cath_lab BOOLEAN NOT NULL DEFAULT TRUE,
    has_trauma_team BOOLEAN NOT NULL DEFAULT TRUE,
    er_waiting_time_mins INT NOT NULL,
    incoming_ambulances_count INT NOT NULL DEFAULT 0,
    blood_bank_stock JSONB NOT NULL DEFAULT '{}'::jsonb,
    predicted_load_next_2hrs_pct DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE INDEX IF NOT EXISTS idx_hospitals_spatial_gist ON hospitals USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hospitals_icu ON hospitals (icu_beds_available);

-- 4. ROAD EDGES & GRAPH TABLE
CREATE TABLE IF NOT EXISTS road_edges (
    edge_id VARCHAR(64) PRIMARY KEY,
    road_name VARCHAR(128) NOT NULL,
    source_node VARCHAR(64) NOT NULL,
    target_node VARCHAR(64) NOT NULL,
    path_coords JSONB NOT NULL,
    length_km DOUBLE PRECISION NOT NULL,
    base_speed_kmph DOUBLE PRECISION NOT NULL,
    live_traffic_speed_kmph DOUBLE PRECISION NOT NULL,
    congestion_index DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    rainfall_mm_hr DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    waterlogging_depth_cm DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    is_flooded_closed BOOLEAN NOT NULL DEFAULT FALSE,
    is_shortest_route_corridor BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_road_edges_source ON road_edges (source_node);
CREATE INDEX IF NOT EXISTS idx_road_edges_target ON road_edges (target_node);
CREATE INDEX IF NOT EXISTS idx_road_edges_flooded ON road_edges (is_flooded_closed);
""".strip()
