import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

const TAB_META = {
    members: { total: '1,054', label: 'Total Members' },
    teachers: { total: '1', label: 'Total Teachers' },
    documents: { total: '5', label: 'Total Documents' },
}

const ACTIVITIES = [
    { id: 1, color: '#16a34a', text: 'New user', bold: 'John Doe', suffix: 'joined' },
    { id: 2, color: '#2563eb', text: '', bold: 'Teacher User', suffix: 'uploaded a document' },
    { id: 3, color: '#d97706', text: '', bold: 'Member User', suffix: 'asked the AI assistant' },
    { id: 4, color: '#16a34a', text: 'New user', bold: 'Alice', suffix: 'joined' },
]

const OVERVIEW = [
    { label: 'Teachers', count: 1, color: '#2563eb' },
    { label: 'Members', count: 1054, color: '#7c3aed' },
    { label: 'Documents', count: 5, color: '#d97706' },
    { label: 'AI Queries', count: 2400, color: '#16a34a' },
]

const CHART_DATES = ['Apr', '7', '14', '21', '28', 'May', '7', '14', '21', '28', 'Jun', '7']

const genChart = () =>
    Array.from({ length: 75 }, (_, i) => ({ i, v: Math.round(20 + Math.random() * 60) }))

export default function HomePage() {
    const [tab, setTab] = useState('members')
    const chartData = useMemo(genChart, [tab])
    const meta = TAB_META[tab]

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
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Apr – Jun 2026 · daily traffic &amp; uploads</div>
                    </div>

                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="i" hide />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip
                                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                formatter={v => [v, 'Activity']}
                                labelFormatter={() => ''}
                            />
                            <Area type="monotone" dataKey="v" stroke="#818cf8" strokeWidth={1.5}
                                fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#7c3aed' }} />
                        </AreaChart>
                    </ResponsiveContainer>

                    <div className="chart-dates">
                        {CHART_DATES.map((d, i) => <span key={i}>{d}</span>)}
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-md-6">
                        <div className="a-card h-100">
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Recent Activity</div>
                            {ACTIVITIES.map(a => (
                                <div key={a.id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                                    <span className="act-dot" style={{ background: a.color }} />
                                    <span style={{ fontSize: 13 }}>
                                        {a.text && <>{a.text} </>}<strong>{a.bold}</strong> {a.suffix}
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
                                        <div className="ov-bar" style={{ width: `${Math.min((item.count / 1054) * 100, 100)}%`, background: item.color }} />
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