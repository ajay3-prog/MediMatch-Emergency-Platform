"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ambulance,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  HeartPulse,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Radio,
  Share2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// 1. Emergencies Over Time (Hourly Call Volumes)
const CALLS_OVER_TIME_DATA = [
  { time: "06:00", incidents: 4, critical: 1 },
  { time: "08:00", incidents: 9, critical: 3 },
  { time: "10:00", incidents: 18, critical: 8 },
  { time: "10:30", incidents: 24, critical: 12 }, // Surge
  { time: "12:00", incidents: 14, critical: 5 },
  { time: "14:00", incidents: 11, critical: 4 },
  { time: "16:00", incidents: 16, critical: 6 },
  { time: "18:00", incidents: 22, critical: 9 },
  { time: "20:00", incidents: 15, critical: 4 },
];

// 2. Incidents by Category
const CATEGORY_BREAKDOWN_DATA = [
  { category: "Road Accidents", count: 48, fill: "#2563EB" },
  { category: "Cardiac Arrest", count: 36, fill: "#DC2626" },
  { category: "Urban Flood", count: 28, fill: "#0284C7" },
  { category: "Structural Fire", count: 18, fill: "#F97316" },
  { category: "Trauma / Other", count: 12, fill: "#9333EA" },
];

// 3. Priority Distribution
const PRIORITY_DISTRIBUTION_DATA = [
  { name: "P1 Critical Life-Threat", value: 45, color: "#DC2626" },
  { name: "P2 High Urgency", value: 35, color: "#F97316" },
  { name: "P3 Moderate Care", value: 15, color: "#2563EB" },
  { name: "P4 Standard Non-Urgent", value: 5, color: "#16A34A" },
];

// 4. Resource Utilisation
const RESOURCE_UTILISATION_DATA = [
  { type: "ALS Ambulances", active: 75, available: 25 },
  { type: "BLS Ambulances", active: 60, available: 40 },
  { type: "Fire Tenders", active: 40, available: 60 },
  { type: "Rescue Boats", active: 50, available: 50 },
];

// 5. Response Time Trend (mins)
const RESPONSE_TIME_DATA = [
  { hour: "08:00", responseTime: 8.2, benchmark: 8.0 },
  { hour: "10:00", responseTime: 6.8, benchmark: 8.0 },
  { hour: "10:30", responseTime: 5.9, benchmark: 8.0 }, // Peak AI optimization
  { hour: "12:00", responseTime: 6.4, benchmark: 8.0 },
  { hour: "14:00", responseTime: 6.2, benchmark: 8.0 },
  { hour: "16:00", responseTime: 7.1, benchmark: 8.0 },
  { hour: "18:00", responseTime: 7.5, benchmark: 8.0 },
];

// 6. Hospital Capacity Trends (Occupancy % over 24h)
const HOSPITAL_CAPACITY_DATA = [
  { time: "06:00", AIG: 65, Yashoda: 80, CARE: 70, Apollo: 75 },
  { time: "09:00", AIG: 72, Yashoda: 92, CARE: 76, Apollo: 82 },
  { time: "10:30", AIG: 78, Yashoda: 100, CARE: 85, Apollo: 88 }, // Yashoda 100% full
  { time: "13:00", AIG: 82, Yashoda: 95, CARE: 80, Apollo: 84 },
  { time: "16:00", AIG: 75, Yashoda: 90, CARE: 78, Apollo: 80 },
  { time: "19:00", AIG: 70, Yashoda: 85, CARE: 72, Apollo: 76 },
];

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<string>("TODAY");
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleExportCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Timestamp,Incident_ID,Category,Severity,Response_Time_Mins,Hospital,Assigned_Unit\n" +
      "2026-11-13 10:30:15,INC-2026-101,ROAD_ACCIDENT,92,3.2,AIG Hospitals,AMB-101\n" +
      "2026-11-13 10:30:20,INC-2026-102,CARDIAC_ARREST,97,2.8,AIG Hospitals,AMB-102\n" +
      "2026-11-13 10:30:45,INC-2026-103,URBAN_FLOODING,86,4.5,KIMS Hospital,BOAT-301\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `medimatch_emergency_telemetry_${dateRange.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadNotice("Operational Telemetry CSV successfully exported!");
    setTimeout(() => setDownloadNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Download Alert Notice */}
      {downloadNotice && (
        <div className="fixed top-20 right-6 z-[2000] bg-[#173B65] text-white px-4 py-3 rounded-lg shadow-lg border border-[#2563EB] flex items-center gap-2.5 text-xs font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* ======================================================================
          TOP 5 KPI CARDS
         ====================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Total Emergencies</span>
            <Radio className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F172A]">142</div>
          <span className="text-[11px] text-[#16A34A] block mt-0.5 font-medium">
            +18% surge handled seamlessly
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Avg Response Time</span>
            <Clock className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#16A34A]">6.4 mins</div>
          <span className="text-[11px] text-[#16A34A] block mt-0.5 font-medium">
            -1.6 mins vs 8.0m benchmark
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Critical P1 Ratio</span>
            <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#DC2626]">48.5%</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Survival decay triage</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Ambulance Utilisation</span>
            <Ambulance className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#2563EB]">74.2%</div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Optimal fleet allocation</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
            <span>Hospital ICU Utilisation</span>
            <Building2 className="w-4 h-4 text-[#9333EA]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#9333EA]">82.6%</div>
          <span className="text-[11px] text-[#F97316] block mt-0.5 font-medium">
            Diverted 2 units from saturated ER
          </span>
        </div>
      </div>

      {/* ======================================================================
          TOOLBAR: DATE SELECTOR & EXPORT CSV
         ====================================================================== */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#2563EB]" />
          <span className="text-xs font-bold text-[#173B65]">Reporting Horizon:</span>
          <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-lg text-xs font-semibold">
            {["TODAY", "PAST 7 DAYS", "PAST 30 DAYS"].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 rounded-md transition ${
                  dateRange === range ? "bg-[#173B65] text-white" : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-[#173B65] hover:bg-[#1E4A7E] text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export CSV Telemetry</span>
        </button>
      </div>

      {/* ======================================================================
          6 PROFESSIONAL RECHARTS VISUALIZATIONS GRID
         ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Emergencies Over Time (Area Chart) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
                1. Emergencies Over Time (Hourly Call Volumes)
              </h3>
              <span className="text-[11px] text-[#64748B]">10:30 AM surge clearly visible</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] text-[10px] font-bold">
              Area Trend
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CALLS_OVER_TIME_DATA}>
                <defs>
                  <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="incidents" name="Total Calls" stroke="#2563EB" strokeWidth={2} fill="url(#colorIncidents)" />
                <Area type="monotone" dataKey="critical" name="Critical P1" stroke="#DC2626" strokeWidth={2} fill="url(#colorCritical)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Incidents by Category (Bar Chart) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
                2. Incidents by Emergency Category
              </h3>
              <span className="text-[11px] text-[#64748B]">Distribution of 108 trauma classifications</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold">
              Categorical Bar
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CATEGORY_BREAKDOWN_DATA} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis dataKey="category" type="category" stroke="#94A3B8" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" name="Recorded Incidents" radius={[0, 4, 4, 0]}>
                  {CATEGORY_BREAKDOWN_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Priority Distribution (Donut Chart) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
                3. Triage Priority Distribution (Donut)
              </h3>
              <span className="text-[11px] text-[#64748B]">Clinical survival urgency categorization</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold">
              Urgency Split
            </span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PRIORITY_DISTRIBUTION_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {PRIORITY_DISTRIBUTION_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Resource Utilisation (Stacked Bar Chart) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
                4. Resource Fleet Utilisation %
              </h3>
              <span className="text-[11px] text-[#64748B]">Active deployment vs Standby reserves</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold">
              Fleet Capacity
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RESOURCE_UTILISATION_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="type" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="active" name="% Deployed" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
                <Bar dataKey="available" name="% Available" stackId="a" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Average Response Time Trend (Line Chart) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
                5. Average Response Time Trend (Minutes)
              </h3>
              <span className="text-[11px] text-[#64748B]">Consistently outperforming 8.0 min standard</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] text-[10px] font-bold">
              -25% Response Time
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={RESPONSE_TIME_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} domain={[4, 10]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="responseTime" name="Actual Response (mins)" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="benchmark" name="National Benchmark (8m)" stroke="#94A3B8" strokeDasharray="5 5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 6: Hospital Capacity Trends (Multi-Line Chart) */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#173B65] uppercase tracking-wider">
                6. Hospital ER Occupancy Trends (% 24h)
              </h3>
              <span className="text-[11px] text-[#64748B]">Yashoda peak saturation triggers auto-reroute</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#F3E8FF] text-[#9333EA] text-[10px] font-bold">
              Multi-Facility Load
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={HOSPITAL_CAPACITY_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} domain={[50, 105]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="AIG" name="AIG Gachibowli" stroke="#2563EB" strokeWidth={2} />
                <Line type="monotone" dataKey="Yashoda" name="Yashoda Hospital" stroke="#DC2626" strokeWidth={2} />
                <Line type="monotone" dataKey="CARE" name="CARE Banjara" stroke="#16A34A" strokeWidth={2} />
                <Line type="monotone" dataKey="Apollo" name="Apollo Jubilee" stroke="#9333EA" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
