import { Button } from "react-bootstrap";

const NAV = [
  { id: "home", icon: "bi-house-door-fill", label: "Home" },
  { id: "users", icon: "bi-people-fill", label: "Users" },
  { id: "documents", icon: "bi-folder2-open", label: "Documents" },
  { id: "ai", icon: "bi-robot", label: "AI Settings" },
];

export default function Sidebar({ active, onNav, onLogout }) {
  return (
    <div className="admin-sidebar">
      <div className="sidebar-brand">
        <div className="d-flex align-items-center gap-2">
          <div className="brand-avatar">A</div>
          <div>
            <div className="brand-title">Admin Dashboard</div>
            <div className="brand-sub">AI Learning</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${active === n.id ? "active" : ""}`}
            onClick={() => onNav(n.id)}
          >
            <i className={`bi ${n.icon}`} />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-avatar">A</div>
        <div>
          <div className="footer-name">Admin User</div>
          <div className="footer-role">Administrator</div>
        </div>
        <Button
          variant="outline-secondary"
          size="sm"
          className="logout-btn"
          title="Logout"
          onClick={onLogout}
        >
          <i className="bi bi-box-arrow-right" />
          Logout
        </Button>
      </div>
    </div>
  );
}
