import { useState } from "react";
import Button from "react-bootstrap/Button";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import "./Header.scss";
import logo7 from "../../../assets/images/7.png";
import SettingsModal from "../SettingModel/SettingsModal";

function Header({ libraryOpen, onToggleLibrary, headerRight, currentUser }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <Navbar className="chat-header">
        <Container fluid className="header-container">
          <Navbar.Brand className="brand">
            <img src={logo7} alt="logo" className="brand__logo" />
            <span>AI Learning</span>
          </Navbar.Brand>

          <div className="header-actions">
            <Button
              variant="link"
              className={`header-icon-btn ${libraryOpen ? "active" : ""}`}
              title="Library"
              onClick={onToggleLibrary}
            >
              <i className="bi bi-book"></i>
            </Button>

            <Button
              variant="link"
              className="header-icon-btn"
              title="Settings"
              onClick={() => setShowSettings(true)}
            >
              <i className="bi bi-gear"></i>
            </Button>

            <Button
              variant="link"
              className="header-icon-btn"
              title="Notifications"
            >
              <i className="bi bi-bell"></i>
            </Button>

            {headerRight}
          </div>
        </Container>
      </Navbar>

      {showSettings && (
        <SettingsModal
          user={currentUser}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => console.log("Profile saved:", updated)}
        />
      )}
    </>
  );
}

export default Header;
