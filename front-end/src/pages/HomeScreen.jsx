import { useState, useEffect } from "react";
import { Row, Col } from "react-bootstrap";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  getAdminRevenueStats,
  getDashboardStats,
  getUsers,
} from "../../services/api";

const ACTIVITY_COLORS = {
  admin: "#dc2626",
  teacher: "#2563eb",
  student: "#16a34a",
};

const EMPTY_REVENUE = {
  summary: {
    totalRevenue: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    paidPayments: 0,
    averageOrderValue: 0,
    newSubscriptions: 0,
    upgrades: 0,
  },
  revenueChart: [],
  planRevenue: [],
  recentPayments: [],
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function HomePage() {
  const [tab, setTab] = useState("members");
  const [stats, setStats] = useState({ members: 0, teachers: 0, documents: 0 });
  const [charts, setCharts] = useState({
    memberChart: [],
    teacherChart: [],
    documentChart: [],
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [revenue, setRevenue] = useState(EMPTY_REVENUE);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      const [statsResult, usersResult, revenueResult] = await Promise.allSettled([
        getDashboardStats(),
        getUsers(),
        getAdminRevenueStats(),
      ]);

      if (statsResult.status === "fulfilled" && statsResult.value?.success) {
        setStats(statsResult.value.stats || {});
        setCharts(statsResult.value.charts || {});
      } else if (statsResult.status === "rejected") {
        console.error(statsResult.reason);
      }

      if (usersResult.status === "fulfilled") {
        const usersData = Array.isArray(usersResult.value) ? usersResult.value : [];
        setRecentUsers(usersData.slice(0, 5));
      } else {
        console.error(usersResult.reason);
      }

      if (revenueResult.status === "fulfilled" && revenueResult.value?.success) {
        setRevenue(revenueResult.value.data || EMPTY_REVENUE);
        setRevenueError("");
      } else {
        const reason =
          revenueResult.status === "rejected"
            ? revenueResult.reason
            : new Error("Revenue API returned an invalid response.");

        console.error(reason);
        setRevenueError(reason?.message || "Không thể tải thống kê doanh thu.");
      }

      setRevenueLoading(false);
    };

    loadDashboard();
  }, []);

  const buildChartData = (rawData = []) => {
    const map = {};

    rawData.forEach((d) => {
      map[d.date?.split("T")[0] || d.date] = Number(d.count);
    });

    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));

      const key = date.toISOString().split("T")[0];

      return {
        date: key,
        v: map[key] || 0,
      };
    });
  };

  const buildRevenueChartData = (rawData = []) => {
    const map = {};

    rawData.forEach((item) => {
      const key = String(item.date || "").split("T")[0];

      if (key) {
        map[key] = {
          revenue: Number(item.revenue || 0),
          payments: Number(item.payments || 0),
        };
      }
    });

    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - index));

      const key = date.toISOString().split("T")[0];

      return {
        date: key,
        revenue: map[key]?.revenue || 0,
        payments: map[key]?.payments || 0,
      };
    });
  };

  const chartDataMap = {
    members: buildChartData(charts.memberChart),
    teachers: buildChartData(charts.teacherChart),
    documents: buildChartData(charts.documentChart),
  };

  const TAB_META = {
    members: { total: stats.members, label: "Total Members" },
    teachers: { total: stats.teachers, label: "Total Teachers" },
    documents: { total: stats.documents, label: "Total Documents" },
  };

  const OVERVIEW = [
    { label: "Teachers", count: stats.teachers, color: "#2563eb" },
    { label: "Members", count: stats.members, color: "#7c3aed" },
    { label: "Documents", count: stats.documents, color: "#d97706" },
  ];

  const revenueSummary = revenue.summary || EMPTY_REVENUE.summary;
  const revenueChartData = buildRevenueChartData(revenue.revenueChart);
  const planRevenue = Array.isArray(revenue.planRevenue) ? revenue.planRevenue : [];
  const recentPayments = Array.isArray(revenue.recentPayments)
    ? revenue.recentPayments
    : [];
  const maxPlanRevenue = Math.max(...planRevenue.map((item) => item.revenue), 1);

  const revenueCards = [
    {
      label: "Total Revenue",
      value: formatCurrency(revenueSummary.totalRevenue),
      hint: `${revenueSummary.paidPayments || 0} giao dịch đã thanh toán`,
      icon: "bi bi-wallet2",
      tone: "primary",
    },
    {
      label: "This Month",
      value: formatCurrency(revenueSummary.monthRevenue),
      hint: "Doanh thu tháng hiện tại",
      icon: "bi bi-calendar3",
      tone: "success",
    },
    {
      label: "Today Revenue",
      value: formatCurrency(revenueSummary.todayRevenue),
      hint: "Doanh thu hôm nay",
      icon: "bi bi-cash-coin",
      tone: "warning",
    },
    {
      label: "Average Order",
      value: formatCurrency(revenueSummary.averageOrderValue),
      hint: `${revenueSummary.newSubscriptions || 0} mua mới · ${revenueSummary.upgrades || 0} nâng gói`,
      icon: "bi bi-graph-up-arrow",
      tone: "purple",
    },
  ];

  const maxOverview = Math.max(...OVERVIEW.map((o) => o.count), 1);
  const chartData = chartDataMap[tab];
  const meta = TAB_META[tab];

  return (
    <>
      <div className="admin-topbar">
        <h1>Admin Dashboard</h1>
        <p>AI Learning — User, AI &amp; Revenue Management</p>
      </div>

      <div className="admin-body">
        <div className="a-card mb-4">
          <div className="d-flex align-items-start justify-content-between mb-3">
            <div className="d-flex gap-2">
              {Object.keys(TAB_META).map((t) => (
                <button
                  key={t}
                  className={`tab-btn ${tab === t ? "active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="text-end">
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                {meta.total}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{meta.label}</div>
            </div>
          </div>

          <div className="mb-1">
            <div style={{ fontWeight: 600, fontSize: 15 }}>Daily Activity</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              30 ngày gần nhất
            </div>
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <XAxis dataKey="date" hide />
              <YAxis hide />

              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
                formatter={(v) => [v, "Count"]}
                labelFormatter={(l) => l}
              />

              <Area
                type="monotone"
                dataKey="v"
                stroke="#818cf8"
                strokeWidth={1.5}
                fill="url(#grad)"
                dot={false}
                activeDot={{ r: 4, fill: "#7c3aed" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-section-heading">
          <div>
            <h2>Revenue</h2>
            <p>Chỉ tính giao dịch có trạng thái paid, theo số tiền thực thu.</p>
          </div>
        </div>

        {revenueError && (
          <div className="revenue-error mb-3">
            <i className="bi bi-exclamation-circle" />
            <span>{revenueError}</span>
          </div>
        )}

        <Row className="g-3 mb-4">
          {revenueCards.map((card) => (
            <Col key={card.label} xl={3} md={6}>
              <div className="stat-card revenue-stat-card h-100">
                <div>
                  <div className="stat-label">{card.label}</div>
                  <div className="stat-val revenue-stat-value">
                    {revenueLoading ? "..." : card.value}
                  </div>
                  <div className="revenue-stat-hint">{card.hint}</div>
                </div>

                <div className={`stat-icon revenue-stat-icon revenue-stat-icon--${card.tone}`}>
                  <i className={card.icon} />
                </div>
              </div>
            </Col>
          ))}
        </Row>

        <div className="a-card revenue-chart-card mb-4">
          <div className="revenue-card-header">
            <div>
              <div className="revenue-card-title">Revenue — Last 30 Days</div>
              <div className="revenue-card-subtitle">
                Tổng tiền thực thu từ Payments.finalAmount
              </div>
            </div>

            <div className="revenue-chart-total">
              {formatCurrency(revenueSummary.totalRevenue)}
              <span>Total revenue</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={revenueChartData}
              margin={{ top: 14, right: 6, left: 6, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <XAxis dataKey="date" hide />
              <YAxis hide />

              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
                formatter={(value, name, item) => {
                  if (name === "revenue") {
                    return [formatCurrency(value), "Revenue"];
                  }

                  return [item?.payload?.payments || 0, "Payments"];
                }}
                labelFormatter={(label) => `Ngày ${label}`}
              />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#16a34a"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#15803d" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <Row className="g-3 mb-4">
          <Col lg={5}>
            <div className="a-card h-100">
              <div className="revenue-card-title mb-1">Revenue by Plan</div>
              <div className="revenue-card-subtitle mb-3">
                Doanh thu thực thu theo gói lưu trữ
              </div>

              {planRevenue.length === 0 ? (
                <p className="revenue-empty">Chưa có giao dịch đã thanh toán.</p>
              ) : (
                planRevenue.map((item) => (
                  <div className="plan-revenue-row" key={item.planId ?? item.planName}>
                    <div className="plan-revenue-head">
                      <div>
                        <strong>{item.planName}</strong>
                        <span>{item.payments} giao dịch</span>
                      </div>
                      <b>{formatCurrency(item.revenue)}</b>
                    </div>

                    <div className="plan-revenue-track">
                      <div
                        className="plan-revenue-fill"
                        style={{
                          width: `${Math.max(
                            4,
                            Math.min((item.revenue / maxPlanRevenue) * 100, 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Col>

          <Col lg={7}>
            <div className="a-card h-100">
              <div className="revenue-card-title mb-1">Recent Payments</div>
              <div className="revenue-card-subtitle mb-3">
                8 giao dịch thanh toán thành công gần nhất
              </div>

              {recentPayments.length === 0 ? (
                <p className="revenue-empty">Chưa có payment thành công.</p>
              ) : (
                <div className="revenue-payment-list">
                  {recentPayments.map((payment) => (
                    <div className="revenue-payment-row" key={payment.paymentId}>
                      <div className="revenue-payment-user">
                        <strong>{payment.fullName || "Student"}</strong>
                        <span>{payment.email || "-"}</span>
                      </div>

                      <div className="revenue-payment-plan">
                        <strong>{payment.planName || "Unknown"}</strong>
                        <span>
                          {payment.paymentType === "upgrade"
                            ? "Upgrade"
                            : "New subscription"}
                        </span>
                      </div>

                      <div className="revenue-payment-date">
                        {formatDateTime(payment.paidAt)}
                      </div>

                      <div className="revenue-payment-amount">
                        {formatCurrency(payment.finalAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Col>
        </Row>

        <Row className="g-3">
          <Col md={6}>
            <div className="a-card h-100">
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
                Recent Users
              </div>

              {recentUsers.length === 0 ? (
                <p style={{ fontSize: 13, color: "#94a3b8" }}>No users yet</p>
              ) : (
                recentUsers.map((u) => (
                  <div
                    key={u.userId}
                    className="d-flex align-items-center gap-2 py-2 border-bottom"
                  >
                    <span
                      className="act-dot"
                      style={{
                        background: ACTIVITY_COLORS[u.role] || "#94a3b8",
                      }}
                    />

                    <span style={{ fontSize: 13 }}>
                      <strong>{u.fullName}</strong> — {u.role}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        marginLeft: "auto",
                      }}
                    >
                      {u.createdAt?.split("T")[0]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Col>

          <Col md={6}>
            <div className="a-card h-100">
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
                Overview
              </div>

              {OVERVIEW.map((item) => (
                <div
                  key={item.label}
                  className="d-flex align-items-center gap-3 py-2 border-bottom"
                >
                  <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>

                  <div className="ov-bar-wrap">
                    <div
                      className="ov-bar"
                      style={{
                        width: `${Math.min(
                          (item.count / maxOverview) * 100,
                          100,
                        )}%`,
                        background: item.color,
                      }}
                    />
                  </div>

                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      minWidth: 36,
                      textAlign: "right",
                    }}
                  >
                    {item.count >= 1000
                      ? `${(item.count / 1000).toFixed(1)}k`
                      : item.count}
                  </span>
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </div>
    </>
  );
}
