import { useState, useEffect, useRef } from "react";
import { Button, Col, Form, Row, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { toast } from "react-toastify";

import {
  getDocuments,
  uploadFile,
  deleteDocument,
  API_URL,
} from "../../services/api";

const TYPE_BADGE = {
  PDF: "badge-pdf",
  DOC: "badge-docx",
  DOCX: "badge-docx",
};

export default function DocumentsPage({ currentUser }) {
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const fetchDocs = async () => {
    try {
      const data = await getDocuments();
      if (data.success) setDocs(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
  const savedUpload = localStorage.getItem("currentUpload");

  if (savedUpload) {
    const parsedUpload = JSON.parse(savedUpload);

    if (parsedUpload.status === "uploading") {
      setUploading(true);

      setTimeout(() => {
        localStorage.removeItem("currentUpload");
        setUploading(false);
        fetchDocs();
      }, 8000);
    }
  }

  fetchDocs();
}, []);

  const getFileType = (fileType, fileName = "") => {
    const type = fileType?.toLowerCase() || "";
    const name = fileName?.toLowerCase() || "";

    if (type.includes("pdf") || name.endsWith(".pdf")) return "PDF";
    if (
      type.includes("word") ||
      type.includes("docx") ||
      name.endsWith(".docx")
    ) {
      return "DOCX";
    }
    if (name.endsWith(".doc")) return "DOC";

    return "OTHER";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toISOString().split("T")[0];
  };

  const getDocumentUrl = (d) => {
    if (!d.fileUrl) return "#";
    if (d.fileUrl.startsWith("http")) return d.fileUrl;
    return `${API_URL}${d.fileUrl}`;
  };

  const canViewFile = (d) => getFileType(d.fileType, d.fileName) === "PDF";

  const filtered = docs.filter((d) =>
    d.fileName?.toLowerCase().includes(search.toLowerCase())
  );

  const pdfCount = docs.filter(
    (d) => getFileType(d.fileType, d.fileName) === "PDF"
  ).length;

  const otherCount = docs.filter(
    (d) => getFileType(d.fileType, d.fileName) !== "PDF"
  ).length;

  const STATS = [
    { label: "Total Documents", val: docs.length, color: "#2563eb" },
    { label: "PDF Files", val: pdfCount, color: "#dc2626" },
    { label: "Other Files", val: otherCount, color: "#16a34a" },
  ];

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const fileName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some((ext) => fileName.endsWith(ext));

    if (!isAllowed) {
      toast.error("Chỉ cho phép upload file PDF, DOC, DOCX");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const user =
      currentUser || JSON.parse(sessionStorage.getItem("currentUser") || "{}");

    const role = user?.role === "admin" ? "teacher" : user?.role || "teacher";

    if (!user?.userId) {
      toast.error("Không tìm thấy userId, vui lòng đăng nhập lại.");
      return;
    }

localStorage.setItem(
  "currentUpload",
  JSON.stringify({
    fileName: file.name,
    status: "uploading",
    startTime: Date.now(),
  })
);

    setUploading(true);

    try {
      const data = await uploadFile(file, {
        uploadedBy: role,
        uploaderId: user.userId,
      });

      if (data.success || data.documentId || data.data?.documentId) {
        localStorage.removeItem("currentUpload");
        await fetchDocs();
        toast.success("Upload tài liệu thành công!");
      } else {
        localStorage.removeItem("currentUpload");
        toast.error(data.error || data.message || "Upload thất bại");
      }
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      localStorage.removeItem("currentUpload");
      toast.error("Không thể kết nối server");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (documentId) => {
    const result = await Swal.fire({
      title: "Xóa tài liệu?",
      text: "Bạn có chắc muốn xóa document này?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
    });

    if (!result.isConfirmed) return;

    try {
      const data = await deleteDocument(documentId);

      if (data.success) {
        setDocs((prev) => prev.filter((d) => d.documentId !== documentId));
        toast.success("Xóa tài liệu thành công!");
      } else {
        toast.error(data.message || "Xóa thất bại");
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể kết nối server!");
    }
  };

  return (
    <>
      <div className="admin-topbar">
        <h1>Documents</h1>
        <p>Manage and organize course documents</p>
      </div>

      <div className="admin-body">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="search-box">
            <i className="bi bi-search search-box__icon" />
            <Form.Control
              className="search-box__input"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <input
              type="file"
              ref={fileRef}
              style={{ display: "none" }}
              accept=".pdf,.doc,.docx"
              onChange={handleUpload}
            />

            <button
              className="btn-purple"
              onClick={() => fileRef.current.click()}
              disabled={uploading}
            >
              <i className="bi bi-upload" />{" "}
              {uploading ? "Đang upload..." : "Upload Document"}
            </button>
          </div>
        </div>

        <Row className="g-3 mb-4">
          {STATS.map((s) => (
            <Col key={s.label} md={4}>
              <div className="stat-card">
                <div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-val" style={{ color: s.color }}>
                    {s.val}
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        <div className="a-card">
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
            All Documents
          </div>

          <div className="table-responsive">
            <Table className="admin-table mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Uploaded</th>
                  <th>Uploader</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-4">
                      No documents found
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => {
                    const fileType = getFileType(d.fileType, d.fileName);
                    const fileUrl = getDocumentUrl(d);
                    const isViewable = canViewFile(d);

                    return (
                      <tr key={d.documentId}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-file-earmark text-secondary" />

                            {isViewable ? (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  textDecoration: "none",
                                  color: "#2563eb",
                                  fontWeight: 500,
                                }}
                              >
                                {d.fileName}
                              </a>
                            ) : (
                              <span style={{ fontWeight: 500 }}>
                                {d.fileName}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`role-badge ${
                              TYPE_BADGE[fileType] || ""
                            }`}
                          >
                            {fileType}
                          </span>
                        </td>

                        <td style={{ color: "#64748b" }}>
                          {formatDate(d.uploadDate)}
                        </td>

                        <td style={{ color: "#64748b" }}>
                          {d.uploaderName || d.uploadedBy}
                        </td>

                        <td>
                          <span
                            className={
                              d.reviewStatus === "approved"
                                ? "status-active"
                                : "status-blocked"
                            }
                          >
                            {d.reviewStatus}
                          </span>
                        </td>

                        <td>
                          <div className="d-flex align-items-center gap-3">
                            {isViewable ? (
                              <Button
                                variant="link"
                                className="p-0"
                                title="View document"
                                onClick={() => window.open(fileUrl, "_blank")}
                              >
                                <i className="bi bi-eye" />
                              </Button>
                            ) : (
                              <span
                                title="This file type cannot be previewed"
                                style={{
                                  color: "#94a3b8",
                                  cursor: "not-allowed",
                                  fontSize: 16,
                                }}
                              >
                                <i className="bi bi-eye-slash" />
                              </span>
                            )}

                            <a
                              href={fileUrl}
                              download={d.fileName}
                              title="Download document"
                              style={{ color: "#16a34a" }}
                            >
                              <i className="bi bi-download" />
                            </a>

                            <Button
                              variant="link"
                              className="btn-del p-0"
                              title="Delete document"
                              onClick={() => handleDelete(d.documentId)}
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
        </div>
      </div>
    </>
  );
}