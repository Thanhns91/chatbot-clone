import { useState } from "react";
import "./Auth.scss";
import { auth, googleProvider } from "../../fireBase/firebase";
import { signInWithPopup } from "firebase/auth";

import logoImg from "../../assets/images/1.png";
import googleImg from "../../assets/images/4.png";

const API = import.meta.env.VITE_API_URL;

export default function RegisterPage({
  onCancel,
  onLoginSuccess,
  onSwitchToLogin,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const handleGoogleLogin = async () => {
    try {
      if (!API) {
        setError("Thiếu VITE_API_URL. Hãy kiểm tra Environment Variables.");
        return;
      }

      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      const res = await fetch(`${API}/auth/google-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: firebaseUser.email,
          fullName: firebaseUser.displayName,
          uid: firebaseUser.uid,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Đăng nhập Google thất bại");
        return;
      }

      sessionStorage.setItem("currentUser", JSON.stringify(data.user));
      sessionStorage.setItem("showDashboard", "true");
      onLoginSuccess?.(data.user.role, data.user);
    } catch (err) {
      setError("Đăng nhập Google thất bại. Vui lòng thử lại.");
      console.error(err);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!API) {
      setError("Thiếu VITE_API_URL. Hãy kiểm tra Environment Variables.");
      return;
    }

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Đăng ký thất bại.");
        return;
      }

      const loginRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const loginData = await loginRes.json();

      if (!loginData.success) {
        setError(loginData.message || "Đăng nhập sau đăng ký thất bại.");
        return;
      }

      sessionStorage.setItem("currentUser", JSON.stringify(loginData.user));
      sessionStorage.setItem("showDashboard", "true");
      onLoginSuccess?.(loginData.user.role, loginData.user);
    } catch (err) {
      setError("Không thể kết nối server.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <div className="auth-card">
        <button className="auth-close" onClick={onCancel}>
          <i className="bi bi-x"></i>
        </button>

        <div className="auth-icon">
          <img src={logoImg} alt="AI Learning" />
        </div>

        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">
          Sign up to start learning with AI Learning
        </p>

        <button
          type="button"
          className="auth-google"
          onClick={handleGoogleLogin}
        >
          <img src={googleImg} alt="Google" width={20} height={20} />
          Continue with Google
        </button>

        <div className="auth-divider">
          <span className="auth-divider__line" />
          <span className="auth-divider__text">OR</span>
          <span className="auth-divider__line" />
        </div>

        {error && (
          <div className="auth-error">
            <i className="bi bi-exclamation-circle me-2"></i>
            {error}
          </div>
        )}

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
                type={showPassword ? "text" : "password"}
                className="auth-input auth-input--password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
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

          <div className="auth-field">
            <label className="auth-label">Confirm password</label>
            <div className="auth-input-wrap">
              <input
                type={showConfirm ? "text" : "password"}
                className="auth-input auth-input--password"
                value={form.confirm}
                onChange={(e) =>
                  setForm({ ...form, confirm: e.target.value })
                }
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowConfirm((v) => !v)}
              >
                <i
                  className={showConfirm ? "bi bi-eye-slash" : "bi bi-eye"}
                ></i>
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Đang tạo..." : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button
            type="button"
            className="auth-switch__link"
            onClick={onSwitchToLogin}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}