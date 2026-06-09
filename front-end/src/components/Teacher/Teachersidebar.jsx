import React from "react";

const TeacherSidebar = ({ user, page, setPage, onLogout }) => {
  const initial = user?.name?.charAt(0).toUpperCase() || "T";

  const navItems = [
    { key: "home",      icon: "bi bi-house",             label: "Home"         },
    { key: "materials", icon: "bi bi-journal-bookmark",  label: "My Materials" },
    { key: "profile",   icon: "bi bi-person",            label: "Profile"      },
  ];

  return (
    <aside className="td-sidebar">
      {/* Brand */}
      <div className="td-sidebar__brand">
        <div className="td-sidebar__avatar">{initial}</div>
        <div>
          <div className="td-sidebar__brand-title">Teacher Dashboard</div>
          <div className="td-sidebar__brand-sub">AI Learning</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="td-sidebar__nav">
        {navItems.map(({ key, icon, label }) => (
          <button
            key={key}
            className={`td-nav-item ${page === key ? "td-nav-item--active" : ""}`}
            onClick={() => setPage(key)}
          >
            <i className={icon}></i>
            {label}
          </button>
        ))}
      </nav>

      {/* Footer — same layout as Admin sidebar-footer */}
      <div className="td-sidebar__footer">
        <div className="td-sidebar__user-avatar">{initial}</div>
        <div className="td-sidebar__user-info">
          <div className="td-sidebar__user-name">{user?.name || "Teacher User"}</div>
          <div className="td-sidebar__user-role">Teacher</div>
        </div>
        <button className="td-sidebar__logout" onClick={onLogout} title="Logout">
          <i className="bi bi-box-arrow-right"></i>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default TeacherSidebar;