import { useState } from "react";
import "../components/Admin/Admin.css";
import StatsCards from "../components/Admin/StatsCards";
import UserTable from "../components/Admin/UserTable";
import AISettings from "../components/Admin/AISettings";

const initialUsers = [
  {
    id: 1,
    name: "Teacher User",
    email: "teacher@example.com",
    role: "Teacher",
    joinDate: "2025-03-10",
    status: "active",
  },
  {
    id: 2,
    name: "Member User",
    email: "member@example.com",
    role: "Member",
    joinDate: "2026-08-05",
    status: "active",
  },
  {
    id: 3,
    name: "John Doe",
    email: "john231313@gmail.com",
    role: "Member",
    joinDate: "2026-02-28",
    status: "active",
  },
];

const initialAiSettings = [
  {
    id: "webSearch",
    label: "Web Search",
    desc: "Allow AI to search the web for answers",
    on: true,
  },
  {
    id: "codeExec",
    label: "Code Execution",
    desc: "Allow AI to run code snippets",
    on: false,
  },
  {
    id: "fileUpload",
    label: "File Upload",
    desc: "Allow users to upload files for AI processing",
    on: true,
  },
  {
    id: "deepResearch",
    label: "Deep Research Mode",
    desc: "Enable extended multi-step AI research chains",
    on: false,
  },
];

export default function AdminPage({ user, onLogout }) {
  const [users, setUsers] = useState(initialUsers);
  const [aiSettings, setAiSettings] = useState(initialAiSettings);
  const [activeTab, setActiveTab] = useState("users");

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const blockedUsers = users.filter((u) => u.status === "blocked").length;

  const handleChangeRole = (id, newRole) =>
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)),
    );

  const handleToggleBlock = (id) =>
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "active" ? "blocked" : "active" }
          : u,
      ),
    );

  const handleToggleAi = (sid) =>
    setAiSettings((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, on: !s.on } : s)),
    );

  return (
    <div className="ad-root">
      <nav className="ad-nav">
        <div className="ad-nav-brand">
          {/* Icon admin */}
          <div className="ad-nav-icon">
            <img
              src="/src/assets/images/5.png"
              alt="Admin"
              width={28}
              height={28}
              style={{ objectFit: "contain" }}
            />
          </div>

          <div>
            <div className="ad-nav-title">Admin Dashboard</div>
            <div className="ad-nav-subtitle">
              AI Learning — User &amp; AI Management
            </div>
          </div>
        </div>

        <div className="ad-nav-right">
          <div>
            <div className="ad-nav-user-name">{user?.name || "Admin User"}</div>
            <div className="ad-nav-user-role">Administrator</div>
          </div>

          {/* Nút logout */}
          <button className="ad-logout-btn" onClick={onLogout}>
            <i className="ti ti-logout me-1"></i>
            Logout
          </button>
        </div>
      </nav>

      <main className="ad-main">
        <StatsCards
          totalUsers={totalUsers}
          activeUsers={activeUsers}
          blockedUsers={blockedUsers}
        />

        <div className="ad-panel">
          <div className="ad-panel-tabs">
            {/* Tab User Management */}
            <button
              className={`ad-tab-btn ${activeTab === "users" ? "ad-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              <i className="ti ti-users me-2"></i>
              User Management
            </button>

            {/* Tab AI Settings */}
            <button
              className={`ad-tab-btn ${activeTab === "ai" ? "ad-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              <i className="ti ti-brain me-2"></i>
              AI Settings
            </button>
          </div>

          <div className="ad-panel-body">
            {activeTab === "users" ? (
              <UserTable
                users={users}
                onChangeRole={handleChangeRole}
                onToggleBlock={handleToggleBlock}
              />
            ) : (
              <AISettings settings={aiSettings} onToggle={handleToggleAi} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
