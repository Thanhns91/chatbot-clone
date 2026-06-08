import React from "react";

function FileIcon() {
  return (
    <div className="td-file-icon">
      <i className="ti ti-file-text" style={{ fontSize: 18, color: "#3b5bdb" }}></i>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`td-status-badge td-status-badge--${status}`}>
      {status}
    </span>
  );
}

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
              <i className="ti ti-check me-1"></i>
              Approve
            </button>

            <button
              className="td-btn td-btn--reject"
              onClick={() => onReject(sub.id)}
            >
              <i className="ti ti-x me-1"></i>
              Reject
            </button>
          </>
        ) : (
          <StatusBadge status={sub.status} />
        )}
      </div>
    </div>
  );
}

export default function ReviewSubmissions({ submissions, setStatus }) {
  return (
    <>
      <div className="td-panel-header">
        <div className="td-panel-title">Student Submissions</div>
        <div className="td-panel-count">{submissions.length} submissions</div>
      </div>

      <div className="td-submission-list">
        {submissions.map((s) => (
          <SubmissionItem
            key={s.id}
            sub={s}
            onApprove={(id) => setStatus(id, "approved")}
            onReject={(id) => setStatus(id, "rejected")}
          />
        ))}
      </div>
    </>
  );
}