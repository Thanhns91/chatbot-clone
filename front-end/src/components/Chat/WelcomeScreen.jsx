import "./Chat.css";

function WelcomeScreen() {
  return (
    <section className="welcome-screen">
      <i className="bi bi-stars welcome-icon"></i>

      <h1 className="welcome-title">Where should we start?</h1>

      <p className="welcome-description">
        Ask me anything — I am here to help you learn and explore ideas.
      </p>
    </section>
  );
}

export default WelcomeScreen; 