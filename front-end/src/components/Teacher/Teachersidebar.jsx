import React from "react";

const TeacherSidebar = ({ user, page, setPage, onBack, onLogout }) => {
  const initial = user?.name?.charAt(0).toUpperCase() || "T";

  return (
    <aside className="td-sidebar">
      <div className="td-sidebar__brand">
        <div className="td-sidebar__avatar">{initial}</div>
        <div>
          <div className="td-sidebar__brand-title">Teacher Dashboard</div>
          <div className="td-sidebar__brand-sub">AI Learning</div>
        </div>
      </div>

      <nav className="td-sidebar__nav">
        <button
          className={`td-nav-item ${page === "home" ? "td-nav-item--active" : ""}`}
          onClick={() => setPage("home")}
        >
          <i className="bi bi-house"></i> Home
        </button>
        <button
          className={`td-nav-item ${page === "materials" ? "td-nav-item--active" : ""}`}
          onClick={() => setPage("materials")}
        >
          <i className="bi bi-journal-bookmark"></i> My Materials
        </button>
        <button
          className={`td-nav-item ${page === "profile" ? "td-nav-item--active" : ""}`}
          onClick={() => setPage("profile")}
        >
          <i className="bi bi-person"></i> Profile
        </button>
      </nav>

      <div className="td-sidebar__footer">
        <div className="td-sidebar__user">
          <div className="td-sidebar__user-avatar">{initial}</div>
          <div className="td-sidebar__user-info">
            <div className="td-sidebar__user-name">{user?.name || "Teacher User"}</div>
            <div className="td-sidebar__user-role">Teacher</div>
          </div>
          {/* Bấm → quay về chatbot (onBack) hoặc logout hẳn (onLogout) */}
          <button
            className="td-sidebar__logout"
            title="Logout"
            onClick={onLogout}
          >
            <i className="bi bi-box-arrow-right me-1"></i>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default TeacherSidebar;