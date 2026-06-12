import { useState } from "react";
import "./Auth.css";
import { login } from "../../services/authService";

const DEMO_ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@example.com",
    password: "admin123",
    color: "red",
  },
  {
    role: "Teacher",
    email: "teacher@example.com",
    password: "teacher123",
    color: "blue",
  },
  {
    role: "Member",
    email: "member@example.com",
    password: "member123",
    color: "green",
  },
];

export default function LoginPage({
  onCancel,
  onLoginSuccess,
  onSwitchToRegister,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const fillDemo = (acc) => {
    setForm({ email: acc.email, password: acc.password });
    setError("");
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    setError("");
    const result = login(form.email, form.password);
    if (!result.success) {
      setError(result.message);
      return;
    }
    onLoginSuccess?.(result.user.role, result.user);
  };

  return (
    <div
      className="auth-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <div className="auth-card">
        {/* Nút đóng */}
        <button className="auth-close" onClick={onCancel}>
          <i className="bi bi-x"></i>
        </button>

        {/* Logo */}
        <div className="auth-icon">
          <img src="/src/assets/images/1.png" alt="AI Learning" />
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your AI Learning account</p>

        {/* Nút đăng nhập Google */}
        <button
          type="button"
          className="auth-google"
          onClick={() => alert("Google OAuth — not integrated yet")}
        >
          <img
            src="/src/assets/images/4.png"
            alt="Google"
            width={20}
            height={20}
          />
          Continue with Google
        </button>

        {/* Đường kẻ phân cách */}
        <div className="auth-divider">
          <span className="auth-divider__line" />
          <span className="auth-divider__text">OR</span>
          <span className="auth-divider__line" />
        </div>

        {/* Hiển thị lỗi nếu có */}
        {error && (
          <div className="auth-error">
            <i className="bi bi-exclamation-circle me-2"></i>
            {error}
          </div>
        )}

        {/* Form đăng nhập */}
        <form className="auth-form" onSubmit={handleSignIn}>
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
                type={showPassword ? "text" : "password"}
                className="auth-input auth-input--password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((v) => !v)}
              >
                <i
                  className={showPassword ? "bi bi-eye-slash" : "bi bi-eye"}
                ></i>
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit">
            Sign In
          </button>
        </form>

        {/* Chuyển sang trang đăng ký */}
        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            className="auth-switch__link"
            onClick={onSwitchToRegister}
          >
            Register now
          </button>
        </p>

        {/* Tài khoản demo */}
        <div className="auth-demo">
          <p className="auth-demo__label">DEMO ACCOUNTS</p>
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.role}
              type="button"
              className={`auth-demo__item auth-demo__item--${acc.color}`}
              onClick={() => fillDemo(acc)}
            >
              <span className="auth-demo__role">{acc.role}</span>
              <span className="auth-demo__info">
                {acc.email} / {acc.password}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
