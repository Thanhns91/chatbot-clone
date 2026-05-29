import React, { useState } from "react";
import "./Auth.css";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

const AuthButton = ({ onLoginSuccess }) => {
  const [modal, setModal] = useState(null);

  const close = () => setModal(null);

  const handleSuccess = (role, user) => {
    close();
    onLoginSuccess?.(role, user);
  };

  return (
    <>
      <div className="auth-buttons">
        <button
          className="auth-btn auth-btn--outline"
          onClick={() => setModal("login")}
        >
          Login
        </button>

        <button
          className="auth-btn auth-btn--solid"
          onClick={() => setModal("register")}
        >
          Register
        </button>
      </div>

      {modal === "login" && (
        <LoginPage
          onCancel={close}
          onLoginSuccess={handleSuccess}
          onSwitchToRegister={() => setModal("register")}
        />
      )}

      {modal === "register" && (
        <RegisterPage
          onCancel={close}
          onLoginSuccess={handleSuccess}
          onSwitchToLogin={() => setModal("login")}
        />
      )}
    </>
  );
};

export default AuthButton;