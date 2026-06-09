import { useState } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import Alert from "react-bootstrap/Alert";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const ProfileTab = ({ user }) => {
  const [theme, setTheme] = useState("light");
  const [showModal, setShowModal] = useState(false);
  const [pwData, setPwData] = useState({ current: "", newPw: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const initial = user?.name?.charAt(0).toUpperCase() || "T";

  const handleClose = () => {
    setShowModal(false);
    setPwError("");
    setPwSuccess(false);
    setPwData({ current: "", newPw: "", confirm: "" });
    setShowPw({ current: false, newPw: false, confirm: false });
  };

  const handleChangePw = () => {
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
    setPwSuccess(true);
    setPwData({ current: "", newPw: "", confirm: "" });
  };

  return (
    <>
      {/* Personal Info */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-4">
          <Card.Title className="fw-bold mb-4">Personal Information</Card.Title>

          <div className="d-flex align-items-center gap-3 mb-4">
            <div
              className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fs-4 fw-bold flex-shrink-0"
              style={{ width: 72, height: 72 }}
            >
              {initial}
            </div>
            <div>
              <div className="d-flex gap-2">
                <Button variant="outline-secondary" size="sm" className="d-flex align-items-center gap-2">
                  <i className="bi bi-camera"></i> Change Photo
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
              <Form.Control type="text" defaultValue={user?.name || "Teacher User"} />
            </Col>
            <Col md={6}>
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" defaultValue={user?.email || "teacher@ailearning.edu"} />
            </Col>
            <Col md={6}>
              <Form.Label>School</Form.Label>
              <Form.Control type="text" defaultValue="Westview Academy" />
            </Col>
            <Col md={6}>
              <Form.Label>Subject</Form.Label>
              <Form.Control type="text" defaultValue="Mathematics" />
            </Col>
            <Col md={12}>
              <Form.Label>Bio</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                defaultValue="I've been teaching math for over 8 years with a focus on making abstract concepts approachable for every student."
              />
            </Col>
          </Row>

          <div className="d-flex justify-content-end mt-4">
            <Button variant="primary">Save Changes</Button>
          </div>
        </Card.Body>
      </Card>

      {/* Appearance */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-4">
          <Card.Title className="fw-bold text-primary d-flex align-items-center gap-2 mb-1">
            <i className="bi bi-sun"></i> Appearance
          </Card.Title>
          <p className="text-muted mb-4" style={{ fontSize: 13.5 }}>Choose your preferred interface theme.</p>

          <Row className="g-3">
            {[
              { key: "light", emoji: "☀️", name: "Light", desc: "Default theme", bg: "bg-light" },
              { key: "dark",  emoji: "🌙", name: "Dark",  desc: "Easy on the eyes", bg: "bg-dark" },
            ].map(({ key, emoji, name, desc, bg }) => (
              <Col md={6} key={key}>
                <Card
                  className={`h-100 ${theme === key ? "border-primary border-2" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setTheme(key)}
                >
                  <div className={`${bg} d-flex align-items-center justify-content-center`} style={{ height: 90, fontSize: 28 }}>
                    {emoji}
                  </div>
                  <Card.Body className="py-2 px-3">
                    <div className="fw-semibold">{name}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{desc}</div>
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
          <p className="text-muted mb-4" style={{ fontSize: 13.5 }}>
            Update your password to keep your account secure.
          </p>

          <div className="d-flex flex-column gap-3">
            {[
              { field: "current", label: "Current Password" },
              { field: "newPw",   label: "New Password" },
              { field: "confirm", label: "Confirm New Password" },
            ].map(({ field, label }) => (
              <div key={field}>
                <Form.Label>{label}</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPw[field] ? "text" : "password"}
                    placeholder="••••••••"
                    value={pwData[field]}
                    onChange={(e) => setPwData({ ...pwData, [field]: e.target.value })}
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowPw({ ...showPw, [field]: !showPw[field] })}
                  >
                    <i className={`bi ${showPw[field] ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </Button>
                </InputGroup>
              </div>
            ))}
          </div>

          {pwData.newPw.length > 0 && (
            <div className={`mt-2 small ${pwData.newPw.length < 8 ? "text-danger" : "text-success"}`}>
              {pwData.newPw.length < 8 ? "⚠ At least 8 characters required" : "✓ Password length looks good"}
            </div>
          )}

          {pwError && <Alert variant="danger" className="mt-3 py-2 mb-0">{pwError}</Alert>}
          {pwSuccess && <Alert variant="success" className="mt-3 py-2 mb-0">✓ Password changed successfully!</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleChangePw}>Update Password</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProfileTab;