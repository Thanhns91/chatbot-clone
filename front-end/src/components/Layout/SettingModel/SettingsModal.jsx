import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { uploadAvatar } from "../../../services/api";
import "./SettingsModal.scss";

export default function SettingsModal({ user, onClose, onSave }) {
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState(user ? "profile" : "appearance");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [chatLanguage, setChatLanguage] = useState(
    localStorage.getItem("chatLanguage") || "vi",
  );
  const [form, setForm] = useState({
    name: user?.name || user?.fullName || "",
    email: user?.email || "",
    bio: user?.bio || "",
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    user?.avatar_url || user?.avatarUrl || "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const getInitial = () => {
    return (
      form.name?.charAt(0)?.toUpperCase() ||
      user?.email?.charAt(0)?.toUpperCase() ||
      "U"
    );
  };

  useEffect(() => {
    localStorage.setItem("chatLanguage", chatLanguage);

    window.dispatchEvent(
      new CustomEvent("chatLanguageChanged", {
        detail: chatLanguage,
      }),
    );
  }, [chatLanguage]);
  const saveUserToStorage = (updatedUser) => {
    const finalUser = {
      ...updatedUser,
      name: updatedUser.name || updatedUser.fullName || form.name,
      fullName: updatedUser.fullName || updatedUser.name || form.name,
      email: updatedUser.email || form.email,
      bio: updatedUser.bio || form.bio,
      avatar_url: updatedUser.avatar_url || updatedUser.avatarUrl || "",
      avatarUrl: updatedUser.avatarUrl || updatedUser.avatar_url || "",
    };

    if (localStorage.getItem("currentUser")) {
      localStorage.setItem("currentUser", JSON.stringify(finalUser));
    }

    if (sessionStorage.getItem("currentUser")) {
      sessionStorage.setItem("currentUser", JSON.stringify(finalUser));
    }

    return finalUser;
  };

  const handleChooseAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB.");
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user?.userId) {
      alert("User ID not found.");
      return;
    }

    if (!form.name.trim()) {
      alert("Display name is required.");
      return;
    }

    if (!form.email.trim()) {
      alert("Email is required.");
      return;
    }

    try {
      setSaving(true);

      let updatedUser = {
        ...user,
        name: form.name.trim(),
        fullName: form.name.trim(),
        email: form.email.trim(),
        bio: form.bio,
      };

      if (avatarFile) {
        const avatarResult = await uploadAvatar(user.userId, avatarFile);

        if (!avatarResult.success) {
          throw new Error(
            avatarResult.detail ||
              avatarResult.message ||
              "Upload avatar failed.",
          );
        }

        updatedUser = {
          ...updatedUser,
          ...avatarResult.user,
          avatar_url: avatarResult.avatar_url || avatarResult.user?.avatar_url,
          avatarUrl: avatarResult.avatarUrl || avatarResult.user?.avatarUrl,
        };
      }

      const finalUser = saveUserToStorage(updatedUser);

      onSave?.(finalUser);
      onClose?.();
    } catch (error) {
      alert(error.message || "Save changes failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="sm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="sm-card">
        <div className="sm-header">
          <h2 className="sm-title">Settings</h2>

          <Button variant="light" className="sm-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </Button>
        </div>

        <div className="sm-tabs">
          {user && (
            <button
              type="button"
              className={`sm-tab ${
                activeTab === "profile" ? "sm-tab--active" : ""
              }`}
              onClick={() => setActiveTab("profile")}
            >
              <i className="bi bi-person"></i>
              Profile
            </button>
          )}

          <button
            type="button"
            className={`sm-tab ${
              activeTab === "appearance" ? "sm-tab--active" : ""
            }`}
            onClick={() => setActiveTab("appearance")}
          >
            <i className="bi bi-brightness-high"></i>
            Appearance
          </button>
        </div>

        <div className="sm-body">
          {activeTab === "appearance" && (
            <div className="sm-appearance">
              <p className="sm-desc">Choose your preferred interface theme.</p>

              <div className="sm-theme-grid">
                <button
                  type="button"
                  className={`sm-theme-card ${
                    theme === "light" ? "sm-theme-card--active" : ""
                  }`}
                  onClick={() => setTheme("light")}
                >
                  <div className="sm-theme-preview sm-theme-preview--light">
                    <i className="bi bi-sun"></i>
                  </div>

                  <div className="sm-theme-info">
                    <span className="sm-theme-name">Light</span>
                    <span className="sm-theme-desc">Default theme</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`sm-theme-card ${
                    theme === "dark" ? "sm-theme-card--active" : ""
                  }`}
                  onClick={() => setTheme("dark")}
                >
                  <div className="sm-theme-preview sm-theme-preview--dark">
                    <i className="bi bi-moon"></i>
                  </div>

                  <div className="sm-theme-info">
                    <span className="sm-theme-name">Dark</span>
                    <span className="sm-theme-desc">Easy on the eyes</span>
                  </div>
                </button>
              </div>
            </div>
          )}
          <div className="sm-language-section">
            <p className="sm-desc">Choose chatbot response language.</p>

            <div className="sm-language-grid">
              <button
                type="button"
                className={`sm-language-card ${
                  chatLanguage === "vi" ? "sm-language-card--active" : ""
                }`}
                onClick={() => setChatLanguage("vi")}
              >
                <i className="bi bi-translate"></i>
                <div>
                  <strong>Vietnamese</strong>
                  <span>Chatbot trả lời bằng tiếng Việt</span>
                </div>
              </button>

              <button
                type="button"
                className={`sm-language-card ${
                  chatLanguage === "en" ? "sm-language-card--active" : ""
                }`}
                onClick={() => setChatLanguage("en")}
              >
                <i className="bi bi-translate"></i>
                <div>
                  <strong>English</strong>
                  <span>Chatbot answers in English</span>
                </div>
              </button>
            </div>
          </div>
          {activeTab === "profile" && user && (
            <div className="sm-profile">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarChange}
              />

              <div className="sm-avatar-wrap">
                <button
                  type="button"
                  className="sm-avatar"
                  onClick={handleChooseAvatar}
                  disabled={saving}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="avatar"
                      className="sm-avatar-img"
                    />
                  ) : (
                    <span>{getInitial()}</span>
                  )}

                  <div className="sm-avatar-overlay">
                    {saving ? (
                      <i className="bi bi-arrow-repeat"></i>
                    ) : (
                      <i className="bi bi-camera"></i>
                    )}
                  </div>
                </button>

                <span className="sm-avatar-hint">
                  Click avatar to change photo
                </span>
              </div>

              <Form.Group className="sm-field">
                <Form.Label className="sm-label">Display Name</Form.Label>
                <Form.Control
                  className="sm-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="sm-field">
                <Form.Label className="sm-label">Email</Form.Label>
                <Form.Control
                  className="sm-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="sm-field">
                <Form.Label className="sm-label">Bio</Form.Label>
                <Form.Control
                  as="textarea"
                  className="sm-input sm-textarea"
                  placeholder="Tell us a bit about yourself..."
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="sm-field">
                <Form.Label className="sm-label">Role</Form.Label>
                <Form.Control
                  className="sm-input"
                  value={user.role || "Member"}
                  disabled
                />
              </Form.Group>

              <Button
                variant="primary"
                className="sm-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
