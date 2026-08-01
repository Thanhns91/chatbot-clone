import { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal, Table } from "react-bootstrap";
import { toast } from "react-toastify";
import {
  getTeacherMessageReports,
  replaceReportedDocument,
  updateMessageReportStatus,
} from "../../services/api";

const REASON_LABELS = {
  incorrect_answer: "Incorrect answer",
  wrong_document_content: "Wrong document content",
  misleading_content: "Misleading content",
  unsafe_content: "Unsafe content",
  outdated_content: "Outdated content",
  other: "Other",
};

const STATUS_LABELS = {
  pending: "Pending",
  reviewing: "Reviewing",
  resolved: "Resolved",
  rejected: "Rejected",
};

const getStoredUser = () => {
  try {
    const raw =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("currentUser");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) return "-";

  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return "-";
  }
};

const getPreviewUrl = (fileName, fileUrl) => {
  if (!fileUrl) return "#";

  const lowerName = String(fileName || "").toLowerCase();

  if (lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
      fileUrl,
    )}`;
  }

  return fileUrl;
};

export default function MessageReportsPage({ user: propUser }) {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [teacherNote, setTeacherNote] = useState("");
  const [correctedFile, setCorrectedFile] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [replacingFile, setReplacingFile] = useState(false);

  const currentUser = propUser || getStoredUser();
  const teacherId = currentUser?.userId || currentUser?.id;
  const role = currentUser?.role;

  const visibleReports = useMemo(() => reports, [reports]);

  const loadReports = async () => {
    if (!teacherId) return;

    try {
      setLoading(true);
      const data = await getTeacherMessageReports(teacherId, {
        status: statusFilter,
        role,
      });

      if (data.success) {
        setReports(data.data || []);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.message || "Cannot load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, statusFilter, role]);

  const openReviewModal = (report) => {
    setSelectedReport(report);
    setTeacherNote(report.teacherNote || "");
    setCorrectedFile(null);
  };

  const closeReviewModal = () => {
    if (savingStatus || replacingFile) return;

    setSelectedReport(null);
    setTeacherNote("");
    setCorrectedFile(null);
  };

  const handleUpdateStatus = async (status, resolvedDocumentId = null) => {
    if (!selectedReport) return;

    try {
      setSavingStatus(true);

      await updateMessageReportStatus(selectedReport.reportId, {
        status,
        teacherNote,
        teacherId,
        role,
        resolvedDocumentId,
      });

      toast.success("Report updated");
      closeReviewModal();
      await loadReports();
    } catch (error) {
      console.log(error);
      toast.error(error.message || "Cannot update report");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleReplaceFileAndResolve = async () => {
    if (!selectedReport) return;

    if (!selectedReport.documentId) {
      toast.error("This report has no related document to replace.");
      return;
    }

    if (!correctedFile) {
      toast.error("Please choose the corrected file first.");
      return;
    }

    try {
      setReplacingFile(true);
      toast.info(`Replacing file "${selectedReport.fileName}" with "${correctedFile.name}"...`);

      const uploadResult = await replaceReportedDocument(
        selectedReport,
        correctedFile,
        teacherId,
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.message || uploadResult.error || "Replace failed");
      }

      const finalNote =
        teacherNote ||
        `Replaced the source document with corrected file "${uploadResult.fileName || correctedFile.name}". New version: ${uploadResult.versionNo || "-"}.`;

      await updateMessageReportStatus(selectedReport.reportId, {
        status: "resolved",
        teacherNote: finalNote,
        teacherId,
        role,
        resolvedDocumentId: uploadResult.documentId,
      });

      toast.success("Corrected file uploaded and report resolved");
      closeReviewModal();
      await loadReports();
    } catch (error) {
      console.log(error);
      toast.error(error.message || "Cannot replace file");
    } finally {
      setReplacingFile(false);
    }
  };

  const sourcePreviewUrl = selectedReport
    ? getPreviewUrl(selectedReport.fileName, selectedReport.fileUrl)
    : "#";

  const resolvedPreviewUrl = selectedReport
    ? getPreviewUrl(selectedReport.resolvedFileName, selectedReport.resolvedFileUrl)
    : "#";

  return (
    <>

      <div className="admin-body">
        <div className="a-card mb-3">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div>
              <div style={{ fontWeight: 700 }}>Reported AI answers</div>
              <div className="text-muted small">
                If a document contains wrong rules, replace it with a corrected version instead of deleting old evidence.
              </div>
            </div>

            <Form.Select
              style={{ width: 180 }}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </Form.Select>
          </div>
        </div>

        <div className="a-card">
          <div className="table-responsive">
            <Table className="admin-table mb-0">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Student</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Resolved Version</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4">
                      Loading reports...
                    </td>
                  </tr>
                ) : visibleReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4">
                      No reports found
                    </td>
                  </tr>
                ) : (
                  visibleReports.map((report) => (
                    <tr key={report.reportId}>
                      <td>
                        <div className="admin-primary-line">
                          {report.fileName || "Unknown file"}
                        </div>
                        <div className="admin-secondary-line">
                          {report.subjectCode || "No Subject"} · {report.topicName || "Uncategorized"}
                        </div>
                      </td>

                      <td>
                        <div className="admin-primary-line">
                          {report.studentName || "Unknown student"}
                        </div>
                        <div className="admin-secondary-line">
                          {report.studentEmail || "-"}
                        </div>
                      </td>

                      <td>{REASON_LABELS[report.reason] || report.reason}</td>

                      <td>
                        <span
                          className={
                            report.status === "resolved"
                              ? "status-active"
                              : report.status === "rejected"
                                ? "status-blocked"
                                : "status-pending"
                          }
                        >
                          {STATUS_LABELS[report.status] || report.status}
                        </span>
                      </td>

                      <td>
                        {report.resolvedDocumentId ? (
                          <div>
                            <div className="admin-primary-line">
                              v{report.resolvedVersionNo || "?"}
                            </div>
                            <div className="admin-secondary-line">
                              {report.resolvedFileName || report.resolvedDocumentId}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>

                      <td>{formatDate(report.createdAt)}</td>

                      <td>
                        <Button size="sm" variant="outline-primary" onClick={() => openReviewModal(report)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </div>

      <Modal show={Boolean(selectedReport)} onHide={closeReviewModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Review message report</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-3">
            <div className="fw-bold">Related source file</div>
            <div>{selectedReport?.fileName || "Unknown file"}</div>
            {sourcePreviewUrl !== "#" && (
              <Button
                size="sm"
                variant="outline-secondary"
                className="mt-2"
                onClick={() => window.open(sourcePreviewUrl, "_blank", "noopener,noreferrer")}
              >
                Open old file
              </Button>
            )}
          </div>

          {selectedReport?.resolvedDocumentId && (
            <div className="mb-3">
              <div className="fw-bold">Resolved with</div>
              <div>
                {selectedReport.resolvedFileName || selectedReport.resolvedDocumentId}
                {selectedReport.resolvedVersionNo ? ` · Version ${selectedReport.resolvedVersionNo}` : ""}
              </div>
              {resolvedPreviewUrl !== "#" && (
                <Button
                  size="sm"
                  variant="outline-success"
                  className="mt-2"
                  onClick={() => window.open(resolvedPreviewUrl, "_blank", "noopener,noreferrer")}
                >
                  Open corrected file
                </Button>
              )}
            </div>
          )}

          <div className="mb-3">
            <div className="fw-bold">Student question</div>
            <div className="p-3 rounded bg-light" style={{ whiteSpace: "pre-wrap" }}>
              {selectedReport?.questionText || "No previous question found"}
            </div>
          </div>

          <div className="mb-3">
            <div className="fw-bold">AI answer</div>
            <div className="p-3 rounded bg-light" style={{ whiteSpace: "pre-wrap" }}>
              {selectedReport?.answerText}
            </div>
          </div>

          {selectedReport?.sourceExcerpt && (
            <div className="mb-3">
              <div className="fw-bold">Source excerpt used by AI</div>
              <div className="message-report-modal__source">
                <div className="message-report-modal__source-file">
                  {selectedReport.sourceDocumentName ||
                    selectedReport.fileName ||
                    "Source document"}
                </div>
                <pre>{selectedReport.sourceExcerpt}</pre>
              </div>
            </div>
          )}

          <div className="mb-3">
            <div className="fw-bold">Student report</div>
            <div className="p-3 rounded bg-light" style={{ whiteSpace: "pre-wrap" }}>
              <div><b>Reason:</b> {REASON_LABELS[selectedReport?.reason] || selectedReport?.reason}</div>
              <div><b>Description:</b> {selectedReport?.description || "No description"}</div>
            </div>
          </div>

          {selectedReport?.status !== "resolved" && (
            <Form.Group className="mb-3">
              <Form.Label>Upload corrected file</Form.Label>
              <Form.Control
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(event) => setCorrectedFile(event.target.files?.[0] || null)}
              />
              <Form.Text className="text-muted">
                This will create a new document version, hide the old source file, and move old chat sessions to the corrected version.
              </Form.Text>
            </Form.Group>
          )}

          <Form.Group>
            <Form.Label>Teacher note</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={teacherNote}
              placeholder="Example: I checked the exam rule and replaced the incorrect source file."
              onChange={(event) => setTeacherNote(event.target.value)}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" disabled={savingStatus || replacingFile} onClick={closeReviewModal}>
            Close
          </Button>
          <Button variant="warning" disabled={savingStatus || replacingFile} onClick={() => handleUpdateStatus("reviewing")}> 
            Mark reviewing
          </Button>
          <Button variant="danger" disabled={savingStatus || replacingFile} onClick={() => handleUpdateStatus("rejected")}> 
            Reject
          </Button>
          <Button variant="success" disabled={savingStatus || replacingFile} onClick={() => handleUpdateStatus("resolved")}> 
            Mark resolved
          </Button>
          <Button
            variant="primary"
            disabled={savingStatus || replacingFile || !correctedFile || selectedReport?.status === "resolved"}
            onClick={handleReplaceFileAndResolve}
          >
            {replacingFile ? "Replacing..." : "Replace file & resolve"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
