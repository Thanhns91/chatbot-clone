import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

/* ── Per-tab chart data ── */
const TAB_DATA = {
  Materials: {
    chartData: [
      { day: "Apr", v: 3 }, { day: "",    v: 5 }, { day: "",    v: 2 },
      { day: "14",  v: 7 }, { day: "",    v: 4 }, { day: "",    v: 6 },
      { day: "21",  v: 8 }, { day: "",    v: 3 }, { day: "28",  v: 5 },
      { day: "May", v: 6 }, { day: "",    v: 9 }, { day: "7",   v: 4 },
      { day: "",    v: 7 }, { day: "14",  v: 5 }, { day: "",    v: 8 },
      { day: "21",  v: 10 },{ day: "28",  v: 6 }, { day: "Jun", v: 9 },
      { day: "",    v: 7 }, { day: "1",   v: 11 },
    ],
    stroke: "#6366f1",
    gradColor: "#6366f1",
    gradId: "gradMaterials",
    totalNum: 18,
    totalLabel: "Total Materials",
    chartTitle: "Materials Uploaded",
    chartSub: "Apr – Jun 2026 · PDF, DOCX, MP4 & more",
  },
  "Student Files": {
    chartData: [
      { day: "Apr", v: 8  }, { day: "",    v: 12 }, { day: "",    v: 6  },
      { day: "14",  v: 15 }, { day: "",    v: 10 }, { day: "",    v: 18 },
      { day: "21",  v: 9  }, { day: "",    v: 14 }, { day: "28",  v: 20 },
      { day: "May", v: 11 }, { day: "",    v: 16 }, { day: "7",   v: 13 },
      { day: "",    v: 22 }, { day: "14",  v: 17 }, { day: "",    v: 19 },
      { day: "21",  v: 25 }, { day: "28",  v: 21 }, { day: "Jun", v: 18 },
      { day: "",    v: 23 }, { day: "1",   v: 28 },
    ],
    stroke: "#22c55e",
    gradColor: "#22c55e",
    gradId: "gradFiles",
    totalNum: 137,
    totalLabel: "Files Submitted",
    chartTitle: "Student File Submissions",
    chartSub: "Apr – Jun 2026 · assignments & uploads per day",
  },
};

const studentUploads = [
  { color: "#22c55e", icon: "bi bi-file-earmark-pdf",  name: "Emma Larson",   file: "Chapter5_Summary.pdf",     date: "Jun 1, 2026",  size: "1.2 MB" },
  { color: "#3b82f6", icon: "bi bi-file-earmark-word", name: "Liam Park",     file: "Essay_Draft_v2.docx",      date: "May 30, 2026", size: "540 KB" },
  { color: "#f59e0b", icon: "bi bi-file-earmark-play", name: "Sofia Nguyen",  file: "Lab_Recording.mp4",        date: "May 28, 2026", size: "32 MB"  },
  { color: "#8b5cf6", icon: "bi bi-file-earmark-text", name: "James Carter",  file: "Homework_Unit3.txt",       date: "May 27, 2026", size: "84 KB"  },
];

const overview = [
  { label: "Materials",     value: 18,  max: 30,  color: "#6366f1" },
  { label: "Student Files", value: 137, max: 150, color: "#22c55e" },
];

const HomeTab = () => {
  const [activeDataTab, setActiveDataTab] = useState("Materials");
  const tabs = ["Materials", "Student Files"];
  const tab = TAB_DATA[activeDataTab];

  return (
    <>
      {/* Chart card */}
      <div className="td-card">
        <div className="td-tabs-row">
          <div className="td-tabs">
            {tabs.map((t) => (
              <button
                key={t}
                className={`td-tab ${activeDataTab === t ? "td-tab--active" : ""}`}
                onClick={() => setActiveDataTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="td-total">
            <div className="td-total__num">{tab.totalNum}</div>
            <div className="td-total__label">{tab.totalLabel}</div>
          </div>
        </div>

        <p className="td-chart-title">{tab.chartTitle}</p>
        <p className="td-chart-sub">{tab.chartSub}</p>

        <div className="td-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tab.chartData} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id={tab.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={tab.gradColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={tab.gradColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: "#8a96a8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "none",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                  fontSize: 13,
                }}
                formatter={(v) => [v]}
                labelFormatter={() => ""}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={tab.stroke}
                strokeWidth={2}
                fill={`url(#${tab.gradId})`}
                dot={false}
                activeDot={{ r: 5, fill: tab.stroke }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="td-bottom-grid">
        {/* Student Uploads */}
        <div className="td-card">
          <div className="td-activity-header">
            <div className="td-section-label">Student Uploads</div>
            <button className="td-preview-btn">
              <i className="bi bi-eye"></i> View All
            </button>
          </div>
          {studentUploads.map((u, i) => (
            <div key={i} className="td-activity-item" style={{ alignItems: "center", gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: u.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: u.color, fontSize: 16,
              }}>
                <i className={u.icon}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1f3a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {u.file}
                </div>
                <div style={{ fontSize: 12, color: "#8a96a8", marginTop: 2 }}>
                  {u.name} · {u.date} · {u.size}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Overview */}
        <div className="td-card">
          <div className="td-section-label">Overview</div>
          {overview.map((o) => (
            <div key={o.label} className="td-overview-item">
              <div className="td-overview-label">
                {o.label} <span>{o.value}</span>
              </div>
              <div className="td-bar-track">
                <div
                  className="td-bar-fill"
                  style={{ width: `${(o.value / o.max) * 100}%`, background: o.color }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default HomeTab;