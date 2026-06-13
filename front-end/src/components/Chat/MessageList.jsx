import React from "react";
import SessionCard from "./SessionCard";
import "./Chat.scss";

const MessageList = ({ conversation, onStar, onDelete }) => {
  if (!conversation) return null;

  return (
    <div className="message-list">
      {/* Session card đầu trang */}
      <SessionCard
        title={conversation.title}
        createdAt={conversation.createdAt}
        starred={conversation.starred}
        onStar={() => onStar?.(conversation.id)}
        onDelete={() => onDelete?.(conversation.id)}
      />

      {/* Danh sách tin nhắn */}
      <div className="message-list__messages">
        {conversation.messages?.map((msg, idx) => (
          <div
            key={idx}
            className={`message-row ${msg.role === "user" ? "message-row--user" : "message-row--ai"}`}
          >
            {msg.role === "ai" && (
              <div className="message-sender">AI Learning</div>
            )}
            {msg.role === "user" && (
              <div className="message-sender message-sender--user">You</div>
            )}
            <div
              className={`message-bubble ${msg.role === "user" ? "message-bubble--user" : "message-bubble--ai"}`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessageList;
