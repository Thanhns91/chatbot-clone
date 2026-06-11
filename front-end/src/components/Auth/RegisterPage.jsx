import { useState } from "react";
import { Form, Button, Alert } from "react-bootstrap";
import "./Auth.scss";

export default function RegisterPage({
  onCancel,
  onLoginSuccess,
  onSwitchToLogin,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const handleRegister = (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    onLoginSuccess?.("member", {
      name: form.name,
      email: form.email,
      role: "member",
    });
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

        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">
          Sign up to start learning with AI Learning
        </p>

        {/* Nút đăng ký bằng Google */}
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
          <Alert variant="danger" className="auth-error py-2 px-3 border-0">
            <i className="bi bi-exclamation-circle me-2"></i>
            {error}
          </Alert>
        )}

        {/* Form đăng ký */}
        <Form className="auth-form" onSubmit={handleRegister}>
          <Form.Group className="auth-field">
            <Form.Label className="auth-label">Full name</Form.Label>
            <Form.Control
              type="text"
              className="auth-input"
              placeholder="John Smith"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Form.Group>

          <Form.Group className="auth-field">
            <Form.Label className="auth-label">Email</Form.Label>
            <Form.Control
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Form.Group>

          <Form.Group className="auth-field">
            <Form.Label className="auth-label">Password</Form.Label>
            <div className="auth-input-wrap">
              <Form.Control
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
                <i className={showPassword ? "bi bi-eye-slash" : "bi bi-eye"}></i>
              </button>
            </div>
          </Form.Group>

          <Form.Group className="auth-field">
            <Form.Label className="auth-label">Confirm password</Form.Label>
            <div className="auth-input-wrap">
              <Form.Control
                type={showConfirm ? "text" : "password"}
                className="auth-input auth-input--password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowConfirm((v) => !v)}
              >
                <i className={showConfirm ? "bi bi-eye-slash" : "bi bi-eye"}></i>
              </button>
            </div>
          </Form.Group>

          <Button type="submit" className="auth-submit border-0">
            Create Account
          </Button>
        </Form>

        {/* Chuyển sang trang đăng nhập */}
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