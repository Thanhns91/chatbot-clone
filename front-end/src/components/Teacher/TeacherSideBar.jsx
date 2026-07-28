import Button from "react-bootstrap/Button";

const APP_VERSION =
  import.meta.env.VITE_APP_VERSION || "1.0.0";

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
    id: "reports",
    icon: "bi-flag-fill",
    label: "Reports",
  },
  {
    id: "profile",
    icon: "bi-person-fill",
    label: "Profile",
  },
];

export default function TeacherSidebar({
  user,
  page,
  setPage,
  onLogout,
}) {
  const displayName =
    user?.fullName ||
    user?.name ||
    "Teacher User";

  const initial =
    displayName.charAt(0).toUpperCase() || "T";

  const avatarUrl =
    user?.avatarUrl ||
    user?.avatar_url ||
    "";

  const renderAvatar = (className) => {
    if (avatarUrl) {
      return (
        <div className={className}>
          <img
            src={avatarUrl}
            alt={`${displayName} avatar`}
          />
        </div>
      );
    }

    return (
      <div className={className}>
        {initial}
      </div>
    );
  };

  return (
    <aside className="td-sidebar">
      <div className="td-sidebar__brand">
        {renderAvatar(
          "td-sidebar__avatar",
        )}

        <div className="td-sidebar__brand-info">
          <div className="td-sidebar__brand-title">
            Teacher Dashboard
          </div>

          <div className="td-sidebar__brand-sub">
            AI Learning
          </div>
        </div>
      </div>

      <nav
        className="td-sidebar__nav"
        aria-label="Teacher navigation"
      >
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`td-nav-item ${
              page === item.id
                ? "active"
                : ""
            }`}
            onClick={() =>
              setPage(item.id)
            }
            aria-current={
              page === item.id
                ? "page"
                : undefined
            }
            title={item.label}
          >
            <i
              className={`bi ${item.icon}`}
            />

            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="td-sidebar__footer">
        <div className="td-sidebar__footer-user">
          {renderAvatar(
            "td-sidebar__user-avatar",
          )}

          <div className="td-sidebar__user-info">
            <div className="td-sidebar__user-name">
              {displayName}
            </div>

            <div className="td-sidebar__user-role">
              Teacher
            </div>
          </div>
        </div>

        <Button
          variant="outline-secondary"
          size="sm"
          className="td-sidebar__logout"
          onClick={onLogout}
          title="Logout"
        >
          <i className="bi bi-box-arrow-right" />
          <span>Logout</span>
        </Button>

        <div
          className="td-sidebar__version"
          title={`AI Learning version ${APP_VERSION}`}
        >
          AI Learning v{APP_VERSION}
        </div>
      </div>
    </aside>
  );
}