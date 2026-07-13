import { useEffect, useMemo, useRef, useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Table from "react-bootstrap/Table";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import Modal from "react-bootstrap/Modal";
import Dropdown from "react-bootstrap/Dropdown";
import {
  uploadTeacherFile,
  getTeacherUploadHistory,
  deleteDocument,
  getMetadata,
  createSubject,
  createTopic,
} from "../../services/api";

const getCurrentUser = () => {
  const raw =
    sessionStorage.getItem("currentUser") ||
    localStorage.getItem("currentUser");

  return raw ? JSON.parse(raw) : null;
};

const getFileType = (fileName = "", fileType = "") => {
  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();

  if (lowerName.endsWith(".pdf") || lowerType.includes("pdf")) return "pdf";

  if (
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerType.includes("word")
  ) {
    return "docx";
  }

  return "other";
};

const fileIcon = (type) => {
  if (type === "pdf") {
    return {
      cls: "td-file-icon--pdf",
      icon: "bi bi-file-earmark-pdf",
      label: "PDF",
    };
  }

  if (type === "docx") {
    return {
      cls: "td-file-icon--docx",
      icon: "bi bi-file-earmark-word",
      label: "DOCX",
    };
  }

  return {
    cls: "td-file-icon--docx",
    icon: "bi bi-file-earmark-text",
    label: "FILE",
  };
};

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toISOString().split("T")[0];
};

const defaultUploadMeta = {
  subjectId: "",
  topicId: "",
  documentTypeId: "",
  levelId: "",
  tags: "",
  summary: "",
};

const splitTags = (value = "") => {
  return String(value || "")
    .split(/[\n,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const joinTags = (tags = []) => {
  const normalized = tags
    .map((tag) => String(tag || "").trim())
    .filter(Boolean);

  return [...new Set(normalized)].join(", ");
};

const TagInput = ({ value, onChange, placeholder = "Add tag..." }) => {
  const [input, setInput] = useState("");

  const tags = useMemo(() => splitTags(value), [value]);

  const addTags = (rawValue = "") => {
    const nextTags = splitTags(rawValue);

    if (nextTags.length === 0) return;

    onChange(joinTags([...tags, ...nextTags]));
    setInput("");
  };

  const removeTag = (tagToRemove) => {
    onChange(joinTags(tags.filter((tag) => tag !== tagToRemove)));
  };

  const handleKeyDown = (event) => {
    if (["Enter", "Tab", ","].includes(event.key)) {
      event.preventDefault();
      addTags(input);
      return;
    }

    if (event.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handlePaste = (event) => {
    const text = event.clipboardData.getData("text");

    if (text.includes(",") || text.includes("\n")) {
      event.preventDefault();
      addTags(text);
    }
  };

  return (
    <div
      className="tag-select-input"
      onClick={(event) => {
        const inputEl = event.currentTarget.querySelector("input");
        inputEl?.focus();
      }}
    >
      {tags.map((tag) => (
        <span key={tag} className="tag-select-chip">
          {tag}

          <button
            type="button"
            className="tag-select-remove"
            aria-label={`Remove ${tag}`}
            onClick={(event) => {
              event.stopPropagation();
              removeTag(tag);
            }}
          >
            ×
          </button>
        </span>
      ))}

      <input
        className="tag-select-control"
        value={input}
        placeholder={tags.length === 0 ? placeholder : ""}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTags(input)}
        onPaste={handlePaste}
      />
    </div>
  );
};

const defaultNewSubject = {
  subjectCode: "",
  subjectName: "",
  description: "",
};

const defaultNewTopic = {
  subjectId: "",
  topicName: "",
  description: "",
};

const PAGE_SIZE = 10;

const buildPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);

  if (currentPage <= 4) {
    start = 2;
    end = Math.min(5, totalPages - 1);
  }

  if (currentPage >= totalPages - 3) {
    start = Math.max(2, totalPages - 4);
    end = totalPages - 1;
  }

  if (start > 2) {
    items.push("left-ellipsis");
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < totalPages - 1) {
    items.push("right-ellipsis");
  }

  items.push(totalPages);

  return items;
};

export default function MaterialsTab() {
  const fileRef = useRef(null);

  const [docs, setDocs] = useState([]);
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [documentLevels, setDocumentLevels] = useState([]);

  const [uploadMeta, setUploadMeta] = useState(defaultUploadMeta);
  const [newSubject, setNewSubject] = useState(defaultNewSubject);
  const [newTopic, setNewTopic] = useState(defaultNewTopic);

  const currentUser = getCurrentUser();

  const filteredTopics = useMemo(() => {
    if (!uploadMeta.subjectId) return topics;

    return topics.filter(
      (topic) => String(topic.subjectId) === String(uploadMeta.subjectId),
    );
  }, [topics, uploadMeta.subjectId]);

  const totalPages = Math.max(1, Math.ceil(docs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedDocs = docs.slice(startIndex, startIndex + PAGE_SIZE);
  const paginationItems = buildPaginationItems(safePage, totalPages);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  const goToPage = () => {
    const pageNumber = Number(jumpPage);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      setError(`Please enter a page number from 1 to ${totalPages}.`);
      return;
    }

    setPage(pageNumber);
    setJumpPage("");
    setError("");
  };

  const fetchUploadHistory = async () => {
    try {
      const data = await getTeacherUploadHistory(currentUser?.userId);

      if (data.success) {
        setDocs(data.data || []);
      }
    } catch (err) {
      console.error(err);
      setError("Cannot load upload history");
    }
  };

  const fetchMetadata = async () => {
    try {
      const data = await getMetadata();

      if (data.success) {
        const loadedSubjects = data.subjects || [];
        const loadedTopics = data.topics || [];
        const loadedTypes = data.documentTypes || [];
        const loadedLevels = data.documentLevels || [];

        setSubjects(loadedSubjects);
        setTopics(loadedTopics);
        setDocumentTypes(loadedTypes);
        setDocumentLevels(loadedLevels);

        setUploadMeta((prev) => ({
          ...prev,
          documentTypeId: prev.documentTypeId || loadedTypes[0]?.documentTypeId || "",
          levelId: prev.levelId || loadedLevels[0]?.levelId || "",
        }));

        setNewTopic((prev) => ({
          ...prev,
          subjectId: prev.subjectId || loadedSubjects[0]?.subjectId || "",
        }));
      }
    } catch (err) {
      console.error(err);
      setError("Cannot load metadata");
    }
  };

  useEffect(() => {
    fetchMetadata();
    fetchUploadHistory();
  }, []);

  useEffect(() => {
    if (!uploadMeta.subjectId) return;

    const stillValid = filteredTopics.some(
      (topic) => String(topic.topicId) === String(uploadMeta.topicId),
    );

    if (!stillValid) {
      setUploadMeta((prev) => ({
        ...prev,
        topicId: "",
      }));
    }
  }, [uploadMeta.subjectId, filteredTopics]);

  const validateFile = (file) => {
    const name = file.name.toLowerCase();

    if (!name.endsWith(".pdf") && !name.endsWith(".docx") && !name.endsWith(".doc")) {
      return "Only PDF, DOC and DOCX files are allowed.";
    }

    return "";
  };

  const validateMetadataBeforeUpload = () => "";

  const openUploadModal = async (file) => {
    if (!file) return;

    const validateMessage = validateFile(file);

    if (validateMessage) {
      setError(validateMessage);
      return;
    }

    await fetchMetadata();
    setPendingFile(file);
    setUploadMeta(defaultUploadMeta);
    setError("");
    setSuccess("");
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    if (uploading) return;

    setShowUploadModal(false);
    setPendingFile(null);
    setUploadMeta(defaultUploadMeta);

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  const handleOpenPendingFile = (file) => {
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    window.open(fileUrl, "_blank", "noopener,noreferrer");

    setTimeout(() => {
      URL.revokeObjectURL(fileUrl);
    }, 30000);
  };

  const uploadWithMeta = async (extraOptions = {}) => {
    return uploadTeacherFile(pendingFile, currentUser?.userId, {
      ...uploadMeta,
      ...extraOptions,
    });
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    const validateMessage = validateMetadataBeforeUpload();

    if (validateMessage) {
      setError(validateMessage);
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      let data = await uploadWithMeta();

      if (data.needConfirm) {
        const saveAsVersion = window.confirm(
          `${data.message}\n\nOK = Save as new version\nCancel = Replace old file`,
        );

        data = await uploadWithMeta({
          duplicateAction: saveAsVersion ? "new_version" : "replace_old",
          replaceDocumentId: data.existingDocumentId,
          allowVersion: saveAsVersion,
        });
      }

      if (data.success) {
        await fetchUploadHistory();
        setSuccess(data.message || "Upload successful");
        setError("");
        closeUploadModal();
      } else {
        setError(data.error || data.message || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Cannot connect to server");
    } finally {
      setUploading(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    openUploadModal(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files?.[0];
    openUploadModal(file);
  };

  const getDocumentUrl = (file) => {
    if (!file?.fileUrl) return "#";

    if (file.fileUrl.startsWith("http")) return file.fileUrl;

    return file.fileUrl;
  };

  const handleView = (file) => {
    const url = getDocumentUrl(file);

    if (url === "#") {
      alert("File này chưa có URL để xem. Hãy upload lại file.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (documentId) => {
    const ok = confirm("Bạn có chắc muốn xóa file này không?");
    if (!ok) return;

    try {
      const data = await deleteDocument(documentId);

      if (data.success) {
        setDocs((prev) => prev.filter((doc) => doc.documentId !== documentId));
      } else {
        setError(data.message || "Delete failed");
      }
    } catch (err) {
      console.error(err);
      setError("Cannot delete document");
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();

    if (!newSubject.subjectName.trim()) {
      setError("Subject name is required.");
      return;
    }

    try {
      const result = await createSubject({
        ...newSubject,
        createdBy: currentUser?.userId,
      });

      setNewSubject(defaultNewSubject);
      setSuccess("Subject created.");
      setError("");
      await fetchMetadata();

      if (result.subjectId) {
        setUploadMeta((prev) => ({
          ...prev,
          subjectId: result.subjectId,
          topicId: "",
        }));
        setNewTopic((prev) => ({
          ...prev,
          subjectId: result.subjectId,
        }));
      }
    } catch (err) {
      setError(err.message || "Cannot create subject");
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();

    const subjectIdForTopic = newTopic.subjectId || uploadMeta.subjectId;

    if (!subjectIdForTopic || !newTopic.topicName.trim()) {
      setError("Subject and topic name are required.");
      return;
    }

    try {
      const result = await createTopic({
        ...newTopic,
        subjectId: subjectIdForTopic,
        createdBy: currentUser?.userId,
      });

      setNewTopic((prev) => ({ ...prev, topicName: "", description: "" }));
      setSuccess("Topic created.");
      setError("");
      await fetchMetadata();

      if (result.topicId) {
        setUploadMeta((prev) => ({
          ...prev,
          subjectId: subjectIdForTopic,
          topicId: result.topicId,
        }));
      }
    } catch (err) {
      setError(err.message || "Cannot create topic");
    }
  };

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card
        className={`td-upload-zone border-0 ${
          dragging ? "td-upload-zone--active" : ""
        }`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Card.Body className="d-flex flex-column align-items-center gap-3 py-5">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="td-file-input-hidden"
            onChange={handleFileChange}
          />

          <div className="td-upload-icon">
            <i className="bi bi-upload"></i>
          </div>

          <Card.Text className="td-upload-text mb-0">
            Drop files here or click to browse
          </Card.Text>

          <Card.Text className="td-upload-hint mb-0">
            Metadata will be auto-filled after upload. You can edit it before uploading if needed.
          </Card.Text>

          <Button
            type="button"
            variant="primary"
            className="td-select-btn"
            disabled={uploading}
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
          >
            {uploading ? "Uploading..." : "Select File"}
          </Button>
        </Card.Body>
      </Card>

      <Modal show={showUploadModal} onHide={closeUploadModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Document metadata</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-3">
            <div className="d-flex align-items-center justify-content-between gap-2">
              <p className="text-muted mb-0">
                File: <b>{pendingFile?.name}</b>
              </p>

              <Button
                type="button"
                variant="outline-primary"
                size="sm"
                onClick={() => handleOpenPendingFile(pendingFile)}
                disabled={!pendingFile}
              >
                <i className="bi bi-box-arrow-up-right me-1" />
                Open file
              </Button>
            </div>

            <p className="text-muted mb-0 mt-1">
              Leave fields empty to let the system auto-fill metadata.
            </p>
          </div>

          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Subject / Môn học</Form.Label>
              <Form.Select
                value={uploadMeta.subjectId}
                onChange={(e) =>
                  setUploadMeta((prev) => ({
                    ...prev,
                    subjectId: e.target.value,
                    topicId: "",
                  }))
                }
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.subjectId} value={subject.subjectId}>
                    {subject.subjectCode
                      ? `${subject.subjectCode} - ${subject.subjectName}`
                      : subject.subjectName}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>Topic / Chủ đề</Form.Label>
              <Form.Select
                value={uploadMeta.topicId}
                disabled={!uploadMeta.subjectId}
                onChange={(e) =>
                  setUploadMeta((prev) => ({
                    ...prev,
                    topicId: e.target.value,
                  }))
                }
              >
                <option value="">Select topic</option>
                {filteredTopics.map((topic) => (
                  <option key={topic.topicId} value={topic.topicId}>
                    {topic.topicName}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>Document Type</Form.Label>
              <Form.Select
                value={uploadMeta.documentTypeId}
                onChange={(e) =>
                  setUploadMeta((prev) => ({
                    ...prev,
                    documentTypeId: e.target.value,
                  }))
                }
              >
                <option value="">Select type</option>
                {documentTypes.map((type) => (
                  <option key={type.documentTypeId} value={type.documentTypeId}>
                    {type.typeName}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>Level</Form.Label>
              <Form.Select
                value={uploadMeta.levelId}
                onChange={(e) =>
                  setUploadMeta((prev) => ({
                    ...prev,
                    levelId: e.target.value,
                  }))
                }
              >
                <option value="">Select level</option>
                {documentLevels.map((level) => (
                  <option key={level.levelId} value={level.levelId}>
                    {level.levelName}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>Tags</Form.Label>
              <TagInput
                value={uploadMeta.tags}
                placeholder="Type a tag then press Enter, Tab, or comma"
                onChange={(tags) =>
                  setUploadMeta((prev) => ({ ...prev, tags }))
                }
              />
              <Form.Text className="text-muted">
                Example: rag, chatbot, week 1.
              </Form.Text>
            </Col>

            <Col md={6}>
              <Form.Label>Tên/Ghi chú tài liệu</Form.Label>
              <Form.Control
                value={uploadMeta.summary}
                placeholder="Ví dụ: Slide RAG tuần 1"
                onChange={(e) =>
                  setUploadMeta((prev) => ({
                    ...prev,
                    summary: e.target.value,
                  }))
                }
              />
            </Col>
          </Row>

          <hr />

          <div className="td-section-label mb-2">Teacher quick metadata</div>
          <p className="td-empty-text mb-3">
            Nếu chưa có môn học hoặc chủ đề, teacher có thể tạo nhanh tại đây rồi chọn để upload.
          </p>

          <Form onSubmit={handleCreateSubject} className="mb-3">
            <Row className="g-2">
              <Col md={3}>
                <Form.Control
                  placeholder="Code"
                  value={newSubject.subjectCode}
                  onChange={(e) =>
                    setNewSubject((prev) => ({
                      ...prev,
                      subjectCode: e.target.value,
                    }))
                  }
                />
              </Col>
              <Col md={6}>
                <Form.Control
                  placeholder="Subject name"
                  value={newSubject.subjectName}
                  onChange={(e) =>
                    setNewSubject((prev) => ({
                      ...prev,
                      subjectName: e.target.value,
                    }))
                  }
                />
              </Col>
              <Col md={3}>
                <Button type="submit" className="w-100" disabled={uploading}>
                  Add Subject
                </Button>
              </Col>
            </Row>
          </Form>

          <Form onSubmit={handleCreateTopic}>
            <Row className="g-2">
              <Col md={3}>
                <Form.Select
                  value={newTopic.subjectId || uploadMeta.subjectId}
                  onChange={(e) =>
                    setNewTopic((prev) => ({
                      ...prev,
                      subjectId: e.target.value,
                    }))
                  }
                >
                  <option value="">Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.subjectId} value={subject.subjectId}>
                      {subject.subjectCode || subject.subjectName}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6}>
                <Form.Control
                  placeholder="Topic name"
                  value={newTopic.topicName}
                  onChange={(e) =>
                    setNewTopic((prev) => ({
                      ...prev,
                      topicName: e.target.value,
                    }))
                  }
                />
              </Col>
              <Col md={3}>
                <Button type="submit" className="w-100" disabled={uploading}>
                  Add Topic
                </Button>
              </Col>
            </Row>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" disabled={uploading} onClick={closeUploadModal}>
            Cancel
          </Button>
          <Button variant="primary" disabled={uploading} onClick={handleConfirmUpload}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Card className="td-card td-materials-history-card mt-3">
        <Card.Body>
          <div className="td-materials-table-title">Upload History</div>

          <div className="td-materials-table-wrap">
            <Table className="td-materials-table" borderless>
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>METADATA</th>
                  <th>TYPE</th>
                  <th>STATUS</th>
                  <th>UPLOADED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="td-materials-empty">
                      No uploaded files yet.
                    </td>
                  </tr>
                ) : (
                  paginatedDocs.map((file) => {
                    const type = getFileType(file.fileName, file.fileType);
                    const { cls, icon, label } = fileIcon(type);
                    const normalizedStatus = String(
                      file.reviewStatus || "approved",
                    ).toLowerCase();
                    const statusLabel =
                      normalizedStatus === "approved"
                        ? "Public"
                        : normalizedStatus === "private"
                          ? "Private"
                          : normalizedStatus === "pending"
                            ? "Pending"
                            : normalizedStatus === "rejected"
                              ? "Rejected"
                              : file.reviewStatus || "Unknown";

                    return (
                      <tr key={file.documentId}>
                        <td>
                          <div className="td-materials-name-cell">
                            <div className={`td-file-icon ${cls}`}>
                              <i className={icon} />
                            </div>

                            <div className="td-materials-name-info">
                              <div
                                className="td-materials-file-name"
                                title={file.fileName}
                              >
                                {file.fileName}
                              </div>

                              <div
                                className="td-materials-file-note"
                                title={file.summary || file.documentTypeName || label}
                              >
                                {file.summary || file.documentTypeName || label}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div
                            className="td-materials-subject"
                            title={
                              file.subjectName
                                ? `${file.subjectCode || ""} ${file.subjectName}`.trim()
                                : file.subjectCode || "No Subject"
                            }
                          >
                            {file.subjectCode || "No Subject"}
                            {file.subjectName ? ` - ${file.subjectName}` : ""}
                          </div>

                          <div
                            className="td-materials-meta-line"
                            title={`${file.topicName || "Uncategorized"} · ${
                              file.documentTypeName || "No Type"
                            } · ${file.levelName || "No Level"}`}
                          >
                            {file.topicName || "Uncategorized"} · {file.documentTypeName || "No Type"} · {file.levelName || "No Level"}
                          </div>

                          {file.tags ? (
                            <div
                              className="td-materials-tags"
                              title={file.tags}
                            >
                              Tags: {file.tags}
                            </div>
                          ) : null}
                        </td>

                        <td>
                          <span
                            className={`td-materials-type-badge td-materials-type-badge--${type}`}
                          >
                            {label}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`td-materials-status-badge td-materials-status-badge--${normalizedStatus}`}
                          >
                            {statusLabel}
                          </span>
                        </td>

                        <td className="td-materials-date">
                          {formatDate(file.uploadDate)}
                        </td>

                        <td>
                          <Dropdown
                            align="end"
                            className="td-materials-actions-dropdown"
                          >
                            <Dropdown.Toggle
                              variant="light"
                              className="td-materials-actions-toggle"
                              id={`material-actions-${file.documentId}`}
                              aria-label={`Actions for ${file.fileName}`}
                            >
                              <i className="bi bi-three-dots" />
                            </Dropdown.Toggle>

                            <Dropdown.Menu
                              className="td-materials-actions-menu"
                              popperConfig={{ strategy: "fixed" }}
                            >
                              <Dropdown.Item
                                as="button"
                                type="button"
                                onClick={() => handleView(file)}
                                disabled={!file.fileUrl}
                              >
                                <i className="bi bi-eye td-materials-menu-icon td-materials-menu-icon--view" />
                                <span>Open document</span>
                              </Dropdown.Item>

                              <Dropdown.Divider />

                              <Dropdown.Item
                                as="button"
                                type="button"
                                className="td-materials-menu-delete"
                                onClick={() => handleDelete(file.documentId)}
                              >
                                <i className="bi bi-trash3 td-materials-menu-icon" />
                                <span>Delete document</span>
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>

          {docs.length > PAGE_SIZE && (
            <div className="td-pagination td-pagination--pill">
              <div className="td-pagination__controls">
                <button
                  type="button"
                  className="td-page-btn td-page-btn--text"
                  disabled={safePage === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  <i className="bi bi-chevron-left" />
                  Previous
                </button>

                <div className="td-page-numbers">
                  {paginationItems.map((item) => {
                    if (typeof item === "number") {
                      return (
                        <button
                          type="button"
                          key={item}
                          className={`td-page-btn ${
                            safePage === item ? "td-page-btn--active" : ""
                          }`}
                          onClick={() => setPage(item)}
                        >
                          {item}
                        </button>
                      );
                    }

                    return (
                      <Dropdown
                        key={item}
                        autoClose="outside"
                        className="td-page-jump-dropdown"
                      >
                        <Dropdown.Toggle
                          variant="light"
                          className="td-page-btn td-page-btn--ellipsis"
                          id={`material-${item}`}
                          aria-label="Go to another page"
                        >
                          <i className="bi bi-three-dots" />
                        </Dropdown.Toggle>

                        <Dropdown.Menu className="td-page-jump-menu">
                          <div className="td-page-jump-title">Go to page</div>

                          <div className="td-page-jump-form">
                            <Form.Control
                              type="number"
                              min={1}
                              max={totalPages}
                              value={jumpPage}
                              placeholder={`1-${totalPages}`}
                              onChange={(event) =>
                                setJumpPage(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  goToPage();
                                }
                              }}
                            />

                            <button
                              type="button"
                              className="td-page-jump-go"
                              onClick={goToPage}
                            >
                              Go
                            </button>
                          </div>
                        </Dropdown.Menu>
                      </Dropdown>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="td-page-btn td-page-btn--text"
                  disabled={safePage === totalPages}
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                >
                  Next
                  <i className="bi bi-chevron-right" />
                </button>
              </div>

              <div className="td-pagination__info">
                Showing {startIndex + 1}-
                {Math.min(startIndex + PAGE_SIZE, docs.length)} of {docs.length}{" "}
                documents
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}