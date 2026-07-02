import { useState, useEffect } from "react";
import { Button, Col, Form, Modal, Row, Table } from "react-bootstrap";
import Swal from "sweetalert2";
import { toast } from "react-toastify";

import {
  getUsers,
  deleteUser,
  updateUserStatus,
  createTeacherAccount,
} from "../../services/api";

const normalizeEmail = (email = "") => {
  return String(email || "").trim().toLowerCase();
};

const isValidEmail = (email = "") => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(
    String(email || "").trim(),
  );
};

const normalizeName = (name = "") => {
  return String(name || "").trim().replace(/\s+/g, " ");
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
        prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u)),
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
        <p>Mỗi dòng thể hiện tổng tài liệu, dung lượng, file public/private của từng user.</p>
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
                  style={{ background: s.iconBg, color: s.color }}
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
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                  User Overview
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Summary: tổng quan mỗi user theo tài liệu, dung lượng và trạng thái public/private.
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
              <i className="bi bi-person-plus-fill" /> Create Teacher Account
            </button>
          </div>

          <div className="table-responsive">
            <Table className="admin-table mb-0">
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
                  users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>
                        {u.name}
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Joined {u.joinDate}
                        </div>
                      </td>
                      <td style={{ color: "#64748b" }}>{u.email}</td>
                      <td>
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
                      <td>
                        <b>{u.totalDocuments}</b>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          uploaded {u.uploadedDocuments}
                        </div>
                      </td>
                      <td>
                        <span className="status-active">{u.publicDocuments} public</span>
                        <div style={{ marginTop: 4 }}>
                          <span className="status-blocked">{u.privateDocuments} private</span>
                        </div>
                      </td>
                      <td style={{ color: "#64748b" }}>
                        {formatStorage(u.totalStorageBytes)}
                      </td>
                      <td style={{ color: "#64748b" }}>
                        {formatDate(u.lastUploadAt)}
                      </td>
                      <td>
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
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <button
                            className="btn-block"
                            onClick={() => toggleBlock(u.id, u.status)}
                          >
                            <i className="bi bi-slash-circle" />
                            {u.status === "active" ? "Block" : "Unblock"}
                          </button>

                          <button
                            className="btn-del"
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </div>

      <Modal show={showModal} onHide={() => setModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontWeight: 700, fontSize: 18 }}>
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
                setForm((p) => ({ ...p, name: e.target.value }));
              }}
              onBlur={() =>
                setForm((p) => ({ ...p, name: normalizeName(p.name) }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") createTeacher();
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
              isInvalid={Boolean(form.email.trim()) && !isValidEmail(form.email)}
              onChange={(e) => {
                setError("");
                setForm((p) => ({ ...p, email: e.target.value }));
              }}
              onBlur={() =>
                setForm((p) => ({ ...p, email: normalizeEmail(p.email) }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") createTeacher();
              }}
            />
            <Form.Control.Feedback type="invalid">
              Email không hợp lệ. Ví dụ đúng: teacher@gmail.com
            </Form.Control.Feedback>
          </Form.Group>

          {error && (
            <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
              ❌ {error}
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
