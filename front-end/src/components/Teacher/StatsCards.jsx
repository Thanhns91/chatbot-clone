import React from "react";

function StatCard({ label, value, icon, iconMod }) {
  return (
    <div className="td-stat-card">
      <div>
        <div className="td-stat-label">{label}</div>
        <div className="td-stat-value">{value}</div>
      </div>
      <div className={`td-stat-icon td-stat-icon--${iconMod}`}>
        <i className={icon}></i>
      </div>
    </div>
  );
}

export default function StatsCards({ pending, approved }) {
  return (
    <div className="td-stats-grid">
      <StatCard
        label="Pending Reviews"
        value={pending}
        icon="ti ti-clock"
        iconMod="yellow"
      />
      <StatCard
        label="Approved Docs"
        value={approved}
        icon="ti ti-circle-check"
        iconMod="green"
      />
      <StatCard
        label="My Materials"
        value={0}
        icon="ti ti-book"
        iconMod="blue"
      />
    </div>
  );
}