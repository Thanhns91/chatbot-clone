import { useState } from "react";

const ProfileTab = ({ user }) => {
  const [theme, setTheme] = useState("light");
  const initial = user?.name?.charAt(0).toUpperCase() || "T";

  return (
    <>
      {/* Personal Info */}
      <div className="td-card">
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1f3a", marginBottom: 20 }}>
          Personal Information
        </div>

        <div className="td-avatar-row">
          <div className="td-profile-avatar">{initial}</div>
          <div>
            <button className="td-change-photo-btn">
              <i className="bi bi-camera"></i> Change Photo
            </button>
            <div className="td-photo-hint">JPG, PNG or GIF · max 5MB</div>
          </div>
        </div>

        <div className="td-profile-grid">
          <div>
            <label className="td-form-label">Full Name</label>
            <input className="td-form-input" defaultValue={user?.name || "Teacher User"} />
          </div>
          <div>
            <label className="td-form-label">Email</label>
            <input className="td-form-input" defaultValue={user?.email || "teacher@ailearning.edu"} />
          </div>
          <div>
            <label className="td-form-label">School</label>
            <input className="td-form-input" defaultValue="Westview Academy" />
          </div>
          <div>
            <label className="td-form-label">Subject</label>
            <input className="td-form-input" defaultValue="Mathematics" />
          </div>
          <div className="td-profile-grid--full">
            <label className="td-form-label">Bio</label>
            <textarea
              className="td-form-textarea"
              defaultValue="I've been teaching math for over 8 years with a focus on making abstract concepts approachable for every student."
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button className="td-save-btn">Save Changes</button>
        </div>
      </div>

      {/* Appearance */}
      <div className="td-card">
        <div className="td-appearance-title">
          <i className="bi bi-sun"></i> Appearance
        </div>
        <p className="td-appearance-sub">Choose your preferred interface theme.</p>
        <div className="td-theme-grid">
          <div
            className={`td-theme-card ${theme === "light" ? "td-theme-card--active" : ""}`}
            onClick={() => setTheme("light")}
          >
            <div className="td-theme-preview td-theme-preview--light">☀️</div>
            <div className="td-theme-info">
              <div className="td-theme-name">Light</div>
              <div className="td-theme-desc">Default theme</div>
            </div>
          </div>
          <div
            className={`td-theme-card ${theme === "dark" ? "td-theme-card--active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            <div className="td-theme-preview td-theme-preview--dark">🌙</div>
            <div className="td-theme-info">
              <div className="td-theme-name">Dark</div>
              <div className="td-theme-desc">Easy on the eyes</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileTab;