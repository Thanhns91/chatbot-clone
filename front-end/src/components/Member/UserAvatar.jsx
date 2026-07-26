import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import { getUserStorage } from "../../services/api";
import SettingsModal from "../Layout/SettingModel/SettingsModal";
import "./Member.scss";

const UserAvatar = ({ user, onLogout, onUserUpdated }) => {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [currentPlanName, setCurrentPlanName] = useState("Free");
  const ref = useRef(null);

  const displayName = user?.name || user?.fullName || user?.email || "User";
  const avatarUrl = user?.avatar_url || user?.avatarUrl || "";
  const isStudent = user?.role === "student";

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isStudent || !user?.userId) return;

    let cancelled = false;

    const loadCurrentPlan = async () => {
      try {
        const result = await getUserStorage(user.userId);
        if (!cancelled) {
          setCurrentPlanName(result?.data?.plan?.planName || "Free");
        }
      } catch (error) {
        console.error("Cannot load current subscription plan:", error);
      }
    };

    loadCurrentPlan();

    return () => {
      cancelled = true;
    };
  }, [isStudent, user?.userId, open, showUpgrade]);

  const renderMenuAvatar = () => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt="avatar"
          className="member-avatar__menu-avatar-img"
        />
      );
    }

    return displayName.charAt(0).toUpperCase();
  };

  return (
    <>
      <div className="member-avatar__wrap" ref={ref}>
        <Button
          className="member-avatar__btn"
          onClick={() => setOpen((v) => !v)}
          title={displayName}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="member-avatar__img" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </Button>

        {open && (
          <div className="member-avatar__menu">
            <div className="member-avatar__profile-row">
              <div className="member-avatar__menu-avatar">{renderMenuAvatar()}</div>

              <div className="member-avatar__profile-meta">
                <strong>{displayName}</strong>
                <span>{isStudent ? currentPlanName : user?.role || "User"}</span>
              </div>
            </div>

            {isStudent && (
              <button
                type="button"
                className="member-avatar__upgrade"
                onClick={() => {
                  setOpen(false);
                  setShowUpgrade(true);
                }}
              >
                <div className="member-avatar__upgrade-text">
                  <strong>Nâng cấp gói</strong>
                  <span>Xem gói lưu trữ và dung lượng</span>
                </div>
                <i className="bi bi-shop-window" />
              </button>
            )}

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

      {showUpgrade && (
        <SettingsModal
          user={user}
          initialTab="plan"
          planOnly
          onClose={() => setShowUpgrade(false)}
          onSave={(updatedUser) => {
            onUserUpdated?.(updatedUser);
            setShowUpgrade(false);
          }}
        />
      )}
    </>
  );
};

export default UserAvatar;