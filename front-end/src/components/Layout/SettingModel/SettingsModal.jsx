import { useState, useEffect } from "react";
import "./SettingsModal.css";

export default function SettingsModal({ user, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState(user ? "profile" : "appearance");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    bio: user?.bio || "",
  });

  // Áp dụng theme lên <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleSave = () => {
    onSave?.({ ...user, ...form });
    onClose?.();
  };

  return (
    <div
      className="sm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="sm-card">
        {/* Header */}
        <div className="sm-header">
          <h2 className="sm-title">Settings</h2>
          <button className="sm-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="sm-tabs">
          {user && (
            <button
              className={`sm-tab ${activeTab === "profile" ? "sm-tab--active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              <i className="bi bi-person"></i>
              Profile
            </button>
          )}
          <button
            className={`sm-tab ${activeTab === "appearance" ? "sm-tab--active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            <i className="bi bi-brightness-high"></i>
            Appearance
          </button>
        </div>

        <div className="sm-body">
          {/* ===== TAB APPEARANCE ===== */}
          {activeTab === "appearance" && (
            <div className="sm-appearance">
              <p className="sm-desc">Choose your preferred interface theme.</p>
              <div className="sm-theme-grid">
                {/* Light */}
                <button
                  className={`sm-theme-card ${theme === "light" ? "sm-theme-card--active" : ""}`}
                  onClick={() => setTheme("light")}
                >
                  <div className="sm-theme-preview sm-theme-preview--light">
                    <i className="bi bi-sun" style={{ fontSize: 28, color: "#f59e0b" }}></i>
                  </div>
                  <div className="sm-theme-info">
                    <span className="sm-theme-name">Light</span>
                    <span className="sm-theme-desc">Default theme</span>
                  </div>
                </button>

                {/* Dark */}
                <button
                  className={`sm-theme-card ${theme === "dark" ? "sm-theme-card--active" : ""}`}
                  onClick={() => setTheme("dark")}
                >
                  <div className="sm-theme-preview sm-theme-preview--dark">
                    <i className="bi bi-moon" style={{ fontSize: 28, color: "#818cf8" }}></i>
                  </div>
                  <div className="sm-theme-info">
                    <span className="sm-theme-name">Dark</span>
                    <span className="sm-theme-desc">Easy on the eyes</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ===== TAB PROFILE ===== */}
          {activeTab === "profile" && user && (
            <div className="sm-profile">
              {/* Avatar */}
              <div className="sm-avatar-wrap">
                <button className="sm-avatar">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </button>
                <span className="sm-avatar-hint">Click to change avatar</span>
              </div>

              {/* Fields */}
              <div className="sm-field">
                <label className="sm-label">Display Name</label>
                <input
                  className="sm-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="sm-field">
                <label className="sm-label">Email</label>
                <input
                  className="sm-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="sm-field">
                <label className="sm-label">Bio</label>
                <textarea
                  className="sm-input sm-textarea"
                  placeholder="Tell us a bit about yourself..."
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>

              <div className="sm-field">
                <label className="sm-label">Role</label>
                <input
                  className="sm-input"
                  value={user.role || "Member"}
                  disabled
                />
              </div>

              <button className="sm-save" onClick={handleSave}>
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}