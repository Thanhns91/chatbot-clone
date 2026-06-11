import { useState } from "react";
import ChatLayout from "../components/Layout/ChatLayout";
import AuthButton from "../components/Auth/AuthButton";
import logo7 from "../assets/images/7.png";
import "./HomePage.css";
import { logout } from "../services/authService";
import { useNavigate } from 'react-router-dom'


const UserAvatar = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const initial = user?.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="homepage__avatar-wrap">
      <button
        className="homepage__avatar"
        onClick={() => setOpen(v => !v)}
        title={user?.name}
      >
        {initial}
      </button>

      {open && (
        <div className="homepage__avatar-menu">
          <div className="homepage__avatar-info">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
            <span className="homepage__avatar-role">{user?.role}</span>
          </div>
          <hr className="homepage__avatar-divider" />
          <button className="homepage__avatar-logout" onClick={onLogout}>
            <i className="ti ti-logout me-2"></i>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

const HomePage = () => {
  const [conversations, setConversations] = useState([
    {
      id: 1,
      title: "hello",
      preview: "hello",
      date: "Today",
      messageCount: 2,
      starred: false,
    },
  ]);

  const [activeId, setActiveId] = useState(1);
  const [message, setMessage] = useState("");

  // Đọc từ sessionStorage khi khởi tạo
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  });

  const [showDashboard, setShowDashboard] = useState(() => {
    return sessionStorage.getItem("showDashboard") === "true";
  });

  const navigate = useNavigate()

  const handleLoginSuccess = (role, user) => {
    sessionStorage.setItem("currentUser", JSON.stringify(user));
    sessionStorage.setItem("showDashboard", "true");
    setCurrentUser(user);
    localStorage.setItem("currentUser", JSON.stringify(user)) // quan trọng
    if (role === 'admin') navigate('/admin')
    else if (role === 'teacher') navigate('/teacher')
  }

  const handleLogout = () => {
    logout();
    sessionStorage.clear();
    setCurrentUser(null);
    setShowDashboard(false);
  };

  const handleNew = () => {
    const newConv = {
      id: Date.now(),
      title: "New reflection",
      preview: "",
      date: "Today",
      messageCount: 0,
      starred: false,
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
  };


  return (
    <ChatLayout
      conversations={conversations}
      setConversations={setConversations}
      activeId={activeId}
      onSelect={setActiveId}
      onNew={handleNew}
      currentUser={currentUser}
      headerRight={
        currentUser ? (
          <UserAvatar user={currentUser} onLogout={handleLogout} />
        ) : (
          <AuthButton onLoginSuccess={handleLoginSuccess} />
        )
      }
    >
      <div className="homepage__body">
        <div className="homepage__welcome">
          <img
            src={logo7}
            alt="logo"
            style={{ width: 120, height: 120, objectFit: "contain" }}
          />
          <h1 className="homepage__title">Where should we start?</h1>
          <p className="homepage__subtitle">
            Ask me anything — I am here to help you learn and explore ideas.
          </p>
        </div>
      </div>

      <div className="homepage__input-bar">
        <button className="homepage__tool-btn" title="Attach file">
          <i className="ti ti-paperclip" style={{ fontSize: 18 }}></i>
        </button>
        <button className="homepage__tool-btn" title="Voice input">
          <i className="ti ti-microphone" style={{ fontSize: 18 }}></i>
        </button>
        <input
          className="homepage__input"
          type="text"
          placeholder="Ask anything..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setMessage("")}
        />
        <button
          className={`homepage__send-btn ${message.trim() ? "homepage__send-btn--active" : ""
            }`}
        >
          <i className="ti ti-send" style={{ fontSize: 18 }}></i>
        </button>
      </div>
    </ChatLayout>
  );
};

export default HomePage;  