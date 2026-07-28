import { Button } from "react-bootstrap";

const APP_VERSION =
  import.meta.env.VITE_APP_VERSION || "1.0.0";

const NAV = [
  {
    id: "home",
    icon: "bi-house-door-fill",
    label: "Home",
  },
  {
    id: "users",
    icon: "bi-people-fill",
    label: "Users",
  },
  {
    id: "documents",
    icon: "bi-folder2-open",
    label: "Documents",
  },
];

export default function Sidebar({
  active,
  onNav,
  onLogout,
}) {
  return (
    <div className="admin-sidebar">
      <div className="sidebar-brand">
        <div className="d-flex align-items-center gap-2">
          <div className="brand-avatar">
            A
          </div>

          <div>
            <div className="brand-title">
              Admin Dashboard
            </div>

            <div className="brand-sub">
              AI Learning
            </div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${
              active === item.id
                ? "active"
                : ""
            }`}
            onClick={() =>
              onNav(item.id)
            }
          >
            <i
              className={`bi ${item.icon}`}
            />

            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="admin-sidebar__user">
          <div className="footer-avatar">
            A
          </div>

          <div className="admin-sidebar__user-info">
            <div className="footer-name">
              Admin User
            </div>

            <div className="footer-role">
              Administrator
            </div>
          </div>
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

        <div
          className="admin-app-version"
          title={`AI Learning version ${APP_VERSION}`}
        >
          AI Learning v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}