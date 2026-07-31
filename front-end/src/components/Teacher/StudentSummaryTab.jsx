import { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Table from "react-bootstrap/Table";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form";
import { toast } from "react-toastify";
import {
  getStudentSubmissions,
  generateStudentFeedback,
  askStudentFeedback,
} from "../../services/api";

const PAGE_SIZE = 10;

const getCurrentUser = () => {
  const raw =
    localStorage.getItem("currentUser") ||
    sessionStorage.getItem("currentUser") ||
    localStorage.getItem("user") ||
    sessionStorage.getItem("user");

  return raw ? JSON.parse(raw) : null;
};

const fileTypeIcon = (fileName = "") => {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    return {
      icon: "bi-file-earmark-pdf",
      cls: "td-file-icon--pdf",
    };
  }

  if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
    return {
      icon: "bi-file-earmark-word",
      cls: "td-file-icon--docx",
    };
  }

  return {
    icon: "bi-file-earmark-text",
    cls: "td-file-icon--docx",
  };
};

const scoreClass = (score) => {
  if (score === null || score === undefined) return "td-score-badge--none";
  if (score >= 90) return "td-score-badge--high";
  if (score >= 75) return "td-score-badge--mid";
  if (score >= 60) return "td-score-badge--low";
  return "td-score-badge--fail";
};

const ScoreBadge = ({ score }) => (
  <span className={`td-score-badge ${scoreClass(score)}`}>
    {score !== null && score !== undefined ? `${score}/100` : "—"}
  </span>
);

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

const buildFeedbackText = (submission) => {
  if (!submission?.summary) {
    return `Chưa có feedback cho "${submission?.fileName}". Bấm Generate Summary để AI phân tích lịch sử chat của học sinh.`;
  }

  return `📋 AI Summary for "${submission.fileName}" by ${submission.student}

SUMMARY:
${submission.summary || "Chưa có"}

STRENGTHS:
${submission.strengths || "Chưa có"}

WEAKNESSES:
${submission.weaknesses || "Chưa có"}

RECOMMENDATIONS:
${submission.recommendations || "Chưa có"}

SCORE:
${submission.score ?? "Chưa có"}/100`;
};

export default function StudentSummaryTab() {
  const currentUser = getCurrentUser();

  const [submissions, setSubmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState("");

  const fetchSubmissions = async () => {
    try {
      setLoadingTable(true);
      setError("");

      const result = await getStudentSubmissions();

      if (result.success) {
        setSubmissions(result.data || []);
      } else {
        setError(result.message || "Cannot load student submissions");
      }
    } catch (err) {
      console.error(err);
      setError("Cannot load student submissions");
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return submissions;
    return submissions.filter((submission) => submission.status === filterStatus);
  }, [submissions, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedSubmissions = filtered.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openModal = (submission) => {
    setSelected(submission);
    setShowModal(true);
    setChatInput("");
    setChatHistory([
      {
        role: "assistant",
        text: buildFeedbackText(submission),
      },
    ]);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelected(null);
    setChatHistory([]);
    setChatInput("");
    setLoading(false);
  };

  const handleGenerateSummary = async () => {
    if (!selected || loading) return;

    try {
      setLoading(true);

      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Đang phân tích lịch sử chat của học sinh...",
        },
      ]);

      const result = await generateStudentFeedback(
        selected.studentId,
        currentUser?.userId,
        selected.documentId,
      );

      if (!result.success) {
        setChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            text:
              result.message ||
              "Không thể tạo feedback. Hãy kiểm tra học sinh đã chat với file này chưa.",
          },
        ]);
        return;
      }

      const updatedSubmission = {
        ...selected,
        feedbackId: result.feedback.feedbackId,
        summary: result.feedback.summary,
        strengths: result.feedback.strengths,
        weaknesses: result.feedback.weaknesses,
        recommendations: result.feedback.recommendations,
        score: result.feedback.score,
        status: "reviewed",
        feedbackStatus: result.feedback.status,
      };

      setSelected(updatedSubmission);

      setSubmissions((prev) =>
        prev.map((item) =>
          item.documentId === updatedSubmission.documentId &&
          String(item.studentId) === String(updatedSubmission.studentId)
            ? updatedSubmission
            : item,
        ),
      );

      setChatHistory([
        {
          role: "assistant",
          text: buildFeedbackText(updatedSubmission),
        },
      ]);
    } catch (err) {
      console.error(err);

      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Lỗi khi tạo feedback. Vui lòng thử lại.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || loading || !selected) return;

    const userMsg = chatInput.trim();

    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const result = await askStudentFeedback(
        selected.studentId,
        selected.documentId,
        userMsg,
      );

      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            result.answer ||
            result.message ||
            "Không thể trả lời câu hỏi này.",
        },
      ]);
    } catch (err) {
      console.error(err);

      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Không thể kết nối AI. Vui lòng thử lại.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewFile = () => {
    if (!selected?.fileUrl) {
      toast.warning("File này chưa có đường dẫn xem trước.");
      return;
    }

    window.open(selected.fileUrl, "_blank", "noopener,noreferrer");
  };

  const reviewedCount = submissions.filter(
    (submission) => submission.status === "reviewed",
  ).length;

  return (
    <>
      <div className="td-card">
        <div className="td-summary-header">
          <div>
            <div className="td-card-title">Student Submissions</div>
            <div className="td-summary-meta">
              {loadingTable
                ? "Loading submissions..."
                : `${submissions.length} submissions · ${reviewedCount} reviewed`}
            </div>
          </div>

          <div className="td-tabs">
            {["all", "reviewed", "pending"].map((filter) => (
              <button
                key={filter}
                type="button"
                className={`td-tab ${
                  filterStatus === filter ? "td-tab--active" : ""
                }`}
                onClick={() => setFilterStatus(filter)}
              >
                {filter === "all"
                  ? "All"
                  : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="td-summary-error">{error}</div>}

        <div className="td-summary-table-wrap">
          <Table className="td-summary-table" hover responsive>
            <thead>
              <tr>
                <th>File</th>
                <th>Student</th>
                <th>Submitted</th>
                <th>Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingTable ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    Loading submissions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    No student submissions found.
                  </td>
                </tr>
              ) : (
                paginatedSubmissions.map((submission) => {
                  const { icon, cls } = fileTypeIcon(submission.fileName);

                  return (
                    <tr
                      key={`${submission.documentId}-${submission.studentId}`}
                    >
                      <td>
                        <div className="td-summary-file-cell">
                          <div className={`td-file-icon td-file-icon--sm ${cls}`}>
                            <i className={`bi ${icon}`} />
                          </div>
                          <span className="td-file-name">
                            {submission.fileName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="td-summary-student-name">
                          {submission.student || "Unknown student"}
                        </div>
                      </td>

                      <td className="td-summary-date">
                        {submission.submittedAt || "-"}
                      </td>

                      <td>
                        <ScoreBadge score={submission.score} />
                      </td>

                      <td>
                        <span
                          className={`td-status-badge td-status-badge--${submission.status}`}
                        >
                          {submission.status === "reviewed"
                            ? "✓ Reviewed"
                            : "⏳ Pending"}
                        </span>
                      </td>

                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="td-summary-btn"
                          onClick={() => openModal(submission)}
                        >
                          <i className="bi bi-chat-dots" />
                          Check Summary
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="td-pagination">
            <div className="td-pagination__info">
              Showing {startIndex + 1}-
              {Math.min(startIndex + PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length} submissions
            </div>

            <div className="td-pagination__controls">
              <button
                type="button"
                className="td-page-btn td-page-btn--text"
                disabled={safeCurrentPage === 1}
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
              >
                <i className="bi bi-chevron-left" />
                Previous
              </button>

              <div className="td-page-numbers">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;

                  return (
                    <button
                      type="button"
                      key={pageNumber}
                      className={`td-page-btn ${
                        safeCurrentPage === pageNumber
                          ? "td-page-btn--active"
                          : ""
                      }`}
                      onClick={() => setCurrentPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="td-page-btn td-page-btn--text"
                disabled={safeCurrentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
              >
                Next
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal show={showModal} onHide={closeModal} centered size="lg">
        <Modal.Header closeButton className="td-modal-header">
          <Modal.Title className="td-modal-title">
            <i className="bi bi-robot" />
            AI Summary — {selected?.student}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="td-modal-body">
          {selected && (
            <div className="td-modal-file-strip">
              <div
                className={`td-file-icon td-file-icon--sm ${
                  fileTypeIcon(selected.fileName).cls
                }`}
              >
                <i className={`bi ${fileTypeIcon(selected.fileName).icon}`} />
              </div>

              <div className="td-modal-file-info">
                <div className="td-file-name">{selected.fileName}</div>
                <div className="td-modal-file-sub">
                  {selected.student} · {selected.submittedAt}
                </div>
              </div>

              <ScoreBadge score={selected.score} />

              <Button
                variant="outline-secondary"
                size="sm"
                className="td-preview-btn"
                onClick={handleViewFile}
              >
                <i className="bi bi-eye" />
                View File
              </Button>

              <Button
                variant="primary"
                size="sm"
                className="td-summary-btn"
                onClick={handleGenerateSummary}
                disabled={loading}
              >
                <i className="bi bi-stars" />
                {loading ? "Generating..." : "Generate Summary"}
              </Button>
            </div>
          )}

          <div className="td-chat-area">
            {chatHistory.map((message, index) => (
              <ChatBubble key={`${message.role}-${index}`} msg={message} />
            ))}

            {loading && (
              <div className="td-chat-bubble td-chat-bubble--assistant">
                <div className="td-chat-avatar">
                  <i className="bi bi-robot" />
                </div>
                <div className="td-chat-text td-chat-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer className="td-modal-footer">
          <InputGroup className="td-chat-input-group">
            <Form.Control
              className="td-chat-input"
              placeholder="Ask AI about this student's chat history..."
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
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