import { useState } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Table from "react-bootstrap/Table";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form";

// ── Mock data ──────────────────────────────────────────────────────────────
const MOCK_SUBMISSIONS = [
  {
    id: 1,
    fileName: "Algebra_Unit4_Homework.pdf",
    student: "Nguyen Minh Khoa",
    studentId: "STU-001",
    submittedAt: "2026-06-10",
    subject: "Mathematics",
    status: "reviewed",
    score: 87,
    summary:
      "Student demonstrates solid understanding of quadratic equations. Minor errors in factoring steps. Overall performance is above average with clear logical structure in problem-solving.",
    fileUrl: null,
  },
  {
    id: 2,
    fileName: "Essay_HistoryWW2.docx",
    student: "Tran Thi Lan",
    studentId: "STU-002",
    submittedAt: "2026-06-09",
    subject: "History",
    status: "pending",
    score: null,
    summary: null,
    fileUrl: null,
  },
  {
    id: 3,
    fileName: "Physics_Lab_Report.pdf",
    student: "Le Van Duc",
    studentId: "STU-003",
    submittedAt: "2026-06-08",
    subject: "Physics",
    status: "reviewed",
    score: 92,
    summary:
      "Excellent lab report with precise measurements and well-drawn conclusions. The hypothesis section is particularly strong. Minor formatting issues in the references section.",
    fileUrl: null,
  },
  {
    id: 4,
    fileName: "Calculus_Quiz3_Answers.pdf",
    student: "Pham Bao Linh",
    studentId: "STU-004",
    submittedAt: "2026-06-07",
    subject: "Mathematics",
    status: "reviewed",
    score: 74,
    summary:
      "Student struggles with integration by parts. Basic differentiation is solid. Recommend additional practice with chain rule applications and definite integrals.",
    fileUrl: null,
  },
  {
    id: 5,
    fileName: "Literature_Analysis_Shakespeare.docx",
    student: "Hoang Bich Ngoc",
    studentId: "STU-005",
    submittedAt: "2026-06-06",
    subject: "Literature",
    status: "pending",
    score: null,
    summary: null,
    fileUrl: null,
  },
  {
    id: 6,
    fileName: "Chemistry_Periodic_Table_Quiz.pdf",
    student: "Vo Thanh Nam",
    studentId: "STU-006",
    submittedAt: "2026-06-05",
    subject: "Chemistry",
    status: "reviewed",
    score: 65,
    summary:
      "Needs improvement on electron configuration and valence shell concepts. Successfully identified most common elements. Suggest revisiting periodic trends before the next assessment.",
    fileUrl: null,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const fileTypeIcon = (fileName) => {
  if (fileName.endsWith(".pdf"))
    return { icon: "bi-file-earmark-pdf", cls: "td-file-icon--pdf" };
  if (fileName.endsWith(".mp4"))
    return { icon: "bi-file-earmark-play", cls: "td-file-icon--mp4" };
  return { icon: "bi-file-earmark-word", cls: "td-file-icon--docx" };
};

const scoreClass = (score) => {
  if (score === null) return "td-score-badge--none";
  if (score >= 90) return "td-score-badge--high";
  if (score >= 75) return "td-score-badge--mid";
  if (score >= 60) return "td-score-badge--low";
  return "td-score-badge--fail";
};

const ScoreBadge = ({ score }) => (
  <span className={`td-score-badge ${scoreClass(score)}`}>
    {score !== null ? `${score}/100` : "—"}
  </span>
);

// ── Chat bubble ────────────────────────────────────────────────────────────
const ChatBubble = ({ msg }) => (
  <div className={`td-chat-bubble td-chat-bubble--${msg.role}`}>
    {msg.role === "assistant" && (
      <div className="td-chat-avatar">
        <i className="bi bi-robot" />
      </div>
    )}
    <div className="td-chat-text">{msg.text}</div>
    {msg.role === "user" && (
      <div className="td-chat-avatar td-chat-avatar--user">
        <i className="bi bi-person" />
      </div>
    )}
  </div>
);

// ── Main ───────────────────────────────────────────────────────────────────
export default function StudentSummaryTab() {
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const openModal = (submission) => {
    setSelected(submission);
    setShowModal(true);
    setChatHistory(
      submission.summary
        ? [
            {
              role: "assistant",
              text: `📋 AI Summary for "${submission.fileName}" by ${submission.student}:\n\n${submission.summary}`,
            },
          ]
        : [
            {
              role: "assistant",
              text: `Hello! I'm ready to help you review "${submission.fileName}" submitted by ${submission.student}. This file is pending review. Ask me anything about how to evaluate it!`,
            },
          ]
    );
    setChatInput("");
  };

  const closeModal = () => {
    setShowModal(false);
    setSelected(null);
    setChatHistory([]);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || loading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const context = selected
        ? `You are an AI teaching assistant. The teacher is reviewing a student submission:
- File: ${selected.fileName}
- Student: ${selected.student} (${selected.studentId})
- Subject: ${selected.subject}
- Submitted: ${selected.submittedAt}
- Status: ${selected.status}
- Score: ${selected.score ?? "Not graded yet"}
${selected.summary ? `- Existing summary: ${selected.summary}` : "- Not yet summarized."}

Answer the teacher's question helpfully and concisely.`
        : "You are an AI teaching assistant.";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: context,
          messages: [
            ...chatHistory
              .filter((m) => m.role === "user")
              .map((m) => ({ role: "user", content: m.text })),
            { role: "user", content: userMsg },
          ],
        }),
      });

      const data = await response.json();
      const reply =
        data.content?.map((b) => b.text || "").join("") ||
        "Sorry, I couldn't generate a response.";
      setChatHistory((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "⚠️ Could not connect to AI. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filtered =
    filterStatus === "all"
      ? MOCK_SUBMISSIONS
      : MOCK_SUBMISSIONS.filter((s) => s.status === filterStatus);

  const reviewedCount = MOCK_SUBMISSIONS.filter((s) => s.status === "reviewed").length;

  return (
    <>
      <div className="td-card">
        {/* Header */}
        <div className="td-summary-header">
          <div>
            <div className="td-card-title">Student Submissions</div>
            <div className="td-summary-meta">
              {MOCK_SUBMISSIONS.length} submissions · {reviewedCount} reviewed
            </div>
          </div>
          <div className="td-tabs">
            {["all", "reviewed", "pending"].map((f) => (
              <button
                key={f}
                className={`td-tab ${filterStatus === f ? "td-tab--active" : ""}`}
                onClick={() => setFilterStatus(f)}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="td-summary-table-wrap">
          <Table className="td-summary-table" hover responsive>
            <thead>
              <tr>
                <th>File</th>
                <th>Student</th>
                <th>Submitted</th>
                <th>Score</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const { icon, cls } = fileTypeIcon(sub.fileName);
                return (
                  <tr key={sub.id}>
                    <td>
                      <div className="td-summary-file-cell">
                        <div className={`td-file-icon td-file-icon--sm ${cls}`}>
                          <i className={`bi ${icon}`} />
                        </div>
                        <span className="td-file-name">{sub.fileName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="td-summary-student-name">{sub.student}</div>
                    </td>
                    <td className="td-summary-date">{sub.submittedAt}</td>
                    <td>
                      <ScoreBadge score={sub.score} />
                    </td>
                    <td>
                      <span className={`td-status-badge td-status-badge--${sub.status}`}>
                        {sub.status === "reviewed" ? "✓ Reviewed" : "⏳ Pending"}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="td-summary-btn"
                        onClick={() => openModal(sub)}
                      >
                        <i className="bi bi-chat-dots" />
                        Check Summary
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={closeModal} centered size="lg">
        <Modal.Header closeButton className="td-modal-header">
          <Modal.Title className="td-modal-title">
            <i className="bi bi-robot" />
            AI Summary — {selected?.student}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="td-modal-body">
          {/* File info strip */}
          {selected && (
            <div className="td-modal-file-strip">
              <div className={`td-file-icon td-file-icon--sm ${fileTypeIcon(selected.fileName).cls}`}>
                <i className={`bi ${fileTypeIcon(selected.fileName).icon}`} />
              </div>
              <div className="td-modal-file-info">
                <div className="td-file-name">{selected.fileName}</div>
                <div className="td-modal-file-sub">
                  {selected.subject} · {selected.submittedAt}
                </div>
              </div>
              <ScoreBadge score={selected.score} />
              <Button
                variant="outline-secondary"
                size="sm"
                className="td-preview-btn"
                onClick={() => alert("File preview: connect your storage service to enable viewing.")}
              >
                <i className="bi bi-eye" />
                View File
              </Button>
            </div>
          )}

          {/* Chat area */}
          <div className="td-chat-area">
            {chatHistory.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}
            {loading && (
              <div className="td-chat-bubble td-chat-bubble--assistant">
                <div className="td-chat-avatar">
                  <i className="bi bi-robot" />
                </div>
                <div className="td-chat-text td-chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer className="td-modal-footer">
          <InputGroup className="td-chat-input-group">
            <Form.Control
              className="td-chat-input"
              placeholder="Ask AI about this submission…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            />
            <Button
              variant="primary"
              className="td-chat-send"
              onClick={sendMessage}
              disabled={loading || !chatInput.trim()}
            >
              <i className="bi bi-send" />
            </Button>
          </InputGroup>
        </Modal.Footer>
      </Modal>
    </>
  );
}