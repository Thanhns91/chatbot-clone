import React, { useState } from 'react';
import './LoginPage.css';

const EyeIcon = ({ open }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const LoginPage = ({ onCancel, onLoginSuccess }) => {
  const [tab, setTab] = useState('signin'); // 'signin' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', confirm: '' });

  const handleSignIn = (e) => {
    e.preventDefault();
    // TODO: connect to authService
    onLoginSuccess?.();
  };

  const handleRegister = (e) => {
    e.preventDefault();
    // TODO: connect to authService
    onLoginSuccess?.();
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        {/* Cancel */}
        <button className="login-cancel" onClick={onCancel}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="13" y2="13"/>
            <line x1="13" y1="1" x2="1" y2="13"/>
          </svg>
          Cancel
        </button>

        {/* App icon */}
        <div className="login-icon">
          <img src="/src/assets/images/1.png" alt="AI Learning" />
        </div>

        {/* Title */}
        <h1 className="login-title">AI Learning</h1>
        <p className="login-subtitle">Sign in to access your learning platform</p>

        {/* Tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${tab === 'signin' ? 'login-tab--active' : ''}`}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            className={`login-tab ${tab === 'register' ? 'login-tab--active' : ''}`}
            onClick={() => setTab('register')}
          >
            Register
          </button>
        </div>

        {/* Sign In Form */}
        {tab === 'signin' && (
          <form className="login-form" onSubmit={handleSignIn}>
            <div className="login-field">
              <label className="login-label">Email</label>
              <input
                type="email"
                className="login-input"
                placeholder="you@example.com"
                value={signInForm.email}
                onChange={e => setSignInForm({ ...signInForm, email: e.target.value })}
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input login-input--password"
                  value={signInForm.password}
                  onChange={e => setSignInForm({ ...signInForm, password: e.target.value })}
                  required
                />
                <button type="button" className="login-eye" onClick={() => setShowPassword(v => !v)}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <button type="submit" className="login-submit">Sign In</button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form className="login-form" onSubmit={handleRegister}>
            <div className="login-field">
              <label className="login-label">Full Name</label>
              <input
                type="text"
                className="login-input"
                placeholder="Your name"
                value={registerForm.name}
                onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Email</label>
              <input
                type="email"
                className="login-input"
                placeholder="you@example.com"
                value={registerForm.email}
                onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input login-input--password"
                  value={registerForm.password}
                  onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                  required
                />
                <button type="button" className="login-eye" onClick={() => setShowPassword(v => !v)}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <div className="login-field">
              <label className="login-label">Confirm Password</label>
              <div className="login-input-wrap">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="login-input login-input--password"
                  value={registerForm.confirm}
                  onChange={e => setRegisterForm({ ...registerForm, confirm: e.target.value })}
                  required
                />
                <button type="button" className="login-eye" onClick={() => setShowConfirm(v => !v)}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>
            <button type="submit" className="login-submit">Register</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;