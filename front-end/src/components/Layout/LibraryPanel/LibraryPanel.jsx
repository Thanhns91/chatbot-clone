import React, { useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import "./LibraryPanel.scss";

const getFileIcon = (fileName = "") => {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) return "bi bi-file-earmark-pdf";

  if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
    return "bi bi-file-earmark-word";
  }

  return "bi bi-file-earmark-text";
};

const formatDate = (date) => {
  if (!date) return "";

  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

const LibraryPanel = ({
  open,
  onClose,
  documents = [],
  selectedDocument,
  onSelectDocument,
}) => {
  const [activeTab, setActiveTab] = useState("teacher");

  const teacherFiles = useMemo(() => {
    return documents.filter((doc) => doc.uploadedBy === "teacher");
  }, [documents]);

  const studentFiles = useMemo(() => {
    return documents.filter((doc) => doc.uploadedBy === "student");
  }, [documents]);

  const currentFiles = activeTab === "teacher" ? teacherFiles : studentFiles;

  const renderEmpty = () => (
    <div className="library-empty">
      <div className="library-empty__icon">
        <i className="bi bi-folder"></i>
      </div>

      <h4>
        {activeTab === "teacher"
          ? "No teacher materials yet."
          : "No personal uploads yet."}
      </h4>

      <p>
        {activeTab === "teacher"
          ? "Teacher uploaded documents will appear here."
          : "Upload a file in chat and your documents will appear here."}
      </p>
    </div>
  );

  const renderFileCard = (doc) => {
    const isActive =
      String(selectedDocument?.documentId) === String(doc.documentId);

    return (
      <div
        key={`${doc.uploadedBy}-${doc.documentId}`}
        className={`lesson-card ${isActive ? "lesson-card--active" : ""}`}
      >
        <div className="lesson-card__top">
          <div
            className={`lesson-card__icon ${
              doc.uploadedBy === "teacher"
                ? "lesson-card__icon--teacher"
                : "lesson-card__icon--student"
            }`}
          >
            <i className={getFileIcon(doc.fileName)}></i>
          </div>

          <div className="lesson-card__info">
            <div className="lesson-card__title">{doc.fileName}</div>

            <div className="lesson-card__category">
              {doc.uploadedBy === "teacher"
                ? `Teacher: ${doc.uploaderName || "Unknown"}`
                : "My Upload"}
            </div>
          </div>
        </div>

        <div className="lesson-card__meta">
          {doc.fileType || "Document"} &nbsp;·&nbsp;{" "}
          {formatDate(doc.uploadDate)}
        </div>

        <div className="lesson-card__actions">
          <Button
            variant="primary"
            className="lesson-card__btn-ask"
            onClick={() => onSelectDocument?.(doc)}
          >
            <i className="bi bi-plus-circle me-1"></i>
            {isActive ? "Using" : "Add to Chat"}
          </Button>
        </div>
      </div>
    );
  };

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

        <div className="library-panel__tabs">
          <button
            type="button"
            className={`library-panel__tab ${
              activeTab === "teacher" ? "library-panel__tab--active" : ""
            }`}
            onClick={() => setActiveTab("teacher")}
          >
            <i className="bi bi-mortarboard"></i>
            Teacher
            <span>{teacherFiles.length}</span>
          </button>

          <button
            type="button"
            className={`library-panel__tab ${
              activeTab === "student" ? "library-panel__tab--active" : ""
            }`}
            onClick={() => setActiveTab("student")}
          >
            <i className="bi bi-person"></i>
            My Files
            <span>{studentFiles.length}</span>
          </button>
        </div>

        <div className="library-panel__count">
          {currentFiles.length} DOCUMENTS AVAILABLE
        </div>

        <div className="library-panel__list">
          {currentFiles.length === 0
            ? renderEmpty()
            : currentFiles.map(renderFileCard)}
        </div>
      </div>
    </div>
  );
};

export default LibraryPanel;