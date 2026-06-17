import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import "./Header.scss";
import logo7 from "../../../assets/images/7.png";
import SettingsModal from "../SettingModel/SettingsModal";
import {
  getNotifications,
  markNotificationAsRead,
} from "../../../services/api";

function Header({ libraryOpen, onToggleLibrary, headerRight, currentUser }) {
  const [showSettings, setShowSettings] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationRef = useRef(null);

  const loadNotifications = async () => {
    if (!currentUser?.userId) return;

    try {
      const result = await getNotifications(currentUser.userId);

      if (result.success) {
        setNotifications(result.data || []);
        setUnreadCount(result.unreadCount || 0);
      }
    } catch (error) {
      console.log("Cannot load notifications:", error);
    }
  };

  useEffect(() => {
    loadNotifications();

    const timer = setInterval(() => {
      loadNotifications();
    }, 10000);

    return () => clearInterval(timer);
  }, [currentUser?.userId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNotificationClick = async (item) => {
    try {
      await markNotificationAsRead(item.notificationId);

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.notificationId === item.notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );

      if (!item.isRead) {
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }

      if (item.fileUrl) {
        window.open(item.fileUrl, "_blank", "noopener,noreferrer");
      }

      setShowNotifications(false);
    } catch (error) {
      console.log("Cannot read notification:", error);
    }
  };

  return (
    <>
      <Navbar className="chat-header">
        <Container fluid className="header-container">
          <Navbar.Brand className="brand">
            <img src={logo7} alt="logo" className="brand__logo" />
            <span>AI Learning</span>
          </Navbar.Brand>

          <div className="header-actions">
            <Button
              variant="link"
              className={`header-icon-btn ${libraryOpen ? "active" : ""}`}
              title="Library"
              onClick={onToggleLibrary}
            >
              <i className="bi bi-book"></i>
            </Button>

            <Button
              variant="link"
              className="header-icon-btn"
              title="Settings"
              onClick={() => setShowSettings(true)}
            >
              <i className="bi bi-gear"></i>
            </Button>

            <div className="header-notification" ref={notificationRef}>
              <Button
                variant="link"
                className="header-icon-btn header-notification__btn"
                title="Notifications"
                onClick={() => setShowNotifications((prev) => !prev)}
              >
                <i className="bi bi-bell"></i>

                {unreadCount > 0 && (
                  <span className="header-notification__badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>

              {showNotifications && (
                <div className="header-notification__dropdown">
                  <div className="header-notification__head">
                    <strong>Notifications</strong>
                    <span>{unreadCount} unread</span>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="header-notification__empty">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.notificationId}
                        type="button"
                        className={`header-notification__item ${
                          item.isRead ? "" : "is-unread"
                        }`}
                        onClick={() => handleNotificationClick(item)}
                      >
                        <div className="header-notification__icon">
                          <i className="bi bi-file-earmark-text"></i>
                        </div>

                        <div className="header-notification__content">
                          <strong>
                            {item.title || "New teacher material"}
                          </strong>

                          <span>
                            {item.message || "Teacher uploaded a new file."}
                          </span>

                          {item.fileName && <small>{item.fileName}</small>}

                          {item.uploaderName && (
                            <small>Uploaded by {item.uploaderName}</small>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {headerRight}
          </div>
        </Container>
      </Navbar>

      {showSettings && (
        <SettingsModal
          user={currentUser}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => console.log("Profile saved:", updated)}
        />
      )}
    </>
  );
}

export default Header;