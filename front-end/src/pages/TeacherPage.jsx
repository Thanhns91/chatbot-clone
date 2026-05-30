import { useState } from "react";
import AdminPage from "./AdminPage";

import StatsCards from "../components/Teacher/StatsCards";
import UploadMaterials from "../components/Teacher/UploadMaterials";
import ReviewSubmissions from "../components/Teacher/ReviewSubmissions";

import "../components/Teacher/Teacher.css";

const initialSubmissions = [
  {
    id: 1,
    name: "Introduction to Algebra.pdf",
    author: "John Doe",
    date: "2026-05-18",
    size: "1.2 MB",
    status: "pending",
  },
  {
    id: 2,
    name: "Biology Chapter 5 Notes.docx",
    author: "Member User",
    date: "2026-05-19",
    size: "856 KB",
    status: "pending",
  },
  {
    id: 3,
    name: "History Essay Draft.pdf",
    author: "John Doe",
    date: "2026-05-20",
    size: "2.1 MB",
    status: "approved",
  },
  {
    id: 4,
    name: "Chemistry Lab Report.pdf",
    author: "Member User",
    date: "2026-05-20",
    size: "3.4 MB",
    status: "rejected",
  },
];

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

export default function TeacherPage({ user, onLogout }) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [activeTab, setActiveTab] = useState("review");

  if (user?.role === "admin") {
    return <AdminPage user={user} onLogout={onLogout} />;
  }

  const pending = submissions.filter((s) => s.status === "pending").length;
  const approved = submissions.filter((s) => s.status === "approved").length;

  const setStatus = (id, status) =>
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );

  return (
    <div className="td-root">
      <nav className="td-nav">
        <div className="td-nav-brand">
          {/* Icon giáo viên */}
          <div className="td-nav-brand">
            <div className="td-nav-icon">
              <img
                src="/src/assets/images/6.png"
                alt="Teacher"
                width={28}
                height={28}
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>

          <div>
            <div className="td-nav-title">Teacher Dashboard</div>
            <div className="td-nav-subtitle">
              AI Learning — Manage materials &amp; student submissions
            </div>
          </div>
        </div>

        <div className="td-nav-right">
          <div className="td-nav-user">
            <div className="td-nav-user-name">
              {user?.name || "Teacher User"}
            </div>
            <div className="td-nav-user-role">Teacher</div>
          </div>

          {/* Nút logout */}
          <button className="td-logout-btn" onClick={onLogout}>
            <i className="ti ti-logout me-1"></i>
            Logout
          </button>
        </div>
      </nav>

      <main className="td-main">
        <StatsCards pending={pending} approved={approved} />

        <div className="td-panel">
          <div className="td-panel-tabs">
            {/* Tab upload */}
            <TabBtn
              active={activeTab === "upload"}
              onClick={() => setActiveTab("upload")}
            >
              <i className="ti ti-upload me-2"></i>
              Upload Materials
            </TabBtn>

            {/* Tab review */}
            <TabBtn
              active={activeTab === "review"}
              onClick={() => setActiveTab("review")}
            >
              <i className="ti ti-file-check me-2"></i>
              Review Submissions
              {pending > 0 && <span className="td-tab-badge">{pending}</span>}
            </TabBtn>
          </div>

          <div className="td-panel-body">
            {activeTab === "review" ? (
              <ReviewSubmissions
                submissions={submissions}
                setStatus={setStatus}
              />
            ) : (
              <>
                <div className="td-panel-header">
                  <div className="td-panel-title">Upload Materials</div>
                </div>
                <UploadMaterials />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
