import { useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";

import "./Chat.css";

function ChatInput() {
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (message.trim() === "") {
      return;
    }

    console.log("Tin nhắn người dùng:", message);

    setMessage("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <div className="chat-input-area">
      <Button variant="outline-secondary" className="chat-action-btn">
        <i className="bi bi-paperclip"></i>
      </Button>

      <Button variant="outline-secondary" className="chat-action-btn">
        <i className="bi bi-mic"></i>
      </Button>

      <Form.Control
        className="message-input"
        type="text"
        placeholder="Write what you think..."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <Button className="send-btn" onClick={handleSendMessage}>
        <i className="bi bi-send"></i>
      </Button>
    </div>
  );
}

export default ChatInput;