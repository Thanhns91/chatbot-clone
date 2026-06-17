import { useEffect, useState } from "react";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Badge,
  Modal,
} from "react-bootstrap";

const API = import.meta.env.VITE_API_URL;

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  if (["mp4", "mov", "avi"].includes(ext))
    return { label: "VIDEO", color: "info" };
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
    return { label: "IMAGE", color: "success" };
  return { label: "OTHER", color: "secondary" };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StudentFilesTab() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const fetchStudentFiles = async () => {
      try {
        const res = await fetch(`${API}/documents/student-files`);
        const data = await res.json();

        if (data.success) {
          setFiles(data.data || []);
        }
      } catch (error) {
        console.error("Cannot load student files", error);
      }
    };

    fetchStudentFiles();
  }, []);

  const filtered = files.filter((f) => {
    const fileName = f.fileName || f.name || "";
    const uploaderName = f.uploaderName || "";

    return (
      fileName.toLowerCase().includes(search.toLowerCase()) ||
      uploaderName.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalDocs = files.length;
  const pdfCount = files.filter((f) =>
    (f.fileName || f.name || "").toLowerCase().endsWith(".pdf"),
  ).length;
  const otherCount = totalDocs - pdfCount;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // handle dropped files here
  };

  const getRawFileUrl = (file) => {
    if (file?.fileUrl) {
      return file.fileUrl.startsWith("http")
        ? file.fileUrl
        : `${API}${file.fileUrl}`;
    }

    if (file?.documentId) {
      return `${API}/documents/view/${file.documentId}`;
    }

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

    // Không dùng Google Viewer cho localhost vì Google không truy cập được localhost
    const isLocalhost = rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");

    if (previewableDocs.includes(ext) && !isLocalhost) {
      return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
        rawUrl
      )}`;
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

    window.open(
      `${API}/documents/download/${file.documentId}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const getDownloadUrl = (file) => {
    const url = getDocumentUrl(file);

    if (!url) return "";

    // Cloudinary: ép tải xuống thay vì mở tab
    if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
      return url.replace("/upload/", "/upload/fl_attachment/");
    }

    return url;
  };

  const handleDelete = async (documentId) => {
    const ok = window.confirm("Bạn có chắc muốn xóa file này không?");
    if (!ok) return;

    try {
      const res = await fetch(`${API}/documents/${documentId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        setFiles((prev) =>
          prev.filter((file) => file.documentId !== documentId)
        );
      } else {
        alert(data.message || "Xóa file thất bại.");
      }
    } catch (error) {
      console.error("Delete student file failed", error);
      alert("Không thể xóa file.");
    }
  };

  return (
    <>
      {/* ── Top bar ── */}
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

      {/* ── Stat cards ── */}
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

      {/* ── File table ── */}
      <Card className="td-sfile-table-card">
        <Card.Body>
          <div className="td-sfile-table-title">All Documents</div>
          <div className="td-sfile-table-wrap">
            <Table className="td-sfile-table" borderless>
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>TYPE</th>
                  <th>UPLOADED</th>
                  <th>UPLOADER</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="td-sfile-empty">
                      No documents found
                    </td>
                  </tr>
                ) : (
                    filtered.map((f) => {
                      const fileName = f.fileName || f.name || "";
                      const uploadedAt = f.uploadDate || f.uploadedAt;
                      const uploaderName = f.uploaderName || "Student";

                      const { cls, icon } = fileIcon(fileName);
                      const { label, color } = typeLabel(fileName);
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
                                {f.reviewStatus || f.size || "private"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge bg={color} className="td-sfile-type-badge">
                            {label}
                          </Badge>
                        </td>
                        <td className="td-sfile-date">
                          {formatDate(uploadedAt)}
                        </td>
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
        </Card.Body>
      </Card>

      {/* ── Upload Modal ── */}
      <Modal
        show={showUpload}
        onHide={() => setShowUpload(false)}
        centered
        size="md"
      >
        <Modal.Header closeButton className="td-modal-header">
          <Modal.Title className="td-modal-title">
            <i className="bi bi-upload" /> Upload Document
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <div
            className={`td-sfile-drop-zone ${dragActive ? "td-sfile-drop-zone--active" : ""}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <div className="td-upload-icon">
              <i className="bi bi-cloud-arrow-up-fill" />
            </div>
            <p className="td-upload-title">Drag & drop files here</p>
            <p className="td-upload-hint">PDF, DOCX, MP4, images supported</p>
            <Button variant="primary" size="sm" className="td-select-btn mt-1">
              Browse Files
            </Button>
          </div>
        </Modal.Body>
        <Modal.Footer className="td-modal-footer">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowUpload(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm">
            Upload
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
