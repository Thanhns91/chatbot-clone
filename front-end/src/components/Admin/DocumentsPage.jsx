import { useState, useEffect } from "react";
import { Button, Col, Dropdown, Form, Row, Table } from "react-bootstrap";
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

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages - 1) {
    items.push("right-ellipsis");
  }

  items.push(totalPages);

  return items;
};


const getDocumentVisibility = (document) => {
  const status = String(
    document?.visibilityStatus ||
      document?.reviewStatus ||
      "private",
  ).toLowerCase();

  return ["public", "approved"].includes(status)
    ? "public"
    : "private";
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");

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
  const paginationItems = buildPaginationItems(
    safeCurrentPage,
    totalPages,
  );

  const goToPage = () => {
    const pageNumber = Number(jumpPage);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      toast.error(`Vui lòng nhập số trang từ 1 đến ${totalPages}.`);
      return;
    }

    setCurrentPage(pageNumber);
    setJumpPage("");
  };

  const pdfCount = docs.filter(
    (d) => getFileType(d.fileType, d.fileName) === "PDF",
  ).length;

  const publicCount = docs.filter(
    (d) => getDocumentVisibility(d) === "public",
  ).length;

  const privateCount = docs.filter(
    (d) => getDocumentVisibility(d) === "private",
  ).length;
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
    {
      label: "Storage Used",
      val: formatStorage(totalStorageBytes),
      color: "#7c3aed",
    },
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
        <h1>Document Management</h1>
        <p>AI Learning — Manage learning materials &amp; document access</p>
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
            <Table className="admin-table admin-table--documents mb-0">
              <colgroup>
                <col className="admin-col-document-name" />
                <col className="admin-col-document-subject" />
                <col className="admin-col-document-uploader" />
                <col className="admin-col-document-visibility" />
                <col className="admin-col-document-storage" />
                <col className="admin-col-document-chat" />
                <col className="admin-col-document-uploaded" />
                <col className="admin-col-document-actions" />
              </colgroup>

              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject / Type</th>
                  <th>Uploader</th>
                  <th>Public / Private</th>
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
                    const visibility = getDocumentVisibility(d);
                    const isPublic = visibility === "public";
                    const previewUrl = isPublic ? getPreviewUrl(d) : "#";
                    const canView = isPublic && previewUrl !== "#";

                    return (
                      <tr key={d.documentId}>
                        <td className="admin-document-name-cell">
                          <div className="admin-document-name-wrap">
                            <i className="bi bi-file-earmark admin-document-file-icon" />

                            {canView ? (
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="admin-document-name-link"
                                title={d.fileName}
                              >
                                {d.fileName}
                              </a>
                            ) : (
                              <span
                                className="admin-primary-line admin-ellipsis"
                                title={`${d.fileName} — Private document cannot be opened`}
                              >
                                {d.fileName}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="admin-document-subject-cell">
                          <div
                            className="admin-primary-line admin-ellipsis"
                            title={
                              d.subjectCode
                                ? `${d.subjectCode} - ${d.subjectName || ""}`
                                : "No Subject"
                            }
                          >
                            {d.subjectCode
                              ? `${d.subjectCode} - ${d.subjectName || ""}`
                              : "No Subject"}
                          </div>
                          <div
                            className="admin-secondary-line admin-ellipsis"
                            title={`${d.topicName || "Uncategorized"} · ${
                              d.documentTypeName || fileType
                            }`}
                          >
                            {d.topicName || "Uncategorized"} ·{" "}
                            {d.documentTypeName || fileType}
                          </div>
                        </td>

                        <td className="admin-document-uploader-cell">
                          <div
                            className="admin-primary-line admin-ellipsis"
                            title={d.uploaderName || d.uploadedBy}
                          >
                            {d.uploaderName || d.uploadedBy || "-"}
                          </div>
                          <div className="admin-secondary-line admin-no-wrap">
                            {d.uploaderRole || d.uploadedBy || "-"}
                          </div>
                        </td>

                        <td className="admin-document-visibility-cell">
                          <span
                            className={
                              isPublic ? "status-active" : "status-blocked"
                            }
                          >
                            {isPublic ? "Public" : "Private"}
                          </span>
                        </td>

                        <td className="admin-document-storage-cell admin-no-wrap">
                          {formatStorage(d.fileSizeBytes)}
                        </td>

                        <td className="admin-document-chat-cell">
                          <div className="admin-primary-line">
                            {Number(d.chatUseCount || 0)}
                          </div>
                          <div className="admin-secondary-line admin-no-wrap">
                            sessions
                          </div>
                        </td>

                        <td className="admin-document-uploaded-cell admin-no-wrap">
                          {formatDate(d.uploadDate)}
                        </td>

                        <td className="admin-action-cell">
                          <Dropdown
                            align="end"
                            className="document-actions-dropdown"
                          >
                            <Dropdown.Toggle
                              variant="light"
                              className="document-actions-toggle"
                              id={`document-actions-${d.documentId}`}
                              aria-label={`Open actions for ${d.fileName}`}
                            >
                              <i className="bi bi-three-dots" />
                            </Dropdown.Toggle>

                            <Dropdown.Menu
                              className="document-actions-menu"
                              popperConfig={{ strategy: "fixed" }}
                            >
                              <Dropdown.Item
                                onClick={() =>
                                  window.open(
                                    previewUrl,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                                disabled={!canView}
                              >
                                <i className="bi bi-eye document-action-icon document-action-icon--view" />
                                <span>Open document</span>
                              </Dropdown.Item>

                              <Dropdown.Item
                                as="a"
                                href={fileUrl}
                                download={d.fileName}
                                disabled={fileUrl === "#"}
                              >
                                <i className="bi bi-download document-action-icon document-action-icon--download" />
                                <span>Download</span>
                              </Dropdown.Item>

                              <Dropdown.Divider />

                              <Dropdown.Item
                                className="document-action-delete"
                                onClick={() => handleDelete(d.documentId)}
                              >
                                <i className="bi bi-trash3 document-action-icon" />
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

            {filtered.length > PAGE_SIZE && (
              <div className="admin-pagination admin-pagination--pill">
                <div className="admin-pagination__controls">
                  <button
                    type="button"
                    className="admin-page-btn admin-page-btn--text"
                    disabled={safeCurrentPage <= 1}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                  >
                    <i className="bi bi-chevron-left" />
                    Previous
                  </button>

                  <div className="admin-page-numbers">
                    {paginationItems.map((item) => {
                      if (typeof item === "number") {
                        return (
                          <button
                            type="button"
                            key={item}
                            className={`admin-page-btn ${
                              safeCurrentPage === item
                                ? "admin-page-btn--active"
                                : ""
                            }`}
                            onClick={() => setCurrentPage(item)}
                          >
                            {item}
                          </button>
                        );
                      }

                      return (
                        <Dropdown
                          key={item}
                          autoClose="outside"
                          className="admin-page-jump-dropdown"
                        >
                          <Dropdown.Toggle
                            variant="light"
                            className="admin-page-btn admin-page-btn--ellipsis"
                            id={`document-${item}`}
                            aria-label="Go to another page"
                          >
                            <i className="bi bi-three-dots" />
                          </Dropdown.Toggle>

                          <Dropdown.Menu className="admin-page-jump-menu">
                            <div className="admin-page-jump-title">
                              Go to page
                            </div>

                            <div className="admin-page-jump-form">
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
                                className="admin-page-jump-go"
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
                    className="admin-page-btn admin-page-btn--text"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
                      )
                    }
                  >
                    Next
                    <i className="bi bi-chevron-right" />
                  </button>
                </div>

                <div className="admin-pagination__info">
                  Showing {startIndex + 1}-
                  {Math.min(startIndex + PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length} results
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}