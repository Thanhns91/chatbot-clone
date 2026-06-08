import Button from "react-bootstrap/Button";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import "./Header.css";
import logo7 from "../../../assets/images/7.png";

function Header({ libraryOpen, onToggleLibrary, headerRight }) {
  return (
    <Navbar className="chat-header">
      <Container fluid className="header-container">
        <Navbar.Brand className="brand">
          <img
            src={logo7}
            alt="logo"
            style={{ width: 32, height: 32, objectFit: "contain" }}
          />
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

          <Button variant="link" className="header-icon-btn">
            <i className="bi bi-gear"></i>
          </Button>

          <Button variant="link" className="header-icon-btn">
            <i className="bi bi-bell"></i>
          </Button>

          {/* ✅ Render AuthButton hoặc UserAvatar từ HomePage */}
          {headerRight}
        </div>
      </Container>
    </Navbar>
  );
}

export default Header;