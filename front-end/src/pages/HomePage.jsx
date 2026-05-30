import { useState } from "react";
import ChatLayout from '../components/Layout/ChatLayout';
import AuthButton from "../components/Auth/AuthButton";
import TeacherPage from './TeacherPage';
import logo7 from '../assets/images/7.png';
import './HomePage.css';

/* Avatar tròn lấy chữ cái đầu của tên, click để logout */
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
  const [conversations, setConversations] = useState([]);
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const handleLoginSuccess = (role, user) => setCurrentUser(user);
  const handleLogout = () => setCurrentUser(null);

  if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher')) {
    return <TeacherPage user={currentUser} onLogout={handleLogout} />;
  }

  return (
    <ChatLayout conversations={conversations} onNew={() => setConversations([])}>

      {/* Header */}
      <header className="homepage__header">
        <div className="homepage__brand">
          <img
            src={logo7}
            alt="logo"
            style={{ width: 28, height: 28, objectFit: "contain" }}
          />
          <span className="homepage__brand-name">AI Learning</span>
        </div>

        <div className="homepage__header-actions">

          {/* Nút Settings */}
          <button className="homepage__icon-btn" title="Settings">
            <i className="ti ti-settings" style={{ fontSize: 20 }}></i>
          </button>

          {/* Nút Notifications */}
          <button className="homepage__icon-btn" title="Notifications">
            <i className="ti ti-bell" style={{ fontSize: 20 }}></i>
          </button>

          {/* Chưa login → AuthButton | Đã login → avatar */}
          {currentUser ? (
            <UserAvatar user={currentUser} onLogout={handleLogout} />
          ) : (
            <AuthButton onLoginSuccess={handleLoginSuccess} />
          )}
        </div>
      </header>

      {/* Welcome */}
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

      {/* Input bar */}
      <div className="homepage__input-bar">

        {/* Nút đính kèm file */}
        <button className="homepage__tool-btn" title="Attach file">
          <i className="ti ti-paperclip" style={{ fontSize: 18 }}></i>
        </button>

        {/* Nút mic */}
        <button className="homepage__tool-btn" title="Voice input">
          <i className="ti ti-microphone" style={{ fontSize: 18 }}></i>
        </button>

        <input
          className="homepage__input"
          type="text"
          placeholder="Write what you think..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setMessage('')}
        />

        {/* Nút gửi */}
        <button
          className={`homepage__send-btn ${message.trim() ? 'homepage__send-btn--active' : ''}`}
        >
          <i className="ti ti-send" style={{ fontSize: 18 }}></i>
        </button>

      </div>
    </ChatLayout>
  );
};

export default HomePage;