import Button from "react-bootstrap/Button";

const NAV = [
  {
    id: "home",
    icon: "bi-house-door-fill",
    label: "Home",
  },
  {
    id: "materials",
    icon: "bi-folder2-open",
    label: "My Materials",
  },
  {
    id: "summary",
    icon: "bi-chat-dots-fill",
    label: "Student Summary",
  },
  {
    id: "student-files",
    icon: "bi-folder-symlink-fill",
    label: "Student Files",
  },
  {
    id: "profile",
    icon: "bi-person",
    label: "Profile",
  },
];

export default function TeacherSidebar({ user, page, setPage, onLogout }) {
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
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`td-nav-item ${page === n.id ? "active" : ""}`}
            onClick={() => setPage(n.id)}
          >
            <i className={`bi ${n.icon}`} />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="td-sidebar__footer">
        <div className="td-sidebar__user-avatar">{initial}</div>

        <div className="td-sidebar__user-info">
          <div className="td-sidebar__user-name">
            {user?.name || "Teacher User"}
          </div>
          <div className="td-sidebar__user-role">Teacher</div>
        </div>

        <Button
          variant="outline-secondary"
          size="sm"
          className="td-sidebar__logout"
          onClick={onLogout}
          title="Logout"
        >
          <i className="bi bi-box-arrow-right" />
          Logout
        </Button>
      </div>
    </aside>
  );
}