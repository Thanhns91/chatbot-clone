import Button from "react-bootstrap/Button";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";

import "./Header.css";

function Header() {
  return (
    <Navbar className="chat-header">
      <Container fluid className="header-container">
        <Navbar.Brand className="brand">
          <i className="bi bi-stars"></i>
          <span>AI Learning</span>
        </Navbar.Brand>

        <div className="header-actions">
          <Button variant="link" className="header-icon-btn">
            <i className="bi bi-gear"></i>
          </Button>

          <Button variant="link" className="header-icon-btn">
            <i className="bi bi-bell"></i>
          </Button>

          <Button variant="outline-dark" className="login-btn">
            Login
          </Button>

          <Button className="register-btn">
            Register
          </Button>
        </div>
      </Container>
    </Navbar>
  );
}

export default Header;