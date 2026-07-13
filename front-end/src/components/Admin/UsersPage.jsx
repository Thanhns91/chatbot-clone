import { useState, useEffect } from "react";
import { Button, Col, Dropdown, Form, Modal, Row, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { toast } from "react-toastify";

import {
  getUsers,
  deleteUser,
  updateUserStatus,
  createTeacherAccount,
} from "../../services/api";

// Chỉ thêm: mỗi trang tối đa 10 user
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

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages - 1) {
    items.push("right-ellipsis");
  }

  items.push(totalPages);

  return items;
};

const normalizeEmail = (email = "") => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const isValidEmail = (email = "") => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || "").trim());
};

const normalizeName = (name = "") => {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toISOString().split("T")[0];
};

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

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Chỉ thêm: lưu trang đang xem
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");

  const activeCount = users.filter((u) => u.status === "active").length;
  const blockedCount = users.filter((u) => u.status === "blocked").length;

  const totalDocuments = users.reduce(
    (sum, user) => sum + Number(user.totalDocuments || 0),
    0,
  );

  const totalPublic = users.reduce(
    (sum, user) => sum + Number(user.publicDocuments || 0),
    0,
  );

  const totalStorageBytes = users.reduce(
    (sum, user) => sum + Number(user.totalStorageBytes || 0),
    0,
  );

  // Chỉ thêm: xử lý dữ liệu phân trang
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;

  const paginatedUsers = users.slice(startIndex, startIndex + PAGE_SIZE);
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

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const data = await getUsers();

      const userRows = Array.isArray(data) ? data : data?.data || [];

      setUsers(
        userRows.map((u) => ({
          id: u.userId,
          name: u.fullName,
          email: u.email,
          role: u.role,
          joinDate: formatDate(u.createdAt),
          status: u.status,

          totalDocuments: Number(u.totalDocuments || 0),
          uploadedDocuments: Number(u.uploadedDocuments || 0),
          publicDocuments: Number(u.publicDocuments || 0),
          privateDocuments: Number(u.privateDocuments || 0),
          totalStorageBytes: Number(u.totalStorageBytes || 0),
          totalStorageMB: Number(u.totalStorageMB || 0),
          lastUploadAt: u.lastUploadAt,
        })),
      );
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách user!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Chỉ thêm: nếu xóa hết user ở trang cuối thì quay về trang hợp lệ
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleDeleteUser = async (id) => {
    const result = await Swal.fire({
      title: "Xóa người dùng?",
      text: "Bạn có chắc muốn xóa user này?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
    });

    if (!result.isConfirmed) return;

    try {
      const data = await deleteUser(id);

      if (data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        toast.success("Xóa user thành công!");
      } else {
        toast.error(data.message || "Xóa user thất bại!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể kết nối server!");
    }
  };

  const toggleBlock = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "blocked" : "active";

    try {
      await updateUserStatus(id, newStatus);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                status: newStatus,
              }
            : u,
        ),
      );

      toast.success(
        newStatus === "blocked"
          ? "Block user thành công!"
          : "Unblock user thành công!",
      );
    } catch (err) {
      console.error(err);
      toast.error("Thao tác thất bại!");
    }
  };

  const createTeacher = async () => {
    const cleanName = normalizeName(form.name);
    const cleanEmail = normalizeEmail(form.email);

    if (!cleanName || !cleanEmail) {
      setError("Vui lòng nhập đầy đủ tên và email.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Email không hợp lệ. Ví dụ đúng: teacher@gmail.com");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await createTeacherAccount(cleanName, cleanEmail);

      if (!data.success) {
        setError(data.message || "Tạo tài khoản thất bại.");
        return;
      }

      await fetchUsers();

      // Chỉ thêm: sau khi tạo teacher thì về trang đầu
      setCurrentPage(1);

      setForm({ name: "", email: "" });
      setModal(false);

      if (data.mailSent === false) {
        const teacher = data.teacher || {};

        await Swal.fire({
          icon: "warning",
          title: "Tạo tài khoản thành công",
          html: `
            <div style="text-align:left">
              <p>Gửi email thất bại, vui lòng copy thông tin này gửi thủ công cho giáo viên:</p>
              <p><b>Email:</b> ${teacher.email || cleanEmail}</p>
              <p><b>Mật khẩu mặc định:</b> ${
                teacher.defaultPassword || "12345"
              }</p>
            </div>
          `,
          confirmButtonText: "Đã hiểu",
        });
      } else {
        toast.success("Tạo tài khoản teacher và gửi email thành công!");
      }
    } catch (err) {
      console.error(err);
      setError("Không thể kết nối server.");
    } finally {
      setSubmitting(false);
    }
  };

  const STATS = [
    {
      label: "Total Users",
      val: users.length,
      color: "#2563eb",
      iconBg: "#dbeafe",
      icon: "bi-people-fill",
    },
    {
      label: "Active Users",
      val: activeCount,
      color: "#16a34a",
      iconBg: "#dcfce7",
      icon: "bi-check-circle-fill",
    },
    {
      label: "Blocked Users",
      val: blockedCount,
      color: "#dc2626",
      iconBg: "#fee2e2",
      icon: "bi-person-slash",
    },
    {
      label: "Total Documents",
      val: totalDocuments,
      color: "#7c3aed",
      iconBg: "#ede9fe",
      icon: "bi-file-earmark-text-fill",
    },
    {
      label: "Public Documents",
      val: totalPublic,
      color: "#0891b2",
      iconBg: "#cffafe",
      icon: "bi-globe",
    },
    {
      label: "Storage Used",
      val: formatStorage(totalStorageBytes),
      color: "#ea580c",
      iconBg: "#ffedd5",
      icon: "bi-hdd-fill",
    },
  ];

  return (
    <>
      <div className="admin-topbar">
        <h1>User Management</h1>
        <p>AI Learning — Manage users, roles &amp; teacher accounts</p>
      </div>

      <div className="admin-body">
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

                <div
                  className="stat-icon"
                  style={{
                    background: s.iconBg,
                    color: s.color,
                  }}
                >
                  <i className={`bi ${s.icon}`} />
                </div>
              </div>
            </Col>
          ))}
        </Row>

        <div className="a-card">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-people" style={{ fontSize: 18 }} />

                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  User Overview
                </span>
              </div>
            </div>

            <button
              className="btn-purple"
              onClick={() => {
                setError("");
                setForm({ name: "", email: "" });
                setModal(true);
              }}
            >
              <i className="bi bi-person-plus-fill" />
              Create Teacher Account
            </button>
          </div>

          <div className="table-responsive">
            <Table className="admin-table admin-table--users mb-0">
              <colgroup>
                <col className="admin-col-user-name" />
                <col className="admin-col-user-email" />
                <col className="admin-col-user-role" />
                <col className="admin-col-user-documents" />
                <col className="admin-col-user-visibility" />
                <col className="admin-col-user-storage" />
                <col className="admin-col-user-upload" />
                <col className="admin-col-user-status" />
                <col className="admin-col-user-actions" />
              </colgroup>

              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Documents</th>
                  <th>Public / Private</th>
                  <th>Storage</th>
                  <th>Last Upload</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4">
                      Đang tải...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-secondary">
                      No users found
                    </td>
                  </tr>
                ) : (
                  // Chỉ đổi users.map thành paginatedUsers.map
                  paginatedUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="admin-user-name-cell">
                        <div className="admin-primary-line" title={u.name}>
                          {u.name || "-"}
                        </div>
                        <div className="admin-secondary-line admin-no-wrap">
                          Joined {u.joinDate}
                        </div>
                      </td>

                      <td className="admin-user-email-cell">
                        <span className="admin-ellipsis" title={u.email}>
                          {u.email}
                        </span>
                      </td>

                      <td className="admin-user-role-cell">
                        <span
                          className={`role-badge ${
                            u.role === "teacher"
                              ? "badge-teacher"
                              : "badge-member"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="admin-user-documents-cell">
                        <div className="admin-primary-line">
                          {u.totalDocuments}
                        </div>
                        <div className="admin-secondary-line admin-no-wrap">
                          uploaded {u.uploadedDocuments}
                        </div>
                      </td>

                      <td className="admin-user-visibility-cell">
                        <div className="admin-visibility-pair">
                          <span className="status-active">
                            {u.publicDocuments} public
                          </span>
                          <span className="status-blocked">
                            {u.privateDocuments} private
                          </span>
                        </div>
                      </td>

                      <td className="admin-user-storage-cell admin-no-wrap">
                        {formatStorage(u.totalStorageBytes)}
                      </td>

                      <td className="admin-user-upload-cell admin-no-wrap">
                        {formatDate(u.lastUploadAt)}
                      </td>

                      <td className="admin-user-status-cell">
                        <span
                          className={
                            u.status === "active"
                              ? "status-active"
                              : "status-blocked"
                          }
                        >
                          {u.status}
                        </span>
                      </td>

                      <td className="admin-action-cell">
                        <Dropdown
                          align="end"
                          className="document-actions-dropdown"
                        >
                          <Dropdown.Toggle
                            variant="light"
                            className="document-actions-toggle"
                            id={`user-actions-${u.id}`}
                            aria-label={`Open actions for ${u.name}`}
                          >
                            <i className="bi bi-three-dots" />
                          </Dropdown.Toggle>

                          <Dropdown.Menu
                            className="document-actions-menu"
                            popperConfig={{ strategy: "fixed" }}
                          >
                            <Dropdown.Item
                              className={
                                u.status === "active"
                                  ? "user-action-block"
                                  : "user-action-unblock"
                              }
                              onClick={() => toggleBlock(u.id, u.status)}
                            >
                              <i
                                className={`bi ${
                                  u.status === "active"
                                    ? "bi-slash-circle"
                                    : "bi-check-circle"
                                } document-action-icon ${
                                  u.status === "active"
                                    ? "user-action-icon--block"
                                    : "user-action-icon--unblock"
                                }`}
                              />

                              <span>
                                {u.status === "active"
                                  ? "Block user"
                                  : "Unblock user"}
                              </span>
                            </Dropdown.Item>

                            <Dropdown.Divider />

                            <Dropdown.Item
                              className="document-action-delete"
                              onClick={() => handleDeleteUser(u.id)}
                            >
                              <i className="bi bi-trash3 document-action-icon" />
                              <span>Delete user</span>
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {users.length > PAGE_SIZE && (
            <div className="admin-pagination admin-pagination--pill">
              <div className="admin-pagination__controls">
                <button
                  type="button"
                  className="admin-page-btn admin-page-btn--text"
                  disabled={safeCurrentPage === 1}
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
                          id={`user-${item}`}
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
                  disabled={safeCurrentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                >
                  Next
                  <i className="bi bi-chevron-right" />
                </button>
              </div>

              <div className="admin-pagination__info">
                Showing {startIndex + 1}-
                {Math.min(startIndex + PAGE_SIZE, users.length)} of {users.length}{" "}
                results
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal show={showModal} onHide={() => setModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title
            style={{
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            Create Teacher Account
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold" style={{ fontSize: 13 }}>
              Full Name
            </Form.Label>

            <Form.Control
              placeholder="Enter teacher name"
              value={form.name}
              onChange={(e) => {
                setError("");

                setForm((p) => ({
                  ...p,
                  name: e.target.value,
                }));
              }}
              onBlur={() =>
                setForm((p) => ({
                  ...p,
                  name: normalizeName(p.name),
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  createTeacher();
                }
              }}
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="fw-semibold" style={{ fontSize: 13 }}>
              Email Address
            </Form.Label>

            <Form.Control
              type="email"
              placeholder="teacher@example.com"
              value={form.email}
              isInvalid={
                Boolean(form.email.trim()) && !isValidEmail(form.email)
              }
              onChange={(e) => {
                setError("");

                setForm((p) => ({
                  ...p,
                  email: e.target.value,
                }));
              }}
              onBlur={() =>
                setForm((p) => ({
                  ...p,
                  email: normalizeEmail(p.email),
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  createTeacher();
                }
              }}
            />

            <Form.Control.Feedback type="invalid">
              Email không hợp lệ. Ví dụ đúng: teacher@gmail.com
            </Form.Control.Feedback>
          </Form.Group>

          {error && (
            <div
              style={{
                color: "#b91c1c",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="light"
            className="border"
            onClick={() => setModal(false)}
          >
            Cancel
          </Button>

          <button
            className="btn-purple"
            onClick={createTeacher}
            disabled={
              submitting ||
              !normalizeName(form.name) ||
              !normalizeEmail(form.email) ||
              !isValidEmail(form.email)
            }
          >
            {submitting ? "Đang tạo..." : "Create Account"}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}