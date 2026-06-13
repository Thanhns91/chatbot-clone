import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import SettingsModal from "../Layout/SettingModel/SettingsModal";
import "./Member.scss";

const UserAvatar = ({ user, onLogout, onUserUpdated }) => {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const ref = useRef(null);

  const displayName = user?.name || user?.fullName || user?.email || "User";

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <div className="member-avatar__wrap" ref={ref}>
        <Button
          className="member-avatar__btn"
          onClick={() => setOpen((v) => !v)}
          title={displayName}
        >
          {user?.avatar_url || user?.avatarUrl ? (
            <img
              src={user.avatar_url || user.avatarUrl}
              alt="avatar"
              className="member-avatar__img"
            />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </Button>

        {open && (
          <div className="member-avatar__menu">
            <div className="member-avatar__info">
              <strong>{displayName}</strong>
              <span>{user?.email}</span>
              <span className="member-avatar__role-badge">
                {user?.role || "student"}
              </span>
            </div>

            <hr className="member-avatar__divider" />

            <Button
              variant="outline-secondary"
              className="member-avatar__logout"
              onClick={() => {
                setOpen(false);
                setShowSettings(true);
              }}
            >
              <i className="ti ti-settings me-2" />
              Settings
            </Button>

            <Button
              variant="outline-secondary"
              className="member-avatar__logout"
              onClick={() => {
                setOpen(false);
                onLogout?.();
              }}
            >
              <i className="ti ti-logout me-2" />
              Logout
            </Button>
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onSave={(updatedUser) => {
            onUserUpdated?.(updatedUser);
            setShowSettings(false);
          }}
        />
      )}
    </>
  );
};

export default UserAvatar;
