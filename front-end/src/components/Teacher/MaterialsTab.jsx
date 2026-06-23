import { useEffect, useMemo, useRef, useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import ListGroup from "react-bootstrap/ListGroup";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
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

export default function MaterialsTab() {
  const fileRef = useRef(null);

  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [documentLevels, setDocumentLevels] = useState([]);

  const [uploadMeta, setUploadMeta] = useState(defaultUploadMeta);
  const [newSubject, setNewSubject] = useState({
    subjectCode: "",
    subjectName: "",
    description: "",
  });
  const [newTopic, setNewTopic] = useState({
    subjectId: "",
    topicName: "",
    description: "",
  });

  const currentUser = getCurrentUser();

  const filteredTopics = useMemo(() => {
    if (!uploadMeta.subjectId) return topics;

    return topics.filter(
      (topic) => String(topic.subjectId) === String(uploadMeta.subjectId),
    );
  }, [topics, uploadMeta.subjectId]);

  const newTopicSubjects = subjects;

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

        setUploadMeta((prev) => {
          const nextSubjectId = prev.subjectId || loadedSubjects[0]?.subjectId || "";
          const topicOfSubject = loadedTopics.find(
            (topic) => String(topic.subjectId) === String(nextSubjectId),
          );

          return {
            ...prev,
            subjectId: nextSubjectId,
            topicId: prev.topicId || topicOfSubject?.topicId || "",
            documentTypeId: prev.documentTypeId || loadedTypes[0]?.documentTypeId || "",
            levelId: prev.levelId || loadedLevels[0]?.levelId || "",
          };
        });

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
        topicId: filteredTopics[0]?.topicId || "",
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

  const validateMetadataBeforeUpload = () => {
    if (!uploadMeta.subjectId) return "Please select a subject.";
    if (!uploadMeta.topicId) return "Please select a topic.";
    if (!uploadMeta.documentTypeId) return "Please select a document type.";
    if (!uploadMeta.levelId) return "Please select a level.";

    return "";
  };

  const uploadWithMeta = async (file, extraOptions = {}) => {
    return uploadTeacherFile(file, currentUser?.userId, {
      ...uploadMeta,
      ...extraOptions,
    });
  };

  const handleUploadFile = async (file) => {
    if (!file) return;

    const validateMessage = validateFile(file) || validateMetadataBeforeUpload();

    if (validateMessage) {
      setError(validateMessage);
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const data = await uploadWithMeta(file);

      if (data.needConfirm) {
        const saveAsVersion = window.confirm(
          `${data.message}\n\nOK = Save as new version\nCancel = Replace old file`,
        );

        const retry = await uploadWithMeta(file, {
          duplicateAction: saveAsVersion ? "new_version" : "replace_old",
          replaceDocumentId: data.existingDocumentId,
          allowVersion: saveAsVersion,
        });

        if (retry.success) {
          await fetchUploadHistory();
          setSuccess(retry.message || "Upload successful");
          setError("");
        } else {
          setError(retry.error || retry.message || "Upload failed");
        }

        return;
      }

      if (data.success) {
        await fetchUploadHistory();
        setSuccess(data.message || "Upload successful");
        setError("");
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
    handleUploadFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files?.[0];
    handleUploadFile(file);
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
      await createSubject({
        ...newSubject,
        createdBy: currentUser?.userId,
      });

      setNewSubject({ subjectCode: "", subjectName: "", description: "" });
      setSuccess("Subject created.");
      setError("");
      await fetchMetadata();
    } catch (err) {
      setError(err.message || "Cannot create subject");
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();

    if (!newTopic.subjectId || !newTopic.topicName.trim()) {
      setError("Subject and topic name are required.");
      return;
    }

    try {
      await createTopic({
        ...newTopic,
        createdBy: currentUser?.userId,
      });

      setNewTopic((prev) => ({ ...prev, topicName: "", description: "" }));
      setSuccess("Topic created.");
      setError("");
      await fetchMetadata();
    } catch (err) {
      setError(err.message || "Cannot create topic");
    }
  };

  return (
    <>
      <Card className="td-card mb-3">
        <Card.Body>
          <div className="td-section-label">Document Metadata</div>
          <p className="td-empty-text mb-3">
            Select metadata before uploading so the file appears in the correct subject and topic.
          </p>

          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <Row className="g-3">
            <Col md={3}>
              <Form.Label>Subject</Form.Label>
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

            <Col md={3}>
              <Form.Label>Topic</Form.Label>
              <Form.Select
                value={uploadMeta.topicId}
                onChange={(e) =>
                  setUploadMeta((prev) => ({ ...prev, topicId: e.target.value }))
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

            <Col md={3}>
              <Form.Label>Type</Form.Label>
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

            <Col md={3}>
              <Form.Label>Level</Form.Label>
              <Form.Select
                value={uploadMeta.levelId}
                onChange={(e) =>
                  setUploadMeta((prev) => ({ ...prev, levelId: e.target.value }))
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

            <Col md={8}>
              <Form.Label>Tags</Form.Label>
              <Form.Control
                value={uploadMeta.tags}
                placeholder="rag, chatbot, requirement"
                onChange={(e) =>
                  setUploadMeta((prev) => ({ ...prev, tags: e.target.value }))
                }
              />
            </Col>

            <Col md={4}>
              <Form.Label>Short Summary</Form.Label>
              <Form.Control
                value={uploadMeta.summary}
                placeholder="Optional"
                onChange={(e) =>
                  setUploadMeta((prev) => ({ ...prev, summary: e.target.value }))
                }
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="td-card mb-3">
        <Card.Body>
          <div className="td-section-label">Create Metadata</div>

          <Row className="g-3">
            <Col lg={6}>
              <Form onSubmit={handleCreateSubject}>
                <Row className="g-2">
                  <Col md={4}>
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
                  <Col md={5}>
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
                    <Button type="submit" className="w-100">
                      Add Subject
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Col>

            <Col lg={6}>
              <Form onSubmit={handleCreateTopic}>
                <Row className="g-2">
                  <Col md={4}>
                    <Form.Select
                      value={newTopic.subjectId}
                      onChange={(e) =>
                        setNewTopic((prev) => ({
                          ...prev,
                          subjectId: e.target.value,
                        }))
                      }
                    >
                      <option value="">Subject</option>
                      {newTopicSubjects.map((subject) => (
                        <option key={subject.subjectId} value={subject.subjectId}>
                          {subject.subjectCode || subject.subjectName}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={5}>
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
                    <Button type="submit" className="w-100">
                      Add Topic
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Col>
          </Row>
        </Card.Body>
      </Card>

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
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <div className="td-upload-icon">
            <i className="bi bi-upload"></i>
          </div>

          <Card.Text className="td-upload-text mb-0">
            Drop files here or click to browse
          </Card.Text>

          <Card.Text className="td-upload-hint mb-0">
            PDF, DOC, DOCX · max 100MB
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
            {uploading ? "Uploading..." : "Select Files"}
          </Button>
        </Card.Body>
      </Card>

      <Card className="td-card mt-3">
        <Card.Body>
          <div className="td-section-label">Upload History</div>

          <ListGroup variant="flush">
            {docs.length === 0 ? (
              <div className="td-empty-text">No uploaded files yet.</div>
            ) : (
              docs.map((file) => {
                const type = getFileType(file.fileName, file.fileType);
                const { cls, icon, label } = fileIcon(type);

                return (
                  <ListGroup.Item
                    key={file.documentId}
                    className="td-file-item px-0"
                  >
                    <div className={`td-file-icon ${cls}`}>
                      <i className={icon}></i>
                    </div>

                    <div className="td-file-info">
                      <div className="td-file-name">{file.fileName}</div>

                      <div className="td-file-meta">
                        {formatDate(file.uploadDate)} · {label} · {file.reviewStatus}
                        {file.subjectCode || file.topicName ? (
                          <>
                            {" "}· {file.subjectCode || "No Subject"} / {file.topicName || "Uncategorized"}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="td-file-actions">
                      <button
                        type="button"
                        className="td-file-view"
                        title="View file"
                        onClick={() => handleView(file)}
                      >
                        <i className="bi bi-eye"></i>
                      </button>

                      <button
                        type="button"
                        className="td-file-delete"
                        title="Delete file"
                        onClick={() => handleDelete(file.documentId)}
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    </div>
                  </ListGroup.Item>
                );
              })
            )}
          </ListGroup>
        </Card.Body>
      </Card>
    </>
  );
}