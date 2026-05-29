import React, { useState } from 'react';

const EyeIcon = ({ open }) =>
  open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const GoogleButton = () => (
  <button type="button" className="auth-google" onClick={() => alert('Google OAuth — not integrated yet')}>
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.08-6.08C34.46 3.1 29.53 1 24 1 14.82 1 7.07 6.48 3.96 14.24l7.08 5.5C12.7 13.48 17.93 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.97-2.2 5.49-4.67 7.19l7.18 5.57C43.44 37.3 46.52 31.38 46.52 24.5z"/>
      <path fill="#FBBC05" d="M11.04 28.26A14.6 14.6 0 0 1 9.5 24c0-1.49.26-2.93.54-4.26l-7.08-5.5A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.54 10.76l8.5-6.5z"/>
      <path fill="#34A853" d="M24 47c5.53 0 10.17-1.83 13.56-4.97l-7.18-5.57C28.6 37.88 26.42 38.5 24 38.5c-6.07 0-11.3-4-13.16-9.5l-8.5 6.5C5.06 43.44 13.9 47 24 47z"/>
    </svg>
    Continue with Google
  </button>
);

const RegisterPage = ({ onCancel, onLoginSuccess, onSwitchToLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [error, setError]               = useState('');
  const [form, setForm]                 = useState({ name: '', email: '', password: '', confirm: '' });

  const handleRegister = (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    onLoginSuccess?.('member', { name: form.name, email: form.email, role: 'member' });
  };

  return (
    <>
      <style>{`
        /* ── shared overlay / card (same as LoginPage) ── */
        .auth-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }

        .auth-card {
          position: relative;
          background: #ffffff;
          border-radius: 20px;
          padding: 36px 40px 32px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 8px 40px rgba(99, 102, 241, 0.12), 0 2px 12px rgba(0,0,0,0.08);
          animation: authSlideUp 0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
        }

        @keyframes authSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }

        .auth-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #f1f5f9;
          border: none;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          transition: background 0.15s, color 0.15s;
        }
        .auth-close:hover { background: #e2e8f0; color: #1e293b; }

        .auth-icon {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }
        .auth-icon img { width: 52px; height: 52px; object-fit: contain; }

        .auth-title {
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px;
          letter-spacing: -0.3px;
        }

        .auth-subtitle {
          text-align: center;
          font-size: 13.5px;
          color: #64748b;
          margin: 0 0 20px;
        }

        .auth-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 16px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          margin-bottom: 16px;
        }
        .auth-google:hover {
          border-color: #c7d2fe;
          background: #f8f9ff;
          box-shadow: 0 2px 8px rgba(99,102,241,0.08);
        }

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }
        .auth-divider__line { flex: 1; height: 1px; background: #e2e8f0; }
        .auth-divider__text {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.08em;
        }

        .auth-error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #e11d48;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 13px;
          margin-bottom: 14px;
        }

        .auth-form { display: flex; flex-direction: column; gap: 14px; }
        .auth-field { display: flex; flex-direction: column; gap: 5px; }

        .auth-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          letter-spacing: 0.01em;
        }

        .auth-input {
          padding: 10px 13px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          color: #0f172a;
          background: #f8fafc;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          outline: none;
          width: 100%;
          box-sizing: border-box;
        }
        .auth-input:focus {
          border-color: #6366f1;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .auth-input--password { padding-right: 42px; }

        .auth-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .auth-input-wrap .auth-input { width: 100%; }

        .auth-eye {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          padding: 0;
          transition: color 0.15s;
        }
        .auth-eye:hover { color: #6366f1; }

        .auth-submit {
          margin-top: 4px;
          padding: 11px;
          background: #6366f1;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          letter-spacing: 0.01em;
        }
        .auth-submit:hover {
          background: #4f46e5;
          box-shadow: 0 4px 16px rgba(99,102,241,0.3);
        }
        .auth-submit:active { transform: scale(0.98); }

        .auth-switch {
          text-align: center;
          font-size: 13px;
          color: #64748b;
          margin: 18px 0 0;
        }
        .auth-switch__link {
          background: none;
          border: none;
          color: #6366f1;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          padding: 0;
          transition: color 0.15s;
        }
        .auth-switch__link:hover { color: #4f46e5; text-decoration: underline; }
      `}</style>

      <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onCancel?.()}>
        <div className="auth-card">

          <button className="auth-close" onClick={onCancel}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>

          <div className="auth-icon">
            <img src="/src/assets/images/1.png" alt="AI Learning" />
          </div>
          <h1 className="auth-title">Create an account</h1>
          <p className="auth-subtitle">Sign up to start learning with AI Learning</p>

          <GoogleButton />

          <div className="auth-divider">
            <span className="auth-divider__line" />
            <span className="auth-divider__text">OR</span>
            <span className="auth-divider__line" />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-field">
              <label className="auth-label">Full name</label>
              <input
                type="text"
                className="auth-input"
                placeholder="John Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input auth-input--password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" className="auth-eye" onClick={() => setShowPassword(v => !v)}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <div className="auth-field">
              <label className="auth-label">Confirm password</label>
              <div className="auth-input-wrap">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="auth-input auth-input--password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  required
                />
                <button type="button" className="auth-eye" onClick={() => setShowConfirm(v => !v)}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>
            <button type="submit" className="auth-submit">Create Account</button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <button type="button" className="auth-switch__link" onClick={onSwitchToLogin}>
              Sign in
            </button>
          </p>

        </div>
      </div>
    </>
  );
};

export default RegisterPage;