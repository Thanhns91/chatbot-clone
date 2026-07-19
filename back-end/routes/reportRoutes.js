import express from "express";
import pool from "../db.js";

const router = express.Router();

const REPORT_REASONS = new Set([
  "incorrect_answer",
  "wrong_document_content",
  "misleading_content",
  "unsafe_content",
  "outdated_content",
  "other",
]);

const REPORT_STATUSES = new Set([
  "pending",
  "reviewing",
  "resolved",
  "rejected",
]);

function normalizeReason(reason) {
  return REPORT_REASONS.has(reason) ? reason : "incorrect_answer";
}

function normalizeStatus(status) {
  return REPORT_STATUSES.has(status) ? status : "pending";
}

async function getPreviousUserQuestion(sessionId, aiMessageId, aiCreatedAt) {
  const [rows] = await pool.query(
    `
    SELECT message
    FROM ChatMessages
    WHERE sessionId = ?
      AND sender = 'user'
      AND (
        messageId < ?
        OR createdAt <= ?
      )
    ORDER BY createdAt DESC, messageId DESC
    LIMIT 1
    `,
    [sessionId, aiMessageId, aiCreatedAt],
  );

  return rows[0]?.message || null;
}

async function createReportNotification({ reportId, documentId, teacherId, fileName }) {
  try {
    let receivers = [];

    if (teacherId) {
      receivers = [{ userId: teacherId }];
    } else {
      const [rows] = await pool.query(
        `
        SELECT userId
        FROM Users
        WHERE role IN ('teacher', 'admin')
          AND status = 'active'
        `,
      );
      receivers = rows;
    }

    if (!receivers.length) return;

    await pool.query(
      `
      INSERT INTO Notifications
      (receiverId, documentId, feedbackId, title, message, type)
      VALUES ?
      `,
      [
        receivers.map((receiver) => [
          receiver.userId,
          documentId || null,
          null,
          "AI answer reported",
          `A student reported an AI answer for file: ${fileName || "Unknown file"}`,
          "message_reported",
        ]),
      ],
    );
  } catch (error) {
    console.log("Create report notification failed:", error.message);
  }
}

// STUDENT - Report an AI answer/message.
router.post("/message", async (req, res) => {
  try {
    const {
      messageId,
      sessionId,
      documentId,
      studentId,
      reason,
      description,
    } = req.body;

    if (!messageId || !sessionId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Missing messageId, sessionId or studentId",
      });
    }

    const [messageRows] = await pool.query(
      `
      SELECT
        cm.messageId,
        cm.sessionId,
        cm.sender,
        cm.message,
        cm.sourceExcerpt,
        cm.sourceDocumentName,
        cm.createdAt,
        cs.userId,
        cs.documentId AS sessionDocumentId
      FROM ChatMessages cm
      JOIN ChatSessions cs ON cm.sessionId = cs.sessionId
      WHERE cm.messageId = ?
        AND cm.sessionId = ?
      LIMIT 1
      `,
      [messageId, sessionId],
    );

    if (messageRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    const aiMessage = messageRows[0];

    if (String(aiMessage.sender) !== "ai") {
      return res.status(400).json({
        success: false,
        message: "Only AI messages can be reported",
      });
    }

    if (Number(aiMessage.userId) !== Number(studentId)) {
      return res.status(403).json({
        success: false,
        message: "You can only report messages from your own chat session",
      });
    }

    const targetDocumentId = documentId || aiMessage.sessionDocumentId || null;
    let document = null;
    let teacherId = null;

    if (targetDocumentId) {
      const [docRows] = await pool.query(
        `
        SELECT
          d.documentId,
          d.fileName,
          d.fileUrl,
          d.uploaderId,
          d.uploadedBy,
          d.reviewStatus,
          d.subjectId,
          d.topicId,
          d.documentTypeId,
          d.levelId,
          d.tags,
          d.summary,
          u.fullName AS uploaderName,
          u.role AS uploaderRole
        FROM Documents d
        LEFT JOIN Users u ON d.uploaderId = u.userId
        WHERE d.documentId = ?
          AND d.isDeleted = FALSE
        LIMIT 1
        `,
        [targetDocumentId],
      );

      document = docRows[0] || null;

      if (document && document.uploadedBy === "teacher") {
        teacherId = document.uploaderId;
      }
    }

    const questionText = await getPreviousUserQuestion(
      sessionId,
      messageId,
      aiMessage.createdAt,
    );

    const [existing] = await pool.query(
      `
      SELECT reportId
      FROM MessageReports
      WHERE messageId = ?
        AND studentId = ?
        AND status IN ('pending', 'reviewing')
      LIMIT 1
      `,
      [messageId, studentId],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "This message already has an open report",
        reportId: existing[0].reportId,
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO MessageReports
      (
        messageId,
        sessionId,
        documentId,
        studentId,
        teacherId,
        questionText,
        answerText,
        sourceExcerpt,
        sourceDocumentName,
        reason,
        description,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      [
        messageId,
        sessionId,
        targetDocumentId,
        studentId,
        teacherId,
        questionText,
        aiMessage.message,
        aiMessage.sourceExcerpt || null,
        aiMessage.sourceDocumentName || document?.fileName || null,
        normalizeReason(reason),
        description || null,
      ],
    );

    await createReportNotification({
      reportId: result.insertId,
      documentId: targetDocumentId,
      teacherId,
      fileName: document?.fileName,
    });

    return res.json({
      success: true,
      message: "Report submitted successfully",
      reportId: result.insertId,
      status: "pending",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Cannot submit report",
      detail: error.message,
    });
  }
});

// TEACHER / ADMIN - List reports.
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status, role } = req.query;

    let sql = `
      SELECT
        mr.reportId,
        mr.messageId,
        mr.sessionId,
        mr.documentId,
        mr.studentId,
        mr.teacherId,
        mr.questionText,
        mr.answerText,
        mr.sourceExcerpt,
        mr.sourceDocumentName,
        mr.reason,
        mr.description,
        mr.status,
        mr.teacherNote,
        mr.resolvedDocumentId,
        mr.createdAt,
        mr.reviewedAt,

        s.fullName AS studentName,
        s.email AS studentEmail,
        t.fullName AS teacherName,
        d.fileName,
        d.fileUrl,
        d.reviewStatus,
        d.uploadedBy,
        d.uploaderId,
        d.subjectId,
        d.topicId,
        d.documentTypeId,
        d.levelId,
        d.tags,
        d.summary,
        resolved.fileName AS resolvedFileName,
        resolved.fileUrl AS resolvedFileUrl,
        resolved.versionNo AS resolvedVersionNo,
        sub.subjectCode,
        sub.subjectName,
        topic.topicName
      FROM MessageReports mr
      JOIN Users s ON mr.studentId = s.userId
      LEFT JOIN Users t ON mr.teacherId = t.userId
      LEFT JOIN Documents d ON mr.documentId = d.documentId
      LEFT JOIN Documents resolved ON mr.resolvedDocumentId = resolved.documentId
      LEFT JOIN Subjects sub ON d.subjectId = sub.subjectId
      LEFT JOIN Topics topic ON d.topicId = topic.topicId
      WHERE 1 = 1
    `;

    const params = [];

    if (role !== "admin") {
      sql += ` AND (mr.teacherId = ? OR mr.teacherId IS NULL)`;
      params.push(teacherId);
    }

    if (status && status !== "all") {
      sql += ` AND mr.status = ?`;
      params.push(normalizeStatus(status));
    }

    sql += ` ORDER BY mr.createdAt DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Cannot load message reports",
      detail: error.message,
    });
  }
});

// TEACHER / ADMIN - Update report status.
router.put("/:reportId/status", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, teacherNote, teacherId, role, resolvedDocumentId } = req.body;

    if (!status || !REPORT_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report status",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT reportId, teacherId, documentId
      FROM MessageReports
      WHERE reportId = ?
      LIMIT 1
      `,
      [reportId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const report = rows[0];

    if (
      role !== "admin" &&
      report.teacherId &&
      Number(report.teacherId) !== Number(teacherId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot update this report",
      });
    }

    await pool.query(
      `
      UPDATE MessageReports
      SET
        status = ?,
        teacherNote = ?,
        resolvedDocumentId = COALESCE(?, resolvedDocumentId),
        reviewedAt = CASE WHEN ? IN ('resolved', 'rejected') THEN NOW() ELSE reviewedAt END
      WHERE reportId = ?
      `,
      [status, teacherNote || null, resolvedDocumentId || null, status, reportId],
    );

    return res.json({
      success: true,
      message: "Report status updated",
      reportId,
      status,
      resolvedDocumentId: resolvedDocumentId || null,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Cannot update report status",
      detail: error.message,
    });
  }
});

export default router;
