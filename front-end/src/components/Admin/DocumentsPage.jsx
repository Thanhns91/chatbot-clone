import { useState, useEffect } from "react";
import { Button, Col, Form, Row, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { toast } from "react-toastify";

import { getDocuments, deleteDocument, API_URL } from "../../services/api";

const formatStorage = (bytes = 0) => {
  const value = Number(bytes || 0);

  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KB`;
  }

  return `${value} B`;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 10;

  const fetchDocs = async () => {
    try {
      const data = await getDocuments();

      if (data.success) {
        setDocs(data.data || []);
      } else if (Array.isArray(data)) {
        setDocs(data);
      } else {
        setDocs([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách tài liệu!");
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const getFileType = (fileType, fileName = "") => {
    const type = fileType?.toLowerCase() || "";
    const name = fileName?.toLowerCase() || "";

    if (type.includes("pdf") || name.endsWith(".pdf")) return "PDF";

    if (
      type.includes("word") ||
      type.includes("docx") ||
      type.includes("officedocument") ||
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

  const getPreviewUrl = (d) => {
    const url = getDocumentUrl(d);

    if (url === "#") return "#";

    const fileType = getFileType(d.fileType, d.fileName);

    if (fileType === "DOC" || fileType === "DOCX") {
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
        url,
      )}`;
    }

    return url;
  };

  const filtered = docs.filter((d) => {
    const term = search.toLowerCase();

    return (
      d.fileName?.toLowerCase().includes(term) ||
      d.uploaderName?.toLowerCase().includes(term) ||
      d.subjectCode?.toLowerCase().includes(term) ||
      d.subjectName?.toLowerCase().includes(term) ||
      d.topicName?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedDocs = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const pdfCount = docs.filter(
    (d) => getFileType(d.fileType, d.fileName) === "PDF",
  ).length;

  const publicCount = docs.filter((d) => d.reviewStatus === "approved").length;
  const privateCount = docs.filter((d) => d.reviewStatus === "private").length;
  const totalStorageBytes = docs.reduce(
    (sum, d) => sum + Number(d.fileSizeBytes || 0),
    0,
  );
  const totalChatUse = docs.reduce(
    (sum, d) => sum + Number(d.chatUseCount || 0),
    0,
  );

  const STATS = [
    { label: "Total Documents", val: docs.length, color: "#2563eb" },
    { label: "Public Files", val: publicCount, color: "#16a34a" },
    { label: "Private Files", val: privateCount, color: "#dc2626" },
    { label: "PDF Files", val: pdfCount, color: "#ea580c" },
    { label: "Storage Used", val: formatStorage(totalStorageBytes), color: "#7c3aed" },
    { label: "Chat Usage", val: totalChatUse, color: "#0891b2" },
  ];

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
      </div>

      <div className="admin-body">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="search-box">
            <i className="bi bi-search search-box__icon" />
            <Form.Control
              className="search-box__input"
              placeholder="Search file, uploader, subject, topic"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            All Documents
          </div>
          <div className="table-responsive">
            <Table className="admin-table mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject / Type</th>
                  <th>Uploader</th>
                  <th>Visibility</th>
                  <th>Storage</th>
                  <th>Chat Uses</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-secondary py-4">
                      No documents found
                    </td>
                  </tr>
                ) : (
                  paginatedDocs.map((d) => {
                    const fileType = getFileType(d.fileType, d.fileName);
                    const fileUrl = getDocumentUrl(d);
                    const previewUrl = getPreviewUrl(d);

                    return (
                      <tr key={d.documentId}>
                        <td>
                          <div className="d-flex align-items-start gap-2">
                            <i className="bi bi-file-earmark text-secondary mt-1" />

                            <div>
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  textDecoration: "none",
                                  color: "#2563eb",
                                  fontWeight: 600,
                                }}
                              >
                                {d.fileName}
                              </a>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {d.subjectCode
                              ? `${d.subjectCode} - ${d.subjectName || ""}`
                              : "No Subject"}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            {d.topicName || "Uncategorized"} ·{" "}
                            {d.documentTypeName || fileType}
                          </div>
                        </td>

                        <td style={{ color: "#64748b" }}>
                          <div>{d.uploaderName || d.uploadedBy}</div>
                          <div style={{ fontSize: 12 }}>
                            {d.uploaderRole || d.uploadedBy}
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              d.reviewStatus === "approved"
                                ? "status-active"
                                : "status-blocked"
                            }
                          >
                            {d.reviewStatus === "approved" ? "Public" : d.reviewStatus}
                          </span>
                        </td>

                        <td style={{ color: "#64748b" }}>
                          {formatStorage(d.fileSizeBytes)}
                        </td>

                        <td>
                          <b>{Number(d.chatUseCount || 0)}</b>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            sessions
                          </div>
                        </td>

                        <td style={{ color: "#64748b" }}>
                          {formatDate(d.uploadDate)}
                        </td>

                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <Button
                              variant="link"
                              className="p-0"
                              title="Open document"
                              onClick={() =>
                                window.open(previewUrl, "_blank", "noopener,noreferrer")
                              }
                            >
                              <i className="bi bi-eye" />
                            </Button>

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

            {filtered.length > PAGE_SIZE && (
              <div className="d-flex align-items-center justify-content-between px-3 py-3 border-top">
                <div className="text-secondary" style={{ fontSize: 13 }}>
                  Showing {startIndex + 1}-
                  {Math.min(startIndex + PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length} documents
                </div>

                <div className="d-flex align-items-center gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>

                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    Page {safeCurrentPage} / {totalPages}
                  </span>

                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
