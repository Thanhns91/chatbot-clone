import { Row, Col } from 'react-bootstrap'

function StatCard({ label, value, icon, iconMod }) {
  return (
    <div className="ad-stat-card">
      <div>
        <div className="ad-stat-label">{label}</div>
        <div className="ad-stat-value">{value}</div>
      </div>
      <div className={`ad-stat-icon ad-stat-icon--${iconMod}`}>
        <i className={icon} style={{ fontSize: 22 }} />
      </div>
    </div>
  )
}

export default function StatsCards({ totalUsers, activeUsers, blockedUsers }) {
  return (
    <Row className="g-3">
      <Col md={4}>
        <StatCard label="Total Users" value={totalUsers} icon="bi bi-people-fill" iconMod="blue" />
      </Col>
      <Col md={4}>
        <StatCard label="Active Users" value={activeUsers} icon="bi bi-check-circle-fill" iconMod="green" />
      </Col>
      <Col md={4}>
        <StatCard label="Blocked Users" value={blockedUsers} icon="bi bi-slash-circle-fill" iconMod="red" />
      </Col>
    </Row>
  )
}