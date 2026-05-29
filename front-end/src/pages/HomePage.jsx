import React, { useState } from 'react';
import ChatLayout from '../components/Layout/ChatLayout';
import AuthButton from "../components/Auth/AuthButton";
import TeacherPage from './TeacherPage';
import './HomePage.css';

const SparkleIcon = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <path d="M36 8C36 8 40 28 56 36C40 44 36 64 36 64C36 64 32 44 16 36C32 28 36 8 36 8Z"
      fill="none" stroke="#4f3ef5" strokeWidth="2.8" strokeLinejoin="round"/>
    <path d="M56 10C56 10 58 18 64 21C58 24 56 32 56 32C56 32 54 24 48 21C54 18 56 10 56 10Z"
      fill="#4f3ef5" opacity="0.85"/>
    <circle cx="22" cy="16" r="2.5" fill="#4f3ef5" opacity="0.6"/>
  </svg>
);

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
          <button
            className="homepage__avatar-logout"
            onClick={onLogout}
          >
            → Logout
          </button>
        </div>
      )}
    </div>
  );
};

const HomePage = () => {
  const [conversations, setConversations] = useState([]);
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null); // null = chưa đăng nhập

  const handleLoginSuccess = (role, user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => setCurrentUser(null);

  // Admin/Teacher → sang trang riêng
  if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher')) {
    return <TeacherPage user={currentUser} onLogout={handleLogout} />;
  }

  return (
    <ChatLayout conversations={conversations} onNew={() => setConversations([])}>
      {/* Header */}
      <header className="homepage__header">
        <div className="homepage__brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f3ef5" strokeWidth="2.2">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/>
          </svg>
          <span className="homepage__brand-name">AI Learning</span>
        </div>

        <div className="homepage__header-actions">
          <button className="homepage__icon-btn" title="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button className="homepage__icon-btn" title="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
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
          <SparkleIcon />
          <h1 className="homepage__title">Where should we start?</h1>
          <p className="homepage__subtitle">
            Ask me anything — I am here to help you learn and explore ideas.
          </p>
        </div>
      </div>

      {/* Input bar */}
      <div className="homepage__input-bar">
        <button className="homepage__tool-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <button className="homepage__tool-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        <input
          className="homepage__input"
          type="text"
          placeholder="Write what you think..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setMessage('')}
        />
        <button className={`homepage__send-btn ${message.trim() ? 'homepage__send-btn--active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </ChatLayout>
  );
};

export default HomePage;