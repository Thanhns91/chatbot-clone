import React, { useState } from 'react';
import ChatLayout from '../layouts/ChatLayout';
import LoginPage from './LoginPage';
import './HomePage.css';

const SparkleIcon = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M36 8 C36 8, 40 28, 56 36 C40 44, 36 64, 36 64 C36 64, 32 44, 16 36 C32 28, 36 8 36 8Z"
      fill="none" stroke="#4f3ef5" strokeWidth="2.8" strokeLinejoin="round"/>
    <path d="M56 10 C56 10, 58 18, 64 21 C58 24, 56 32, 56 32 C56 32, 54 24, 48 21 C54 18, 56 10 56 10Z"
      fill="#4f3ef5" opacity="0.85"/>
    <circle cx="22" cy="16" r="2.5" fill="#4f3ef5" opacity="0.6"/>
  </svg>
);

const HomePage = () => {
  const [conversations, setConversations] = useState([]);
  const [message, setMessage] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const handleNew = () => setConversations([]);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessage('');
  };

  return (
    <>
      {/* Login overlay — hiện khi bấm nút Login */}
      {showLogin && (
        <LoginPage
          onCancel={() => setShowLogin(false)}
          onLoginSuccess={() => {
            setShowLogin(false);
            // TODO: xử lý sau khi đăng nhập thành công
          }}
        />
      )}

      <ChatLayout conversations={conversations} onNew={handleNew}>
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

            {/* ← NÚT LOGIN — bấm để mở LoginPage */}
            <button className="homepage__login-btn" onClick={() => setShowLogin(true)}>
              Login
            </button>

            <button className="homepage__register-btn" onClick={() => setShowLogin(true)}>
              Register
            </button>
          </div>
        </header>

        {/* Main content */}
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
          <button className="homepage__tool-btn" title="Attach file">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <button className="homepage__tool-btn" title="Voice input">
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
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            className={`homepage__send-btn ${message.trim() ? 'homepage__send-btn--active' : ''}`}
            onClick={handleSend}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </ChatLayout>
    </>
  );
};

export default HomePage;