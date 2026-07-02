import { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Badge,
  Modal,
  Alert,
} from "react-bootstrap";
import { getMetadata, updateDocumentMetadata, deleteDocument } from "../../services/api";

const API = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 10;

function fileIcon(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf")
    return { cls: "td-sfile-icon--pdf", icon: "bi-file-earmark-pdf-fill" };
  if (["doc", "docx"].includes(ext))
    return { cls: "td-sfile-icon--docx", icon: "bi-file-earmark-word-fill" };
  if (["mp4", "mov", "avi"].includes(ext))
    return { cls: "td-sfile-icon--mp4", icon: "bi-play-btn-fill" };
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
    return { cls: "td-sfile-icon--img", icon: "bi-file-earmark-image-fill" };
  return { cls: "td-sfile-icon--other", icon: "bi-file-earmark-fill" };
}

function typeLabel(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return { label: "PDF", color: "danger" };
  if (["doc", "docx"].includes(ext)) return { label: "DOCX", color: "primary" };
  if (["mp4", "mov", "avi"].includes(ext)) return { label: "VIDEO", color: "info" };
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return { label: "IMAGE", color: "success" };
  return { label: "OTHER", color: "secondary" };
}

function getStatusInfo(status = "") {
  const normalized = String(status || "private").toLowerCase();

  if (normalized === "approved") {
    return { label: "Public", color: "success" };
  }

  if (normalized === "private") {
    return { label: "Private", color: "warning" };
  }

  if (normalized === "pending") {
    return { label: "Pending", color: "secondary" };
  }

  if (normalized === "rejected") {
    return { label: "Rejected", color: "danger" };
  }

  return { label: status || "Unknown", color: "secondary" };
}

function formatDate(iso) {
  if (!iso) return "-";

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const emptyEditForm = {
  subjectId: "",
  topicId: "",
  documentTypeId: "",
  levelId: "",
  tags: "",
  summary: "",
  reviewStatus: "",
};

export default function StudentFilesTab() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [documentLevels, setDocumentLevels] = useState([]);

  const [editFile, setEditFile] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);

  const filteredEditTopics = useMemo(() => {
    if (!editForm.subjectId) return topics;

    return topics.filter(
      (topic) => String(topic.subjectId) === String(editForm.subjectId),
    );
  }, [topics, editForm.subjectId]);

  const fetchStudentFiles = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API}/documents/student-files`);
      const data = await res.json();

      if (data.success) {
        setFiles(data.data || []);
      } else {
        setError(data.message || "Cannot load student files");
      }
    } catch (error) {
      console.error("Cannot load student files", error);
      setError("Cannot load student files");
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const data = await getMetadata();

      if (data.success) {
        setSubjects(data.subjects || []);
        setTopics(data.topics || []);
        setDocumentTypes(data.documentTypes || []);
        setDocumentLevels(data.documentLevels || []);
      }
    } catch (error) {
      console.error("Cannot load metadata", error);
    }
  };

  useEffect(() => {
    fetchMetadata();
    fetchStudentFiles();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = files.filter((f) => {
    const fileName = f.fileName || f.name || "";
    const uploaderName = f.uploaderName || "";
    const subject = `${f.subjectCode || ""} ${f.subjectName || ""}`;
    const topic = f.topicName || "";
    const status = f.reviewStatus || f.visibilityStatus || "";

    const keyword = search.toLowerCase();

    return (
      fileName.toLowerCase().includes(keyword) ||
      uploaderName.toLowerCase().includes(keyword) ||
      subject.toLowerCase().includes(keyword) ||
      topic.toLowerCase().includes(keyword) ||
      status.toLowerCase().includes(keyword)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedFiles = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const totalDocs = files.length;
  const pdfCount = files.filter((f) =>
    (f.fileName || f.name || "").toLowerCase().endsWith(".pdf"),
  ).length;
  const otherCount = totalDocs - pdfCount;

  const getRawFileUrl = (file) => {
    if (file?.fileUrl) {
      return file.fileUrl.startsWith("http") ? file.fileUrl : `${API}${file.fileUrl}`;
    }

    if (file?.documentId) return `${API}/documents/view/${file.documentId}`;

    return "";
  };

  const getFileExt = (file) => {
    const fileName = file?.fileName || file?.name || "";
    return fileName.split(".").pop()?.toLowerCase() || "";
  };

  const getPreviewUrl = (file) => {
    const rawUrl = getRawFileUrl(file);
    if (!rawUrl) return "";

    const ext = getFileExt(file);
    const previewableDocs = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"];
    const isLocalhost = rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");

    if (previewableDocs.includes(ext) && !isLocalhost) {
      return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(rawUrl)}`;
    }

    return rawUrl;
  };

  const handleView = (file) => {
    const url = getPreviewUrl(file);

    if (!url) {
      alert("File này chưa có URL để xem. Hãy upload lại file.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = (file) => {
    if (!file?.documentId) {
      alert("File này không có documentId để tải.");
      return;
    }

    window.open(`${API}/documents/download/${file.documentId}`, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (documentId) => {
    const ok = window.confirm("Bạn có chắc muốn xóa file này không?");
    if (!ok) return;

    try {
      const data = await deleteDocument(documentId);

      if (data.success) {
        setFiles((prev) => prev.filter((file) => file.documentId !== documentId));
      } else {
        alert(data.message || "Xóa file thất bại.");
      }
    } catch (error) {
      console.error("Delete student file failed", error);
      alert("Không thể xóa file.");
    }
  };

  const openEditModal = (file) => {
    setEditFile(file);
    setEditForm({
      subjectId: file.subjectId || "",
      topicId: file.topicId || "",
      documentTypeId: file.documentTypeId || "",
      levelId: file.levelId || "",
      tags: file.tags || "",
      summary: file.summary || "",
      reviewStatus: file.reviewStatus || "private",
    });
  };

  const closeEditModal = () => {
    setEditFile(null);
    setEditForm(emptyEditForm);
    setSaving(false);
  };

  const handleSaveMetadata = async () => {
    if (!editFile?.documentId || saving) return;

    try {
      setSaving(true);

      const data = await updateDocumentMetadata(editFile.documentId, editForm);

      if (data.success) {
        await fetchStudentFiles();
        closeEditModal();
      } else {
        alert(data.message || "Cannot update metadata");
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Cannot update metadata");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!editForm.subjectId) return;

    const valid = filteredEditTopics.some(
      (topic) => String(topic.topicId) === String(editForm.topicId),
    );

    if (!valid) {
      setEditForm((prev) => ({
        ...prev,
        topicId: filteredEditTopics[0]?.topicId || "",
      }));
    }
  }, [editForm.subjectId, filteredEditTopics]);

  return (
    <>
      <div className="td-sfile-topbar">
        <div className="td-sfile-searchbox">
          <i className="bi bi-search td-sfile-searchbox__icon" />

          <Form.Control
            type="search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="td-sfile-searchbox__input"
          />
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="td-sfile-stat-card">
            <Card.Body>
              <div className="td-sfile-stat-label">TOTAL DOCUMENTS</div>
              <div className="td-sfile-stat-num td-sfile-stat-num--blue">
                {totalDocs}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="td-sfile-stat-card">
            <Card.Body>
              <div className="td-sfile-stat-label">PDF FILES</div>
              <div className="td-sfile-stat-num td-sfile-stat-num--red">
                {pdfCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="td-sfile-stat-card">
            <Card.Body>
              <div className="td-sfile-stat-label">OTHER FILES</div>
              <div className="td-sfile-stat-num td-sfile-stat-num--green">
                {otherCount}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="td-sfile-table-card">
        <Card.Body>
          <div className="td-sfile-table-title">All Student Documents</div>
          <div className="td-sfile-table-wrap">
            <Table className="td-sfile-table" borderless>
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>METADATA</th>
                  <th>TYPE</th>
                  <th>STATUS</th>
                  <th>UPLOADED</th>
                  <th>UPLOADER</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="td-sfile-empty">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="td-sfile-empty">
                      No documents found
                    </td>
                  </tr>
                ) : (
                  paginatedFiles.map((f) => {
                    const fileName = f.fileName || f.name || "";
                    const uploadedAt = f.uploadDate || f.uploadedAt;
                    const uploaderName = f.uploaderName || "Student";
                    const { cls, icon } = fileIcon(fileName);
                    const { label, color } = typeLabel(fileName);
                    const status = getStatusInfo(f.reviewStatus);

                    return (
                      <tr key={f.documentId || f.id}>
                        <td>
                          <div className="td-sfile-name-cell">
                            <div className={`td-sfile-icon ${cls}`}>
                              <i className={`bi ${icon}`} />
                            </div>
                            <div>
                              <div className="td-sfile-fname">{fileName}</div>
                              <div className="td-sfile-fsize">
                                {f.documentTypeName || "Student document"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="td-sfile-fname">
                            {f.subjectCode || "No Subject"}
                          </div>
                          <div className="td-sfile-fsize">
                            {f.topicName || "Uncategorized"} · {f.documentTypeName || "No Type"} · {f.levelName || "No Level"}
                          </div>
                        </td>

                        <td>
                          <Badge bg={color} className="td-sfile-type-badge">
                            {label}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={status.color} className="td-sfile-type-badge">
                            {status.label}
                          </Badge>
                        </td>
                        <td className="td-sfile-date">{formatDate(uploadedAt)}</td>
                        <td className="td-sfile-uploader">{uploaderName}</td>
                        <td>
                          <div className="td-sfile-actions">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="td-sfile-action-btn"
                              title="View"
                              onClick={() => handleView(f)}
                              disabled={!f.fileUrl && !f.documentId}
                            >
                              <i className="bi bi-eye" />
                            </Button>

                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="td-sfile-action-btn"
                              title="Download"
                              onClick={() => handleDownload(f)}
                              disabled={!f.documentId}
                            >
                              <i className="bi bi-download" />
                            </Button>

                            <Button
                              variant="outline-success"
                              size="sm"
                              className="td-sfile-action-btn"
                              title="Edit Metadata"
                              onClick={() => openEditModal(f)}
                              disabled={!f.documentId}
                            >
                              <i className="bi bi-pencil-square" />
                            </Button>

                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="td-sfile-action-btn"
                              title="Delete"
                              onClick={() => handleDelete(f.documentId)}
                              disabled={!f.documentId}
                            >
                              <i className="bi bi-trash3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="d-flex align-items-center justify-content-between mt-3">
              <div className="text-muted" style={{ fontSize: 13 }}>
                Showing {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </div>

              <div className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={safePage === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>

                <span className="text-muted" style={{ fontSize: 13 }}>
                  Page {safePage} / {totalPages}
                </span>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={safePage === totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={Boolean(editFile)} onHide={closeEditModal} centered size="lg">
        <Modal.Header closeButton className="td-modal-header">
          <Modal.Title className="td-modal-title">
            <i className="bi bi-pencil-square" /> Edit Metadata
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-4">
          <div className="mb-3">
            <strong>{editFile?.fileName}</strong>
          </div>

          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Subject</Form.Label>
              <Form.Select
                value={editForm.subjectId}
                onChange={(e) =>
                  setEditForm((prev) => ({
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
              <Form.Label>Topic</Form.Label>
              <Form.Select
                value={editForm.topicId}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, topicId: e.target.value }))
                }
              >
                <option value="">Select topic</option>
                {filteredEditTopics.map((topic) => (
                  <option key={topic.topicId} value={topic.topicId}>
                    {topic.topicName}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col md={4}>
              <Form.Label>Document Type</Form.Label>
              <Form.Select
                value={editForm.documentTypeId}
                onChange={(e) =>
                  setEditForm((prev) => ({
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

            <Col md={4}>
              <Form.Label>Level</Form.Label>
              <Form.Select
                value={editForm.levelId}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, levelId: e.target.value }))
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

            <Col md={4}>
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={editForm.reviewStatus}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, reviewStatus: e.target.value }))
                }
              >
                <option value="private">Private</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Form.Select>
            </Col>

            <Col md={12}>
              <Form.Label>Tags</Form.Label>
              <Form.Control
                value={editForm.tags}
                placeholder="rag, chatbot, requirement"
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, tags: e.target.value }))
                }
              />
            </Col>

            <Col md={12}>
              <Form.Label>Summary</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={editForm.summary}
                placeholder="Short note about this document"
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, summary: e.target.value }))
                }
              />
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer className="td-modal-footer">
          <Button variant="outline-secondary" size="sm" onClick={closeEditModal}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveMetadata} disabled={saving}>
            {saving ? "Saving..." : "Save Metadata"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}