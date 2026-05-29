function StatCard({ label, value, icon, iconMod }) {
  return (
    <div className="ad-stat-card">
      <div>
        <div className="ad-stat-label">{label}</div>
        <div className="ad-stat-value">{value}</div>
      </div>
      <div className={`ad-stat-icon ad-stat-icon--${iconMod}`}>{icon}</div>
    </div>
  );
}

export default function StatsCards({ totalUsers, activeUsers, blockedUsers }) {
  return (
    <div className="ad-stats-grid">
      <StatCard label="Total Users" value={totalUsers} icon="👥" iconMod="blue" />
      <StatCard label="Active Users" value={activeUsers} icon="✅" iconMod="green" />
      <StatCard label="Blocked Users" value={blockedUsers} icon="🚫" iconMod="red" />
    </div>
  );
}