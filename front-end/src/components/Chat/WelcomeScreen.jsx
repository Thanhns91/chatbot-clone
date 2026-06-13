import Container from "react-bootstrap/Container";
import "./Chat.scss";

function WelcomeScreen() {
  return (
    <Container as="section" className="welcome-screen" fluid>
      <i className="bi bi-stars welcome-icon"></i>

      <h1 className="welcome-title">Where should we start?</h1>

      <p className="welcome-description">
        Ask me anything — I am here to help you learn and explore ideas.
      </p>
    </Container>
  );
}

export default WelcomeScreen;
