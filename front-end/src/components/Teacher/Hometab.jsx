import { useState, useEffect } from 'react'
import { Row, Col } from 'react-bootstrap'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { getTeacherStats } from '../../services/api'

const ACTIVITY_COLORS = {
  materials: '#2563eb',
  studentFiles: '#16a34a',
  approved: '#7c3aed',
  pending: '#d97706',
}

export default function HomeTab() {
  const [tab, setTab] = useState('materials')

  const [stats, setStats] = useState({
    materials: 0,
    studentFiles: 0,
    approved: 0,
    pending: 0,
  })

  const [charts, setCharts] = useState({
    materialChart: [],
    studentChart: [],
  })

  const [recentStudentFiles, setRecentStudentFiles] = useState([])

  useEffect(() => {
    const rawUser =
      localStorage.getItem('currentUser') ||
      sessionStorage.getItem('currentUser')

    const user = rawUser ? JSON.parse(rawUser) : null

    getTeacherStats(user?.userId)
      .then((data) => {
        if (data.success) {
          setStats(data.stats)
          setCharts(data.charts)
          setRecentStudentFiles(data.recentStudentFiles || [])
        }
      })
      .catch(console.error)
  }, [])

  const buildChartData = (rawData) => {
    const map = {}

    rawData.forEach((d) => {
      const key = d.date?.split('T')[0] || d.date
      map[key] = Number(d.count || 0)
    })

    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))

      const key = date.toISOString().split('T')[0]

      return {
        date: key,
        v: map[key] || 0,
      }
    })
  }

  const chartDataMap = {
    materials: buildChartData(charts.materialChart || []),
    studentFiles: buildChartData(charts.studentChart || []),
  }

  const TAB_META = {
    materials: {
      total: stats.materials,
      label: 'Total Materials',
    },
    studentFiles: {
      total: stats.studentFiles,
      label: 'Total Student Files',
    },
  }

  const OVERVIEW = [
    {
      label: 'Materials',
      count: stats.materials,
      color: ACTIVITY_COLORS.materials,
    },
    {
      label: 'Student Files',
      count: stats.studentFiles,
      color: ACTIVITY_COLORS.studentFiles,
    },
    {
      label: 'Approved',
      count: stats.approved,
      color: ACTIVITY_COLORS.approved,
    },
    {
      label: 'Pending',
      count: stats.pending,
      color: ACTIVITY_COLORS.pending,
    },
  ]

  const chartData = chartDataMap[tab]
  const meta = TAB_META[tab]
  const maxOverview = Math.max(...OVERVIEW.map((o) => o.count), 1)

  return (
    <>
      <div className="td-card td-dashboard-chart">
        <div className="td-tabs-row">
          <div className="td-tabs">
            {Object.keys(TAB_META).map((t) => (
              <button
                key={t}
                className={`td-tab ${tab === t ? 'td-tab--active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'materials' ? 'Materials' : 'Student Files'}
              </button>
            ))}
          </div>

          <div className="td-total">
            <div className="td-total__num">{meta.total}</div>
            <div className="td-total__label">{meta.label}</div>
          </div>
        </div>

        <div>
          <h3 className="td-chart-title">Daily Activity</h3>
          <p className="td-chart-sub">30 ngày gần nhất từ database</p>
        </div>

        <div className="td-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="teacherChartGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#818cf8"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="#818cf8"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>

              <XAxis dataKey="date" hide />
              <YAxis hide allowDecimals={false} />

              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
                formatter={(v) => [v, 'Count']}
                labelFormatter={(l) => l}
              />

              <Area
                type="monotone"
                dataKey="v"
                stroke="#818cf8"
                strokeWidth={1.5}
                fill="url(#teacherChartGradient)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: '#7c3aed',
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Row className="g-3">
        <Col md={6}>
          <div className="td-card h-100">
            <div className="td-card-title">Recent Student Uploads</div>

            {recentStudentFiles.length === 0 ? (
              <p className="td-empty-text">No student files yet</p>
            ) : (
              recentStudentFiles.map((file, index) => (
                <div key={index} className="td-activity-row">
                  <span
                    className="td-act-dot"
                    style={{
                      background: ACTIVITY_COLORS.studentFiles,
                    }}
                  />

                  <span className="td-activity-text">
                    <strong>{file.uploaderName || 'Student'}</strong>
                    {' — '}
                    {file.fileName}
                  </span>

                  <span className="td-activity-date">
                    {file.uploadDate?.split('T')[0]}
                  </span>
                </div>
              ))
            )}
          </div>
        </Col>

        <Col md={6}>
          <div className="td-card h-100">
            <div className="td-card-title">Overview</div>

            {OVERVIEW.map((item) => (
              <div key={item.label} className="td-overview-admin-row">
                <span className="td-overview-admin-name">
                  {item.label}
                </span>

                <div className="td-overview-admin-bar-wrap">
                  <div
                    className="td-overview-admin-bar"
                    style={{
                      width: `${Math.min(
                        (item.count / maxOverview) * 100,
                        100
                      )}%`,
                      background: item.color,
                    }}
                  />
                </div>

                <span className="td-overview-admin-count">
                  {item.count >= 1000
                    ? `${(item.count / 1000).toFixed(1)}k`
                    : item.count}
                </span>
              </div>
            ))}
          </div>
        </Col>
      </Row>
    </>
  )
}