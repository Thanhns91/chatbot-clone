import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

const API = 'http://localhost:3000'

export default function HomePage() {
    const [tab, setTab] = useState('members')
    const [stats, setStats] = useState({ members: 0, teachers: 0, documents: 0 })
    const [charts, setCharts] = useState({ memberChart: [], teacherChart: [], documentChart: [] })
    const [recentUsers, setRecentUsers] = useState([])

    useEffect(() => {
        // Fetch stats
        fetch(`${API}/users/stats`)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setStats(data.stats)
                    setCharts(data.charts)
                }
            })
            .catch(console.error)

        // Fetch recent users
        fetch(`${API}/users`)
            .then(r => r.json())
            .then(data => setRecentUsers(data.slice(0, 5)))
            .catch(console.error)
    }, [])

    // Build chart data - fill missing dates with 0
    const buildChartData = (rawData) => {
        const map = {}
        rawData.forEach(d => {
            map[d.date?.split('T')[0] || d.date] = Number(d.count)
        })
        return Array.from({ length: 30 }, (_, i) => {
            const date = new Date()
            date.setDate(date.getDate() - (29 - i))
            const key = date.toISOString().split('T')[0]
            return { date: key, v: map[key] || 0 }
        })
    }

    const chartDataMap = {
        members: buildChartData(charts.memberChart || []),
        teachers: buildChartData(charts.teacherChart || []),
        documents: buildChartData(charts.documentChart || []),
    }

    const TAB_META = {
        members: { total: stats.members, label: 'Total Members' },
        teachers: { total: stats.teachers, label: 'Total Teachers' },
        documents: { total: stats.documents, label: 'Total Documents' },
    }

    const OVERVIEW = [
        { label: 'Teachers', count: stats.teachers, color: '#2563eb' },
        { label: 'Members', count: stats.members, color: '#7c3aed' },
        { label: 'Documents', count: stats.documents, color: '#d97706' },
    ]

    const maxOverview = Math.max(...OVERVIEW.map(o => o.count), 1)
    const chartData = chartDataMap[tab]
    const meta = TAB_META[tab]

    const ACTIVITY_COLORS = {
        admin: '#dc2626',
        teacher: '#2563eb',
        student: '#16a34a',
    }

    return (
        <>
            <div className="admin-topbar">
                <h1>Admin Dashboard</h1>
                <p>AI Learning — User &amp; AI Management</p>
            </div>

            <div className="admin-body">
                <div className="a-card mb-4">
                    <div className="d-flex align-items-start justify-content-between mb-3">
                        <div className="d-flex gap-2">
                            {Object.keys(TAB_META).map(t => (
                                <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="text-end">
                            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{meta.total}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{meta.label}</div>
                        </div>
                    </div>

                    <div className="mb-1">
                        <div style={{ fontWeight: 600, fontSize: 15 }}>Daily Activity</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>30 ngày gần nhất</div>
                    </div>

                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                formatter={v => [v, 'Count']}
                                labelFormatter={l => l}
                            />
                            <Area type="monotone" dataKey="v" stroke="#818cf8" strokeWidth={1.5}
                                fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#7c3aed' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="row g-3">
                    <div className="col-md-6">
                        <div className="a-card h-100">
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Recent Users</div>
                            {recentUsers.length === 0 ? (
                                <p style={{ fontSize: 13, color: '#94a3b8' }}>No users yet</p>
                            ) : recentUsers.map(u => (
                                <div key={u.userId} className="d-flex align-items-center gap-2 py-2 border-bottom">
                                    <span className="act-dot" style={{ background: ACTIVITY_COLORS[u.role] || '#94a3b8' }} />
                                    <span style={{ fontSize: 13 }}>
                                        <strong>{u.fullName}</strong> — {u.role}
                                    </span>
                                    <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
                                        {u.createdAt?.split('T')[0]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="a-card h-100">
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Overview</div>
                            {OVERVIEW.map(item => (
                                <div key={item.label} className="d-flex align-items-center gap-3 py-2 border-bottom">
                                    <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
                                    <div className="ov-bar-wrap">
                                        <div className="ov-bar" style={{
                                            width: `${Math.min((item.count / maxOverview) * 100, 100)}%`,
                                            background: item.color
                                        }} />
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                                        {item.count >= 1000 ? `${(item.count / 1000).toFixed(1)}k` : item.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}