import React from "react";
import Button from "react-bootstrap/Button";
import "./LibraryPanel.scss";

const getFileInfo = (fileName = "") => {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    return {
      icon: "bi bi-file-earmark-pdf",
      color: "red",
      label: "PDF Document",
    };
  }

  if (ext === "docx" || ext === "doc") {
    return {
      icon: "bi bi-file-earmark-word",
      color: "blue",
      label: "Word Document",
    };
  }

  if (ext === "xlsx" || ext === "xls") {
    return {
      icon: "bi bi-file-earmark-excel",
      color: "green",
      label: "Excel Document",
    };
  }

  return {
    icon: "bi bi-file-earmark-text",
    color: "purple",
    label: "Document",
  };
};

const formatDate = (value) => {
  if (!value) return "Recently";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleDateString("vi-VN");
};

const LibraryPanel = ({
  open,
  onClose,
  documents = [],
  selectedDocument,
  onSelectDocument,
}) => {
  const selectedId = selectedDocument?.documentId;

  return (
    <div className={`library-panel ${open ? "library-panel--open" : ""}`}>
      <div className="library-panel__inner">
        <div className="library-panel__header">
          <div className="library-panel__title">
            <i className="bi bi-book"></i>
            Library
          </div>

          <Button
            variant="light"
            className="library-panel__close"
            onClick={onClose}
            title="Close"
          >
            <i className="bi bi-x-lg"></i>
          </Button>
        </div>

        <div className="library-panel__count">
          {documents.length} DOCUMENTS AVAILABLE
        </div>

        {selectedDocument && (
          <div className="library-panel__current">
            <span className="library-panel__current-label">
              Đang dùng để chat
            </span>
            <strong>{selectedDocument.fileName}</strong>
          </div>
        )}

        <div className="library-panel__list">
          {documents.length === 0 ? (
            <div className="library-panel__empty">
              <i className="bi bi-folder2-open"></i>
              <p>Chưa có tài liệu nào.</p>
              <span>Upload file ở khung chat để tài liệu xuất hiện ở đây.</span>
            </div>
          ) : (
            documents.map((doc) => {
              const fileInfo = getFileInfo(doc.fileName);
              const active = String(doc.documentId) === String(selectedId);

              return (
                <div
                  key={`${doc.documentId}-${doc.id || doc.fileName}`}
                  className={`lesson-card ${
                    active ? "lesson-card--active" : ""
                  }`}
                >
                  <div className="lesson-card__top">
                    <div
                      className={`lesson-card__icon lesson-card__icon--${fileInfo.color}`}
                    >
                      <i className={fileInfo.icon}></i>
                    </div>

                    <div className="lesson-card__info">
                      <div className="lesson-card__title">
                        {doc.fileName || "Untitled document"}
                      </div>
                      <div className="lesson-card__category">
                        {fileInfo.label}
                      </div>
                    </div>
                  </div>

                  <div className="lesson-card__meta">
                    {doc.uploadedBy || "student"} &nbsp;·&nbsp;{" "}
                    {formatDate(doc.uploadDate || doc.createdAt)}
                  </div>

                  <div className="lesson-card__actions">
                    <Button
                      variant="outline-secondary"
                      className="lesson-card__btn-open"
                      onClick={() => onSelectDocument?.(doc)}
                    >
                      <i className="bi bi-check2-circle me-1"></i>
                      Use
                    </Button>

                    <Button
                      variant="primary"
                      className="lesson-card__btn-ask"
                      onClick={() => onSelectDocument?.(doc)}
                    >
                      <i className="bi bi-chat-dots me-1"></i>
                      Ask AI
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryPanel;
