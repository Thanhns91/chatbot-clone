import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import { getLibraryDocuments, publishDocument } from "../../../services/api";
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

const getDocumentUrl = (doc) => {
  return (
    doc?.fileUrl ||
    doc?.file_url ||
    doc?.url ||
    doc?.downloadUrl ||
    doc?.download_url ||
    doc?.secure_url ||
    ""
  );
};

const getSubjectLabel = (doc) => {
  if (doc.subjectCode && doc.subjectName) {
    return `${doc.subjectCode} - ${doc.subjectName}`;
  }

  return doc.subjectName || doc.subjectCode || "No Subject";
};

const getTopicLabel = (doc) => {
  return doc.topicName || "Uncategorized";
};

const normalizeUser = (user) => {
  if (!user) return null;

  return {
    ...user,
    userId: user.userId || user.id,
    role: user.role,
  };
};

const getStoredUser = () => {
  try {
    const rawUser =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("currentUser");

    return rawUser ? normalizeUser(JSON.parse(rawUser)) : null;
  } catch {
    return null;
  }
};

const isPrivateStudentFile = (doc) => {
  return doc?.uploadedBy === "student" && doc?.reviewStatus === "private";
};

const isApprovedStudentFile = (doc) => {
  return doc?.uploadedBy === "student" && doc?.reviewStatus === "approved";
};

const groupByMetadata = (files) => {
  const subjectMap = new Map();

  files.forEach((doc) => {
    const subjectKey = `${doc.subjectId || "none"}-${getSubjectLabel(doc)}`;
    const topicKey = `${doc.topicId || "none"}-${getTopicLabel(doc)}`;

    if (!subjectMap.has(subjectKey)) {
      subjectMap.set(subjectKey, {
        label: getSubjectLabel(doc),
        topics: new Map(),
      });
    }

    const subjectGroup = subjectMap.get(subjectKey);

    if (!subjectGroup.topics.has(topicKey)) {
      subjectGroup.topics.set(topicKey, {
        label: getTopicLabel(doc),
        files: [],
      });
    }

    subjectGroup.topics.get(topicKey).files.push(doc);
  });

  return Array.from(subjectMap.values()).map((subject) => ({
    ...subject,
    topics: Array.from(subject.topics.values()),
  }));
};

const LibraryPanel = ({
  open,
  onClose,
  documents = [],
  selectedDocument,
  onSelectDocument,
  user: propUser,
  onDocumentsChanged,
}) => {
  const [activeTab, setActiveTab] = useState("teacher");
  const [publishingId, setPublishingId] = useState(null);
  const [statusOverrides, setStatusOverrides] = useState({});
  const [libraryDocs, setLibraryDocs] = useState(documents);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const currentUser = normalizeUser(propUser) || getStoredUser();
  const currentUserRole = currentUser?.role;
  const currentUserId = currentUser?.userId;

  React.useEffect(() => {
    setLibraryDocs(documents);
  }, [documents]);

  React.useEffect(() => {
    const loadLibraryDocuments = async () => {
      if (!open || !currentUserId || !currentUserRole) return;

      try {
        setLoadingLibrary(true);
        const data = await getLibraryDocuments(currentUserId, currentUserRole);

        if (data.success) {
          setLibraryDocs(data.data || []);
        }
      } catch (error) {
        console.log("Cannot refresh library documents:", error);
      } finally {
        setLoadingLibrary(false);
      }
    };

    loadLibraryDocuments();
  }, [open, currentUserId, currentUserRole]);

  const visibleDocuments = libraryDocs.map((doc) => ({
    ...doc,
    reviewStatus: statusOverrides[doc.documentId] || doc.reviewStatus,
  }));

  const teacherFiles = visibleDocuments.filter(
    (doc) => doc.uploadedBy === "teacher",
  );

  const studentFiles = visibleDocuments.filter((doc) => {
    if (doc.uploadedBy !== "student") {
      return false;
    }

    if (currentUserRole === "student") {
      return Number(doc.uploaderId) === Number(currentUserId);
    }

    return doc.reviewStatus === "approved";
  });

  const currentFiles = activeTab === "teacher" ? teacherFiles : studentFiles;
  const groupedFiles = groupByMetadata(currentFiles);

  const handleOpenFile = (doc) => {
    const rawUrl = getDocumentUrl(doc);

    if (!rawUrl) return;

    window.open(rawUrl, "_blank", "noopener,noreferrer");
  };

  const handlePublishDocument = async (doc) => {
    if (!currentUserId) {
      window.alert("Bạn cần đăng nhập để public file.");
      return;
    }

    const ok = window.confirm(
      `Public file "${doc.fileName}"?\nTeacher và Admin sẽ xem được file này.`,
    );

    if (!ok) return;

    try {
      setPublishingId(doc.documentId);

      const result = await publishDocument(doc.documentId, currentUserId);

      if (!result.success) {
        throw new Error(result.message || "Public file thất bại");
      }

      setStatusOverrides((prev) => ({
        ...prev,
        [doc.documentId]: "approved",
      }));

      setLibraryDocs((prev) =>
        prev.map((item) =>
          String(item.documentId) === String(doc.documentId)
            ? { ...item, reviewStatus: "approved", visibilityStatus: "Public" }
            : item,
        ),
      );

      onDocumentsChanged?.({
        ...doc,
        reviewStatus: "approved",
      });

      window.alert("File đã được public. Teacher và Admin có thể xem file này.");
    } catch (error) {
      window.alert(error.message || "Public file thất bại");
    } finally {
      setPublishingId(null);
    }
  };

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

    const isOwner =
      currentUserId && Number(doc.uploaderId) === Number(currentUserId);

    const canPublish =
      activeTab === "student" && isOwner && isPrivateStudentFile(doc);

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

            {doc.uploadedBy === "student" && (
              <div
                className={`lesson-card__status ${
                  isPrivateStudentFile(doc)
                    ? "lesson-card__status--private"
                    : isApprovedStudentFile(doc)
                      ? "lesson-card__status--public"
                      : "lesson-card__status--pending"
                }`}
              >
                <i
                  className={
                    isPrivateStudentFile(doc)
                      ? "bi bi-lock-fill"
                      : isApprovedStudentFile(doc)
                        ? "bi bi-globe2"
                        : "bi bi-hourglass-split"
                  }
                ></i>
                {isPrivateStudentFile(doc)
                  ? "Private"
                  : isApprovedStudentFile(doc)
                    ? "Public"
                    : doc.reviewStatus || "Pending"}
              </div>
            )}
          </div>
        </div>

        <div className="lesson-card__meta">
          {doc.documentTypeName || doc.fileType || "Document"}
          {doc.levelName ? ` · ${doc.levelName}` : ""}
          {" · "}
          {formatDate(doc.uploadDate)}
        </div>

        <div className="lesson-card__actions">
          <Button
            variant="outline-secondary"
            className="lesson-card__btn-open"
            onClick={() => handleOpenFile(doc)}
            disabled={!getDocumentUrl(doc)}
          >
            <i className="bi bi-box-arrow-up-right me-1"></i>
            Open
          </Button>

          <Button
            variant="primary"
            className="lesson-card__btn-ask"
            onClick={() => onSelectDocument?.(doc)}
          >
            <i className="bi bi-chat-dots me-1"></i>
            {isActive ? "Using" : "Ask AI"}
          </Button>

          {canPublish && (
            <Button
              variant="success"
              className="lesson-card__btn-public"
              onClick={() => handlePublishDocument(doc)}
              disabled={publishingId === doc.documentId}
            >
              <i className="bi bi-globe2 me-1"></i>
              {publishingId === doc.documentId ? "..." : "Public"}
            </Button>
          )}
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
          {loadingLibrary
            ? "LOADING..."
            : `${currentFiles.length} DOCUMENTS AVAILABLE`}
        </div>

        <div className="library-panel__list">
          {currentFiles.length === 0
            ? renderEmpty()
            : groupedFiles.map((subject) => (
                <div key={subject.label} className="library-meta-group">
                  <div className="library-meta-group__subject">
                    <i className="bi bi-folder2-open"></i>
                    {subject.label}
                  </div>

                  {subject.topics.map((topic) => (
                    <div key={`${subject.label}-${topic.label}`}>
                      <div className="library-meta-group__topic">
                        {topic.label}
                      </div>
                      {topic.files.map(renderFileCard)}
                    </div>
                  ))}
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

export default LibraryPanel;
