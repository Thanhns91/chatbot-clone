import { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import ProgressBar from "react-bootstrap/ProgressBar";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ── Per-tab chart data ── */
const TAB_DATA = {
  Materials: {
    chartData: [
      { day: "Apr", v: 3 },
      { day: "", v: 5 },
      { day: "", v: 2 },
      { day: "14", v: 7 },
      { day: "", v: 4 },
      { day: "", v: 6 },
      { day: "21", v: 8 },
      { day: "", v: 3 },
      { day: "28", v: 5 },
      { day: "May", v: 6 },
      { day: "", v: 9 },
      { day: "7", v: 4 },
      { day: "", v: 7 },
      { day: "14", v: 5 },
      { day: "", v: 8 },
      { day: "21", v: 10 },
      { day: "28", v: 6 },
      { day: "Jun", v: 9 },
      { day: "", v: 7 },
      { day: "1", v: 11 },
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
      { day: "Apr", v: 8 },
      { day: "", v: 12 },
      { day: "", v: 6 },
      { day: "14", v: 15 },
      { day: "", v: 10 },
      { day: "", v: 18 },
      { day: "21", v: 9 },
      { day: "", v: 14 },
      { day: "28", v: 20 },
      { day: "May", v: 11 },
      { day: "", v: 16 },
      { day: "7", v: 13 },
      { day: "", v: 22 },
      { day: "14", v: 17 },
      { day: "", v: 19 },
      { day: "21", v: 25 },
      { day: "28", v: 21 },
      { day: "Jun", v: 18 },
      { day: "", v: 23 },
      { day: "1", v: 28 },
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
  {
    color: "#22c55e",
    bgAlpha: "#22c55e18",
    icon: "bi bi-file-earmark-pdf",
    name: "Emma Larson",
    file: "Chapter5_Summary.pdf",
    date: "Jun 1, 2026",
    size: "1.2 MB",
  },
  {
    color: "#3b82f6",
    bgAlpha: "#3b82f618",
    icon: "bi bi-file-earmark-word",
    name: "Liam Park",
    file: "Essay_Draft_v2.docx",
    date: "May 30, 2026",
    size: "540 KB",
  },
  {
    color: "#f59e0b",
    bgAlpha: "#f59e0b18",
    icon: "bi bi-file-earmark-play",
    name: "Sofia Nguyen",
    file: "Lab_Recording.mp4",
    date: "May 28, 2026",
    size: "32 MB",
  },
  {
    color: "#8b5cf6",
    bgAlpha: "#8b5cf618",
    icon: "bi bi-file-earmark-text",
    name: "James Carter",
    file: "Homework_Unit3.txt",
    date: "May 27, 2026",
    size: "84 KB",
  },
];

const overview = [
  { label: "Materials", value: 18, max: 30, color: "#6366f1" },
  { label: "Student Files", value: 137, max: 150, color: "#22c55e" },
];

/* ── Smooth cursor line ── */
const SmoothCursor = ({ points, height, stroke }) => {
  if (!points?.length) return null;
  const x = points[0].x;
  return (
    <g>
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray="5 4"
        opacity={0.55}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
};

/* ── Custom tooltip ── */
const SmoothTooltip = ({ active, payload, stroke }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="td-chart-tooltip" style={{ color: stroke }}>
      {payload[0].value}
    </div>
  );
};

const HomeTab = () => {
  const [activeDataTab, setActiveDataTab] = useState("Materials");
  const tabs = ["Materials", "Student Files"];
  const tab = TAB_DATA[activeDataTab];

  return (
    <>
      {/* Chart card */}
      <Card className="td-card">
        <Card.Body>
          <div className="td-tabs-row">
            <ButtonGroup size="sm">
              {tabs.map((t) => (
                <Button
                  key={t}
                  variant={
                    activeDataTab === t ? "primary" : "outline-secondary"
                  }
                  className="td-tab"
                  onClick={() => setActiveDataTab(t)}
                >
                  {t}
                </Button>
              ))}
            </ButtonGroup>
            <div className="td-total">
              <div className="td-total__num">{tab.totalNum}</div>
              <div className="td-total__label">{tab.totalLabel}</div>
            </div>
          </div>

          <Card.Title className="td-chart-title">{tab.chartTitle}</Card.Title>
          <Card.Subtitle className="td-chart-sub mb-2 text-muted">
            {tab.chartSub}
          </Card.Subtitle>

          <div className="td-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={tab.chartData}
                margin={{ top: 5, right: 10, left: -30, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={tab.gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={tab.gradColor}
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor={tab.gradColor}
                      stopOpacity={0.02}
                    />
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
                  cursor={<SmoothCursor stroke={tab.stroke} height={180} />}
                  content={<SmoothTooltip stroke={tab.stroke} />}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={tab.stroke}
                  strokeWidth={2}
                  fill={`url(#${tab.gradId})`}
                  dot={false}
                  activeDot={{ r: 5, fill: tab.stroke, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card.Body>
      </Card>

      {/* Bottom grid */}
      <Row className="g-3">
        {/* Student Uploads */}
        <Col md={6}>
          <Card className="td-card h-100">
            <Card.Body>
              <div className="td-activity-header">
                <span className="td-section-label">Student Uploads</span>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="td-preview-btn"
                >
                  <i className="bi bi-eye"></i> View All
                </Button>
              </div>
              {studentUploads.map((u, i) => (
                <div key={i} className="td-activity-item">
                  <div
                    className="td-activity-icon"
                    style={{ background: u.bgAlpha, color: u.color }}
                  >
                    <i className={u.icon}></i>
                  </div>
                  <div className="td-activity-file">
                    <div className="td-activity-file__name">{u.file}</div>
                    <div className="td-activity-file__meta">
                      {u.name} · {u.date} · {u.size}
                    </div>
                  </div>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>

        {/* Overview */}
        <Col md={6}>
          <Card className="td-card h-100">
            <Card.Body>
              <div className="td-section-label">Overview</div>
              {overview.map((o) => (
                <div key={o.label} className="td-overview-item">
                  <div className="td-overview-label">
                    {o.label} <span>{o.value}</span>
                  </div>
                  <ProgressBar
                    now={(o.value / o.max) * 100}
                    className="td-bar-track"
                    style={{ "--bs-progress-bar-bg": o.color }}
                  />
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default HomeTab;
