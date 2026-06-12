import { useState } from "react";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import "./SessionCard.scss";

const SessionCard = ({ title, createdAt, starred, onStar, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title || "Untitled");

  const handleEditConfirm = () => setEditing(false);

  return (
    <div className="session-card">
      {/* Left */}
      <div className="session-card__left">
        <div className="session-card__title-row">
          {editing ? (
            <input
              className="session-card__title-input"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleEditConfirm}
              onKeyDown={(e) => e.key === "Enter" && handleEditConfirm()}
              autoFocus
            />
          ) : (
            <h2 className={`session-card__title ${starred ? "session-card__title--starred" : ""}`}>
              {localTitle}
            </h2>
          )}

          <button
            className="session-card__edit-btn"
            title="Rename"
            onClick={() => setEditing(true)}
          >
            <i className="bi bi-pencil"></i>
          </button>
        </div>

        <div className="session-card__meta">
          <i className="bi bi-clock session-card__clock"></i>
          <strong>{createdAt || "Today"}</strong>

          {starred && (
            <Badge className="session-card__badge-starred">
              ⭐ Starred
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="session-card__actions">
        <Button
          variant="link"
          className={`session-card__action-btn ${starred ? "session-card__action-btn--starred" : ""}`}
          title={starred ? "Unstar" : "Star"}
          onClick={onStar}
        >
          <i className={starred ? "bi bi-star-fill" : "bi bi-star"}></i>
        </Button>

        <Button
          variant="link"
          className="session-card__action-btn"
          title="Delete"
          onClick={onDelete}
        >
          <i className="bi bi-trash"></i>
        </Button>
      </div>
    </div>
  );
};

export default SessionCard;