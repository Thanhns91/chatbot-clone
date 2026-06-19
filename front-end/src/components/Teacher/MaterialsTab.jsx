import { useEffect, useRef, useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import ListGroup from "react-bootstrap/ListGroup";
import {
  API_URL,
  uploadTeacherFile,
  getTeacherUploadHistory,
  deleteDocument,
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

  if (lowerName.endsWith(".pdf") || lowerType.includes("pdf")) {
    return "pdf";
  }

  if (
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerType.includes("word") ||
    lowerType.includes("document")
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

export default function MaterialsTab() {
  const fileRef = useRef(null);

  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const currentUser = getCurrentUser();

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

  useEffect(() => {
    fetchUploadHistory();
  }, []);

  const validateFile = (file) => {
    const name = file.name.toLowerCase();

    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      return "Only PDF and DOCX files are allowed.";
    }

    return "";
  };

  const handleUploadFile = async (file) => {
    if (!file) return;

    const validateMessage = validateFile(file);

    if (validateMessage) {
      setError(validateMessage);
      return;
    }

    setUploading(true);
    setError("");

    try {
      const data = await uploadTeacherFile(file, currentUser?.userId);

      if (data.needConfirm) {
        const ok = confirm(data.message);

        if (ok) {
          const retry = await uploadTeacherFile(file, currentUser?.userId, {
            allowVersion: true,
          });

          if (retry.success) {
            await fetchUploadHistory();
            setError("");
          } else {
            setError(retry.error || retry.message || "Upload failed");
          }
        } else {
          setError("");
        }

        return;
      }

      if (data.success) {
        await fetchUploadHistory();
        setError("");
      } else {
        setError(data.error || data.message || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      setError("Cannot connect to server");
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

    if (file.fileUrl.startsWith("http")) {
      return file.fileUrl;
    }

    return file.fileUrl;
  };

  const handleView = (file) => {
    const type = getFileType(file.fileName, file.fileType);

    if (type !== "pdf") {
      alert("DOC/DOCX files cannot be previewed. Please download the file.");
      return;
    }

    const url = getDocumentUrl(file);

    if (url === "#") {
      alert("File này chưa có URL để xem. Hãy upload lại file.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = (file) => {
    if (!file?.documentId) {
      alert("Không tìm thấy documentId để tải file.");
      return;
    }

    window.open(
      `${API_URL}/documents/download/${file.documentId}`,
      "_blank",
      "noopener,noreferrer",
    );
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

  return (
    <>
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
            accept=".pdf,.docx"
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
            PDF, DOCX · max 100MB
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

          {error && (
            <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>
          )}
        </Card.Body>
      </Card>

      <Card className="td-card">
        <Card.Body>
          <div className="td-section-label">Upload History</div>

          <ListGroup variant="flush">
            {docs.length === 0 ? (
              <div className="td-empty-text">No uploaded files yet.</div>
            ) : (
              docs.map((file) => {
                const type = getFileType(file.fileName, file.fileType);
                const { cls, icon, label } = fileIcon(type);
                const canPreview = type === "pdf";

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
                        {formatDate(file.uploadDate)} · {label} ·{" "}
                        {file.reviewStatus}
                      </div>
                    </div>

                    <div className="td-file-actions">
                      {canPreview ? (
                        <button
                          type="button"
                          className="td-file-view"
                          title="View file"
                          onClick={() => handleView(file)}
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="td-file-view td-file-view--disabled"
                          title="DOC/DOCX cannot be previewed"
                          disabled
                        >
                          <i className="bi bi-eye-slash"></i>
                        </button>
                      )}

                      <button
                        type="button"
                        className="td-file-download"
                        title="Download file"
                        onClick={() => handleDownload(file)}
                      >
                        <i className="bi bi-download"></i>
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