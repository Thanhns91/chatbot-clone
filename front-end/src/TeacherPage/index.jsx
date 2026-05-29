import { useState } from "react";
import "./index.css";

/* ─── Data ──────────────────────────────────────────────── */
const initialSubmissions = [
  { id: 1, name: "Introduction to Algebra.pdf",  author: "John Doe",    date: "2026-05-18", size: "1.2 MB",  status: "pending" },
  { id: 2, name: "Biology Chapter 5 Notes.docx", author: "Member User", date: "2026-05-19", size: "856 KB", status: "pending" },
  { id: 3, name: "History Essay Draft.pdf",       author: "John Doe",    date: "2026-05-20", size: "2.1 MB",  status: "approved" },
  { id: 4, name: "Chemistry Lab Report.pdf",      author: "Member User", date: "2026-05-20", size: "3.4 MB",  status: "rejected" },
];

/* ─── FileIcon ──────────────────────────────────────────── */
function FileIcon() {
  return (
    <div className="td-file-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="#3b5bdb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>
  );
}

/* ─── StatusBadge ───────────────────────────────────────── */
function StatusBadge({ status }) {
  return (
    <span className={`td-status-badge td-status-badge--${status}`}>
      {status}
    </span>
  );
}

/* ─── StatCard ──────────────────────────────────────────── */
function StatCard({ label, value, icon, iconMod }) {
  return (
    <div className="td-stat-card">
      <div>
        <div className="td-stat-label">{label}</div>
        <div className="td-stat-value">{value}</div>
      </div>
      <div className={`td-stat-icon td-stat-icon--${iconMod}`}>{icon}</div>
    </div>
  );
}

/* ─── TabBtn ────────────────────────────────────────────── */
function TabBtn({ active, onClick, children }) {
  return (
    <button
      className={`td-tab-btn ${active ? "td-tab-btn--active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ─── SubmissionItem ────────────────────────────────────── */
function SubmissionItem({ sub, onApprove, onReject }) {
  return (
    <div className="td-submission-item">
      <div className="td-submission-left">
        <FileIcon />
        <div>
          <div className="td-file-name">{sub.name}</div>
          <div className="td-file-meta">
            By {sub.author} · {sub.date} · {sub.size}
          </div>
        </div>
      </div>

      <div className="td-submission-right">
        {sub.status === "pending" ? (
          <>
            <button
              className="td-btn td-btn--approve"
              onClick={() => onApprove(sub.id)}
            >
              ✔ Approve
            </button>
            <button
              className="td-btn td-btn--reject"
              onClick={() => onReject(sub.id)}
            >
              ✖ Reject
            </button>
          </>
        ) : (
          <StatusBadge status={sub.status} />
        )}
      </div>
    </div>
  );
}

/* ─── UploadZone ────────────────────────────────────────── */
function UploadZone() {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`td-upload-zone ${dragOver ? "td-upload-zone--active" : ""}`}
      onClick={() => document.getElementById("td-file-input").click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
    >
      <div className="td-upload-icon">📤</div>
      <div className="td-upload-title">Click to upload or drag &amp; drop</div>
      <div className="td-upload-sub">PDF, DOCX, PPTX — max 20 MB</div>
      <input
        id="td-file-input"
        type="file"
        accept=".pdf,.docx,.pptx"
        style={{ display: "none" }}
      />
    </div>
  );
}

/* ─── TeacherDashboard (default export) ─────────────────── */
export default function TeacherDashboard() {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [activeTab, setActiveTab] = useState("review");

  const pending  = submissions.filter((s) => s.status === "pending").length;
  const approved = submissions.filter((s) => s.status === "approved").length;

  const setStatus = (id, status) =>
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );

  return (
    <div className="td-root">
      {/* ── Navbar ── */}
      <nav className="td-nav">
        <div className="td-nav-brand">
          <div className="td-nav-icon">🎓</div>
          <div>
            <div className="td-nav-title">Teacher Dashboard</div>
            <div className="td-nav-subtitle">
              AI Learning — Manage materials &amp; student submissions
            </div>
          </div>
        </div>

        <div className="td-nav-right">
          <div className="td-nav-user">
            <div className="td-nav-user-name">Teacher User</div>
            <div className="td-nav-user-role">Teacher</div>
          </div>
          <button className="td-logout-btn">→ Logout</button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="td-main">
        {/* Stats */}
        <div className="td-stats-grid">
          <StatCard label="Pending Reviews" value={pending}  icon="⏱" iconMod="yellow" />
          <StatCard label="Approved Docs"   value={approved} icon="✅" iconMod="green"  />
          <StatCard label="My Materials"    value={0}        icon="📖" iconMod="blue"   />
        </div>

        {/* Panel */}
        <div className="td-panel">
          {/* Tabs */}
          <div className="td-panel-tabs">
            <TabBtn active={activeTab === "upload"} onClick={() => setActiveTab("upload")}>
              ↑ Upload Materials
            </TabBtn>
            <TabBtn active={activeTab === "review"} onClick={() => setActiveTab("review")}>
              📄 Review Submissions
              {pending > 0 && (
                <span className="td-tab-badge">{pending}</span>
              )}
            </TabBtn>
          </div>

          <div className="td-panel-body">
            {activeTab === "review" ? (
              <>
                <div className="td-panel-header">
                  <div className="td-panel-title">Student Submissions</div>
                  <div className="td-panel-count">
                    {submissions.length} submissions
                  </div>
                </div>
                <div className="td-submission-list">
                  {submissions.map((s) => (
                    <SubmissionItem
                      key={s.id}
                      sub={s}
                      onApprove={(id) => setStatus(id, "approved")}
                      onReject={(id)  => setStatus(id, "rejected")}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="td-panel-header">
                  <div className="td-panel-title">Upload Materials</div>
                </div>
                <UploadZone />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}