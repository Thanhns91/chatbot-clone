import { useState, useEffect, useRef } from 'react'

const TYPE_BADGE = { PDF: 'badge-pdf', DOCX: 'badge-docx', XLSX: 'badge-xlsx' }
const API = 'http://localhost:3000'

export default function DocumentsPage({ currentUser }) {
    const [docs, setDocs] = useState([])
    const [search, setSearch] = useState('')
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const fileRef = useRef()

    const fetchDocs = async () => {
        try {
            const res = await fetch(`${API}/documents`)
            const data = await res.json()
            if (data.success) setDocs(data.data)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => { fetchDocs() }, [])

    const filtered = docs.filter(d =>
        d.fileName?.toLowerCase().includes(search.toLowerCase())
    )

    const pdfCount = docs.filter(d => d.fileType?.includes('pdf')).length
    const otherCount = docs.filter(d => !d.fileType?.includes('pdf')).length

    const STATS = [
        { label: 'Total Documents', val: docs.length, color: '#2563eb' },
        { label: 'PDF Files', val: pdfCount, color: '#dc2626' },
        { label: 'Other Files', val: otherCount, color: '#16a34a' },
    ]

    const handleUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setUploading(true)
        setError('')

        const formData = new FormData()
        formData.append('file', file)
        formData.append('uploadedBy', currentUser?.role || 'teacher')
        formData.append('uploaderId', currentUser?.userId || 1)

        try {
            const res = await fetch(`${API}/upload`, {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()

            if (data.documentId) {
                await fetchDocs()
            } else {
                setError(data.error || 'Upload thất bại')
            }
        } catch (err) {
            setError('Không thể kết nối server')
        } finally {
            setUploading(false)
            fileRef.current.value = ''
        }
    }

    const handleDelete = async (documentId) => {
        if (!confirm('Bạn có chắc muốn xóa document này?')) return

        try {
            const res = await fetch(`${API}/documents/${documentId}`, {
                method: 'DELETE',
            })
            const data = await res.json()
            if (data.success) {
                setDocs(prev => prev.filter(d => d.documentId !== documentId))
            }
        } catch (err) {
            setError('Xóa thất bại')
        }
    }

    const getFileType = (fileType) => {
        if (!fileType) return 'OTHER'
        if (fileType.includes('pdf')) return 'PDF'
        if (fileType.includes('word') || fileType.includes('docx')) return 'DOCX'
        if (fileType.includes('sheet') || fileType.includes('xlsx')) return 'XLSX'
        return 'OTHER'
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toISOString().split('T')[0]
    }

    return (
        <>
            <div className="admin-topbar">
                <h1>Documents</h1>
                <p>Manage and organize course documents</p>
            </div>

            <div className="admin-body">
                <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="input-group" style={{ maxWidth: 280 }}>
                        <span className="input-group-text bg-white border-end-0" style={{ borderRadius: '8px 0 0 8px' }}>
                            <i className="bi bi-search text-secondary" />
                        </span>
                        <input className="form-control border-start-0" style={{ borderRadius: '0 8px 8px 0' }}
                            placeholder="Search documents..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>

                    <div>
                        {error && <span style={{ color: '#b91c1c', fontSize: 13, marginRight: 12 }}>❌ {error}</span>}
                        <input
                            type="file"
                            ref={fileRef}
                            style={{ display: 'none' }}
                            accept=".pdf,.docx,.xlsx,.xls"
                            onChange={handleUpload}
                        />
                        <button className="btn-purple" onClick={() => fileRef.current.click()} disabled={uploading}>
                            <i className="bi bi-upload" /> {uploading ? 'Đang upload...' : 'Upload Document'}
                        </button>
                    </div>
                </div>

                <div className="row g-3 mb-4">
                    {STATS.map(s => (
                        <div key={s.label} className="col-md-4">
                            <div className="stat-card">
                                <div>
                                    <div className="stat-label">{s.label}</div>
                                    <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="a-card">
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>All Documents</div>
                    <div className="table-responsive">
                        <table className="table admin-table mb-0">
                            <thead>
                                <tr><th>Name</th><th>Type</th><th>Uploaded By</th><th>Date</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0
                                    ? <tr><td colSpan={6} className="text-center text-secondary py-4">No documents found</td></tr>
                                    : filtered.map(d => (
                                        <tr key={d.id}>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-file-earmark text-secondary" />
                                                    <span>{d.fileName}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`role-badge ${TYPE_BADGE[getFileType(d.fileType)] || ''}`}>
                                                    {getFileType(d.fileType)}
                                                </span>
                                            </td>
                                            <td style={{ color: '#64748b' }}>{d.uploaderName || d.uploadedBy}</td>
                                            <td style={{ color: '#64748b' }}>{formatDate(d.uploadDate)}</td>
                                            <td>
                                                <span className={d.reviewStatus === 'approved' ? 'status-active' : 'status-blocked'}>
                                                    {d.reviewStatus}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="btn-del" onClick={() => handleDelete(d.documentId)}>
                                                    <i className="bi bi-trash3" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    )
}