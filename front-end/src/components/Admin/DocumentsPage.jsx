import { useState } from 'react'
import { Row, Col, Table, Form, Button } from 'react-bootstrap'

const INITIAL_DOCS = [
    { id: 1, name: 'Course Syllabus Q1 2026.pdf', type: 'PDF', size: '1.2 MB', uploaded: '2026-03-10', uploader: 'Teacher User' },
    { id: 2, name: 'Member Handbook.docx', type: 'DOCX', size: '345 KB', uploaded: '2026-02-15', uploader: 'Admin' },
    { id: 3, name: 'AI Learning Resources.pdf', type: 'PDF', size: '2.8 MB', uploaded: '2026-01-20', uploader: 'Teacher User' },
    { id: 4, name: 'Progress Report Template.xlsx', type: 'XLSX', size: '88 KB', uploaded: '2025-12-05', uploader: 'Admin' },
    { id: 5, name: 'Lecture Notes Week 1.pdf', type: 'PDF', size: '560 KB', uploaded: '2025-11-10', uploader: 'Teacher User' },
]

const TYPE_BADGE = { PDF: 'badge-pdf', DOCX: 'badge-docx', XLSX: 'badge-xlsx' }

export default function DocumentsPage() {
    const [docs, setDocs] = useState(INITIAL_DOCS)
    const [search, setSearch] = useState('')

    const filtered = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    const pdfCount = docs.filter(d => d.type === 'PDF').length
    const otherCount = docs.filter(d => d.type !== 'PDF').length

    const STATS = [
        { label: 'Total Documents', val: docs.length, color: '#2563eb' },
        { label: 'PDF Files', val: pdfCount, color: '#dc2626' },
        { label: 'Other Files', val: otherCount, color: '#16a34a' },
    ]

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
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button className="btn-purple">
                        <i className="bi bi-upload" /> Upload Document
                    </button>
                </div>

                <Row className="g-3 mb-4">
                    {STATS.map(s => (
                        <Col key={s.label} md={4}>
                            <div className="stat-card">
                                <div>
                                    <div className="stat-label">{s.label}</div>
                                    <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
                                </div>
                            </div>
                        </Col>
                    ))}
                </Row>

                <div className="a-card">
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>All Documents</div>
                    <div className="table-responsive">
                        <Table className="admin-table mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th><th>Type</th><th>Size</th>
                                    <th>Uploaded</th><th>Uploader</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center text-secondary py-4">
                                            No documents found
                                        </td>
                                    </tr>
                                ) : filtered.map(d => (
                                    <tr key={d.id}>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <i className="bi bi-file-earmark text-secondary" />
                                                <span>{d.name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`role-badge ${TYPE_BADGE[d.type] || ''}`}>{d.type}</span>
                                        </td>
                                        <td style={{ color: '#64748b' }}>{d.size}</td>
                                        <td style={{ color: '#64748b' }}>{d.uploaded}</td>
                                        <td style={{ color: '#64748b' }}>{d.uploader}</td>
                                        <td>
                                            <Button
                                                variant="link"
                                                className="btn-del p-0"
                                                onClick={() => setDocs(prev => prev.filter(x => x.id !== d.id))}
                                            >
                                                <i className="bi bi-trash3" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>
        </>
    )
}