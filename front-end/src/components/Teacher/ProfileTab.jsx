import { useEffect, useRef, useState } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import Alert from "react-bootstrap/Alert";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const API = import.meta.env.VITE_API_URL;;

const getStoredUser = () => {
  const raw =
    localStorage.getItem("currentUser") ||
    sessionStorage.getItem("currentUser") ||
    localStorage.getItem("user") ||
    sessionStorage.getItem("user");

  return raw ? JSON.parse(raw) : null;
};

const ProfileTab = ({ user }) => {
  const fileInputRef = useRef(null);

  const initialUser = user || getStoredUser() || {};

  const [profileUser, setProfileUser] = useState(initialUser);
  const [theme, setTheme] = useState("light");
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    fullName: initialUser?.fullName || initialUser?.name || "",
    email: initialUser?.email || "",
  });

  const [avatarUrl, setAvatarUrl] = useState(
    initialUser?.avatarUrl || initialUser?.avatar_url || ""
  );

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [pwData, setPwData] = useState({
    current: "",
    newPw: "",
    confirm: "",
  });

  const [showPw, setShowPw] = useState({
    current: false,
    newPw: false,
    confirm: false,
  });

  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const userId = profileUser?.userId || initialUser?.userId;
  const initial =
    (formData.fullName || profileUser?.name || "T").charAt(0).toUpperCase();

  useEffect(() => {
    if (!profileMsg && !profileError) return;

    const timer = setTimeout(() => {
      setProfileMsg("");
      setProfileError("");
    }, 2500);

    return () => clearTimeout(timer);
  }, [profileMsg, profileError]);

  const saveUserToStorage = (updatedUser) => {
    const normalized = {
      ...updatedUser,
      name: updatedUser.fullName || updatedUser.name,
      avatarUrl: updatedUser.avatarUrl || updatedUser.avatar_url || "",
      avatar_url: updatedUser.avatar_url || updatedUser.avatarUrl || "",
    };

    setProfileUser(normalized);
    setFormData({
      fullName: normalized.fullName || normalized.name || "",
      email: normalized.email || "",
    });
    setAvatarUrl(normalized.avatarUrl || normalized.avatar_url || "");

    if (localStorage.getItem("currentUser")) {
      localStorage.setItem("currentUser", JSON.stringify(normalized));
    }

    if (sessionStorage.getItem("currentUser")) {
      sessionStorage.setItem("currentUser", JSON.stringify(normalized));
    }

    if (localStorage.getItem("user")) {
      localStorage.setItem("user", JSON.stringify(normalized));
    }

    if (sessionStorage.getItem("user")) {
      sessionStorage.setItem("user", JSON.stringify(normalized));
    }

    return normalized;
  };

  const loadProfile = async () => {
    if (!userId) return;

    try {
      const res = await fetch(`${API}/users/${userId}/profile`);
      const data = await res.json();

      if (data.success) {
        saveUserToStorage(data.user);
      }
    } catch (error) {
      console.error("Cannot load profile", error);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChangePhoto = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!userId) {
      setProfileError("Không tìm thấy tài khoản giáo viên đang đăng nhập.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setProfileError("Only image files are allowed.");
      return;
    }

    const fd = new FormData();

    // Quan trọng: backend dùng avatarUpload.single("avatar")
    fd.append("avatar", file);

    setUploadingAvatar(true);
    setProfileMsg("");
    setProfileError("");

    try {
      const res = await fetch(`${API}/users/${userId}/avatar`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (data.success) {
        saveUserToStorage(data.user);
        setProfileMsg("Avatar updated successfully.");
      } else {
        setProfileError(data.detail || data.message || "Cannot upload avatar.");
      }
    } catch (error) {
      console.error(error);
      setProfileError("Cannot upload avatar.");
    } finally {
      setUploadingAvatar(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) {
      setProfileError("Không tìm thấy tài khoản giáo viên đang đăng nhập.");
      return;
    }

    setSavingProfile(true);
    setProfileMsg("");
    setProfileError("");

    try {
      const res = await fetch(`${API}/users/${userId}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
        }),
      });

      const data = await res.json();

      if (data.success) {
        saveUserToStorage(data.user);
        setProfileMsg("Profile updated successfully.");
      } else {
        setProfileError(data.message || "Update profile failed.");
      }
    } catch (error) {
      console.error(error);
      setProfileError("Cannot connect to server.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setPwError("");
    setPwSuccess(false);
    setPwData({ current: "", newPw: "", confirm: "" });
    setShowPw({ current: false, newPw: false, confirm: false });
  };

  const handleChangePw = async () => {
    setPwError("");
    setPwSuccess(false);

    if (!pwData.current || !pwData.newPw || !pwData.confirm) {
      setPwError("Please fill in all fields.");
      return;
    }

    if (pwData.newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }

    if (pwData.newPw !== pwData.confirm) {
      setPwError("New passwords do not match.");
      return;
    }

    if (!userId) {
      setPwError("Không tìm thấy tài khoản giáo viên đang đăng nhập.");
      return;
    }

    try {
      const res = await fetch(`${API}/users/${userId}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: pwData.current,
          newPassword: pwData.newPw,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setPwSuccess(true);
        setPwData({ current: "", newPw: "", confirm: "" });
      } else {
        setPwError(data.message || "Change password failed.");
      }
    } catch (error) {
      console.error(error);
      setPwError("Cannot connect to server.");
    }
  };

  return (
    <>
      {/* Personal Info */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-4">
          <Card.Title className="fw-bold mb-4">
            Personal Information
          </Card.Title>

          <div className="d-flex align-items-center gap-3 mb-4">
            <div className="td-profile-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Teacher avatar"
                  className="td-profile-avatar-img"
                />
              ) : (
                initial
              )}
            </div>

            <div>
              <div className="d-flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="d-none"
                  onChange={handleChangePhoto}
                />

                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="d-flex align-items-center gap-2"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className="bi bi-camera"></i>{" "}
                  {uploadingAvatar ? "Uploading..." : "Change Photo"}
                </Button>

                <Button
                  variant="outline-primary"
                  size="sm"
                  className="d-flex align-items-center gap-2"
                  onClick={() => setShowModal(true)}
                >
                  <i className="bi bi-shield-lock"></i> Change Password
                </Button>
              </div>
            </div>
          </div>

          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Full Name</Form.Label>
              <Form.Control
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Teacher User"
              />
            </Col>

            <Col md={6}>
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="teacher@ailearning.edu"
              />
            </Col>
          </Row>

          <div className="d-flex justify-content-end mt-4">
            <Button
              variant="primary"
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          {(profileMsg || profileError) && (
            <div
              className={`td-profile-toast ${profileError
                  ? "td-profile-toast--error"
                  : "td-profile-toast--success"
                }`}
            >
              <div className="td-profile-toast__icon">
                <i
                  className={
                    profileError
                      ? "bi bi-exclamation-circle-fill"
                      : "bi bi-check-circle-fill"
                  }
                />
              </div>

              <div className="td-profile-toast__content">
                <div className="td-profile-toast__title">
                  {profileError ? "Update failed" : "Updated successfully"}
                </div>

                <div className="td-profile-toast__message">
                  {profileError || profileMsg}
                </div>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Appearance */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-4">
          <Card.Title className="fw-bold text-primary d-flex align-items-center gap-2 mb-1">
            <i className="bi bi-sun"></i> Appearance
          </Card.Title>

          <p className="text-muted mb-4 td-appearance-sub">
            Choose your preferred interface theme.
          </p>

          <Row className="g-3">
            {[
              {
                key: "light",
                emoji: "☀️",
                name: "Light",
                desc: "Default theme",
                bgClass: "td-theme-preview--light",
              },
              {
                key: "dark",
                emoji: "🌙",
                name: "Dark",
                desc: "Easy on the eyes",
                bgClass: "td-theme-preview--dark",
              },
            ].map(({ key, emoji, name, desc, bgClass }) => (
              <Col md={6} key={key}>
                <Card
                  className={`td-theme-card ${theme === key ? "td-theme-card--active" : ""
                    }`}
                  onClick={() => setTheme(key)}
                >
                  <div className={`td-theme-preview ${bgClass}`}>
                    <span className="td-theme-emoji">{emoji}</span>
                  </div>

                  <Card.Body className="td-theme-info">
                    <div className="td-theme-name">{name}</div>
                    <div className="td-theme-desc">{desc}</div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Card.Body>
      </Card>

      {/* Change Password Modal */}
      <Modal show={showModal} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2 fs-6 fw-bold">
            <i className="bi bi-shield-lock text-primary"></i> Change Password
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p className="text-muted mb-4 td-modal-sub">
            Update your password to keep your account secure.
          </p>

          <div className="d-flex flex-column gap-3">
            {[
              { field: "current", label: "Current Password" },
              { field: "newPw", label: "New Password" },
              { field: "confirm", label: "Confirm New Password" },
            ].map(({ field, label }) => (
              <div key={field}>
                <Form.Label>{label}</Form.Label>

                <InputGroup>
                  <Form.Control
                    type={showPw[field] ? "text" : "password"}
                    placeholder="••••••••"
                    value={pwData[field]}
                    onChange={(e) =>
                      setPwData({ ...pwData, [field]: e.target.value })
                    }
                  />

                  <Button
                    variant="outline-secondary"
                    onClick={() =>
                      setShowPw({ ...showPw, [field]: !showPw[field] })
                    }
                  >
                    <i
                      className={`bi ${showPw[field] ? "bi-eye-slash" : "bi-eye"
                        }`}
                    ></i>
                  </Button>
                </InputGroup>
              </div>
            ))}
          </div>

          {pwData.newPw.length > 0 && (
            <div
              className={`mt-2 small ${pwData.newPw.length < 8 ? "text-danger" : "text-success"
                }`}
            >
              {pwData.newPw.length < 8
                ? "⚠ At least 8 characters required"
                : "✓ Password length looks good"}
            </div>
          )}

          {pwError && (
            <Alert variant="danger" className="mt-3 py-2 mb-0">
              {pwError}
            </Alert>
          )}

          {pwSuccess && (
            <Alert variant="success" className="mt-3 py-2 mb-0">
              ✓ Password changed successfully!
            </Alert>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleClose}>
            Cancel
          </Button>

          <Button variant="primary" onClick={handleChangePw}>
            Update Password
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProfileTab;