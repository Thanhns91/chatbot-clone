import { useEffect, useState } from "react";

import "../components/Admin/Admin.css";
import StatsCards from "../components/Admin/StatsCards";
import UserTable from "../components/Admin/UserTable";
import AISettings from "../components/Admin/AISettings";

import {
  getUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
} from "../services/api";

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
  const [users, setUsers] = useState([]);
  const [aiSettings, setAiSettings] = useState(initialAiSettings);
  const [activeTab, setActiveTab] = useState("users");

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const blockedUsers = users.filter((u) => u.status === "blocked").length;

  const reloadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Reload users failed:", error);
    }
  };

  useEffect(() => {
    reloadUsers();
  }, []);

  const handleChangeRole = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      await reloadUsers();
    } catch (error) {
      console.error("Update role failed:", error);
      alert("Update role failed");
    }
  };

  const handleToggleBlock = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === "blocked" ? "active" : "blocked";
      await updateUserStatus(userId, newStatus);
      await reloadUsers();
    } catch (error) {
      console.error("Update status failed:", error);
      alert("Update status failed");
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this user?"
    );

    if (!confirmDelete) return;

    try {
      await deleteUser(userId);
      await reloadUsers();
    } catch (error) {
      console.error("Delete user failed:", error);
      alert("Delete user failed");
    }
  };

  const handleToggleAi = (sid) => {
    setAiSettings((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, on: !s.on } : s))
    );
  };

  return (
    <div className="ad-root">
      <nav className="ad-nav">
        <div className="ad-nav-brand">
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
            <div className="ad-nav-user-name">
              {user?.name || user?.fullName || "Admin"}
            </div>
            <div className="ad-nav-user-role">Administrator</div>
          </div>

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
            <button
              className={`ad-tab-btn ${
                activeTab === "users" ? "ad-tab-btn--active" : ""
              }`}
              onClick={() => setActiveTab("users")}
            >
              <i className="ti ti-users me-2"></i>
              User Management
            </button>

            <button
              className={`ad-tab-btn ${
                activeTab === "ai" ? "ad-tab-btn--active" : ""
              }`}
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
                onDeleteUser={handleDeleteUser}
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