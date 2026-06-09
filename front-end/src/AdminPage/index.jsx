import { useState, useEffect, useRef } from "react";
import "./index.css";

/* ─── Initial Data ──────────────────────────────────────── */
const initialUsers = [
  { id: 1, name: "Teacher User", email: "teacher@example.com", role: "Teacher", joinDate: "2025-03-10", status: "active" },
  { id: 2, name: "Member User",  email: "member@example.com",  role: "Member",  joinDate: "2026-08-05", status: "active" },
  { id: 3, name: "John Doe",     email: "john231313@gmail.com",role: "Member",  joinDate: "2026-02-28", status: "active" },
];

const ROLES = [ "Teacher", "Member"];

const initialAiSettings = [
  { id: "webSearch",   label: "Web Search",        desc: "Allow AI to search the web for answers",         on: true  },
  { id: "codeExec",    label: "Code Execution",     desc: "Allow AI to run code snippets",                  on: false },
  { id: "fileUpload",  label: "File Upload",        desc: "Allow users to upload files for AI processing",  on: true  },
  { id: "deepResearch",label: "Deep Research Mode", desc: "Enable extended multi-step AI research chains",  on: false },
];

/* ─── Helpers ───────────────────────────────────────────── */
function StatusBadge({ status }) {
  return (
    <span className={`ad-status-badge ad-status-badge--${status}`}>
      {status}
    </span>
  );
}

/* ─── Inline Role Select ─────────────────────────────────── */
function RoleSelect({ userId, currentRole, onChangeRole }) {
  const mod = currentRole.toLowerCase();
  return (
    <select
      className={`ad-role-select ad-role-select--${mod}`}
      value={currentRole}
      onChange={(e) => onChangeRole(userId, e.target.value)}
    >
      {ROLES.map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}

/* ─── Toggle ────────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <label className="ad-toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="ad-toggle-slider" />
    </label>
  );
}

/* ─── StatCard ──────────────────────────────────────────── */
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

/* ─── User Management Tab ───────────────────────────────── */
function UserManagement({ users, onChangeRole, onToggleBlock }) {
  return (
    <>
      <div className="ad-panel-header">
        <div className="ad-panel-title">All Users</div>
        <div className="ad-panel-count">{users.length} accounts (admin hidden)</div>
      </div>

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                <td>
                  <RoleSelect
                    userId={u.id}
                    currentRole={u.role}
                    onChangeRole={onChangeRole}
                  />
                </td>
                <td style={{ color: "var(--text-secondary)" }}>{u.joinDate}</td>
                <td><StatusBadge status={u.status} /></td>
                <td>
                  {u.status === "active" ? (
                    <button className="ad-block-btn" onClick={() => onToggleBlock(u.id)}>
                      ⊗ Block
                    </button>
                  ) : (
                    <button className="ad-unblock-btn" onClick={() => onToggleBlock(u.id)}>
                      ✔ Unblock
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─── AI Settings Tab ───────────────────────────────────── */
function AiSettings({ settings, onToggle }) {
  return (
    <>
      <div className="ad-panel-header">
        <div className="ad-panel-title">AI Settings</div>
        <div className="ad-panel-count">Configure AI capabilities</div>
      </div>
      <div className="ad-ai-settings">
        {settings.map(s => (
          <div key={s.id} className="ad-setting-row">
            <div>
              <div className="ad-setting-label">{s.label}</div>
              <div className="ad-setting-desc">{s.desc}</div>
            </div>
            <Toggle checked={s.on} onChange={() => onToggle(s.id)} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── AdminDashboard (default export) ───────────────────── */
export default function AdminDashboard() {
  const [users, setUsers]           = useState(initialUsers);
  const [aiSettings, setAiSettings] = useState(initialAiSettings);
  const [activeTab, setActiveTab]   = useState("users");

  const totalUsers   = users.length;
  const activeUsers  = users.filter(u => u.status === "active").length;
  const blockedUsers = users.filter(u => u.status === "blocked").length;

  const handleChangeRole = (id, newRole) =>
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));

  const handleToggleBlock = (id) =>
    setUsers(prev => prev.map(u =>
      u.id === id ? { ...u, status: u.status === "active" ? "blocked" : "active" } : u
    ));

  const handleToggleAi = (settingId) =>
    setAiSettings(prev => prev.map(s => s.id === settingId ? { ...s, on: !s.on } : s));

  return (
    <div className="ad-root">
      {/* ── Navbar ── */}
      <nav className="ad-nav">
        <div className="ad-nav-brand">
          <div className="ad-nav-icon">🛡️</div>
          <div>
            <div className="ad-nav-title">Admin Dashboard</div>
            <div className="ad-nav-subtitle">AI Learning — User &amp; AI Management</div>
          </div>
        </div>
        <div className="ad-nav-right">
          <div>
            <div className="ad-nav-user-name">Admin User</div>
            <div className="ad-nav-user-role">Administrator</div>
          </div>
          <button className="ad-logout-btn">→ Logout</button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="ad-main">
        {/* Stats */}
        <div className="ad-stats-grid">
          <StatCard label="Total Users"   value={totalUsers}   icon="👥" iconMod="blue"  />
          <StatCard label="Active Users"  value={activeUsers}  icon="✅" iconMod="green" />
          <StatCard label="Blocked Users" value={blockedUsers} icon="🚫" iconMod="red"   />
        </div>

        {/* Panel */}
        <div className="ad-panel">
          <div className="ad-panel-tabs">
            <button
              className={`ad-tab-btn ${activeTab === "users" ? "ad-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              👤 User Management
            </button>
            <button
              className={`ad-tab-btn ${activeTab === "ai" ? "ad-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              〜 AI Settings
            </button>
          </div>

          <div className="ad-panel-body">
            {activeTab === "users" ? (
              <UserManagement
                users={users}
                onChangeRole={handleChangeRole}
                onToggleBlock={handleToggleBlock}
              />
            ) : (
              <AiSettings
                settings={aiSettings}
                onToggle={handleToggleAi}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}