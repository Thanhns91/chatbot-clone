function FileIcon() {
  return (
    <div className="td-file-icon">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3b5bdb"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
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