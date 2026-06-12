import { useState, useEffect } from 'react'
import { Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'

const API = 'http://localhost:3000'

export default function UsersPage() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setModal] = useState(false)
    const [form, setForm] = useState({ name: '', email: '' })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const activeCount = users.filter(u => u.status === 'active').length
    const blockedCount = users.filter(u => u.status === 'blocked').length

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API}/users`)
            const data = await res.json()
            setUsers(data.map(u => ({
                id: u.userId,
                name: u.fullName,
                email: u.email,
                role: u.role,
                joinDate: u.createdAt?.split('T')[0] || '-',
                status: u.status,
            })))
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchUsers() }, [])

    const toggleBlock = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'blocked' : 'active'
        try {
            await fetch(`${API}/users/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })
            setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u))
        } catch (err) {
            console.error(err)
        }
    }

    const deleteUser = async (id) => {
        if (!confirm('Bạn có chắc muốn xóa user này?')) return
        try {
            const res = await fetch(`${API}/users/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) {
                setUsers(prev => prev.filter(u => u.id !== id))
            } else {
                alert(data.message)
            }
        } catch (err) {
            console.error(err)
        }
    }

    const createTeacher = async () => {
        if (!form.name.trim() || !form.email.trim()) return

        setSubmitting(true)
        setError('')

        try {
            const res = await fetch(`${API}/auth/admin/create-teacher`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: form.name, email: form.email }),
            })
            const data = await res.json()

            if (!data.success) { setError(data.message); return }

            await fetchUsers()
            setForm({ name: '', email: '' })
            setModal(false)
        } catch {
            setError('Không thể kết nối server.')
        } finally {
            setSubmitting(false)
        }
    }

    const STATS = [
        { label: 'Total Users', val: users.length, color: '#2563eb', iconBg: '#dbeafe', icon: 'bi-people-fill' },
        { label: 'Active Users', val: activeCount, color: '#16a34a', iconBg: '#dcfce7', icon: 'bi-check-circle-fill' },
        { label: 'Blocked Users', val: blockedCount, color: '#dc2626', iconBg: '#fee2e2', icon: 'bi-person-slash' },
    ]

    return (
        <>
            <div className="admin-topbar">
                <h1>User Management</h1>
                <p>Manage platform users and permissions</p>
            </div>

            <div className="admin-body">
                <Row className="g-3 mb-4">
                    {STATS.map(s => (
                        <Col key={s.label} md={4}>
                            <div className="stat-card">
                                <div>
                                    <div className="stat-label">{s.label}</div>
                                    <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
                                </div>
                                <div className="stat-icon" style={{ background: s.iconBg, color: s.color }}>
                                    <i className={`bi ${s.icon}`} />
                                </div>
                            </div>
                        </Col>
                    ))}
                </Row>

                <div className="a-card">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-people" style={{ fontSize: 18 }} />
                            <span style={{ fontWeight: 600, fontSize: 15 }}>User Management</span>
                        </div>
                        <button className="btn-purple" onClick={() => { setError(''); setModal(true) }}>
                            <i className="bi bi-person-plus-fill" /> Create Teacher Account
                        </button>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                        <span style={{ fontWeight: 600, fontSize: 14 }}>All Users</span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{users.length} accounts (admin hidden)</span>
                    </div>
                    <div className="table-responsive">
                        <Table className="admin-table mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th><th>Email</th><th>Role</th>
                                    <th>Join Date</th><th>Status</th><th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="text-center py-4">Đang tải...</td></tr>
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-4 text-secondary">No users found</td></tr>
                                ) : users.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 500 }}>{u.name}</td>
                                        <td style={{ color: '#64748b' }}>{u.email}</td>
                                        <td>
                                            <span className={`role-badge ${u.role === 'teacher' ? 'badge-teacher' : 'badge-member'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td style={{ color: '#64748b' }}>{u.joinDate}</td>
                                        <td>
                                            <span className={u.status === 'active' ? 'status-active' : 'status-blocked'}>
                                                {u.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <button className="btn-block" onClick={() => toggleBlock(u.id, u.status)}>
                                                    <i className="bi bi-slash-circle" />
                                                    {u.status === 'active' ? 'Block' : 'Unblock'}
                                                </button>
                                                <button className="btn-del" onClick={() => deleteUser(u.id)}>
                                                    <i className="bi bi-trash3" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>

            <Modal show={showModal} onHide={() => setModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontWeight: 700, fontSize: 18 }}>Create Teacher Account</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold" style={{ fontSize: 13 }}>Full Name</Form.Label>
                        <Form.Control
                            placeholder="Enter teacher name"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        />
                    </Form.Group>
                    <Form.Group className="mb-4">
                        <Form.Label className="fw-semibold" style={{ fontSize: 13 }}>Email Address</Form.Label>
                        <Form.Control
                            type="email"
                            placeholder="teacher@example.com"
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                        />
                    </Form.Group>
                    {error && (
                        <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>
                            ❌ {error}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" className="border" onClick={() => setModal(false)}>Cancel</Button>
                    <button className="btn-purple" onClick={createTeacher} disabled={submitting}>
                        {submitting ? 'Đang tạo...' : 'Create Account'}
                    </button>
                </Modal.Footer>
            </Modal>
        </>
    )
}