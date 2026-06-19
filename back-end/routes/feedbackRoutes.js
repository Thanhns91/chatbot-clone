import express from "express";
import pool from "../db.js";
import { generateAnswer } from "../groq.js";

const router = express.Router();

function extractSection(text, start, end) {
  const regex = new RegExp(`${start}:\\s*([\\s\\S]*?)${end}:`, "i");
  return text.match(regex)?.[1]?.trim() || "";
}

function extractScore(text) {
  const match = text.match(/SCORE:\\s*(\\d+)/i);
  if (!match) return null;

  const score = Number(match[1]);

  if (Number.isNaN(score)) return null;

  return Math.max(0, Math.min(100, score));
}

router.get("/submissions", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        cs.sessionId,
        cs.sessionId AS id,
        cs.userId AS studentId,
        cs.documentId,
        cs.title AS sessionTitle,
        cs.createdAt AS sessionCreatedAt,
        cs.updatedAt AS sessionUpdatedAt,

        u.fullName AS student,
        u.email AS studentEmail,

        d.id AS documentDbId,
        d.fileName,
        d.fileType,
        d.fileUrl,
        d.uploadDate,
        d.uploadedBy,
        d.reviewStatus,

        uploader.fullName AS uploaderName,

        msgStats.messageCount,
        msgStats.lastMessageAt,

        sf.feedbackId,
        sf.summary,
        sf.strengths,
        sf.weaknesses,
        sf.recommendations,
        sf.score,
        sf.status AS feedbackStatus,
        sf.createdAt AS feedbackCreatedAt

      FROM ChatSessions cs

      INNER JOIN (
        SELECT
          cs0.userId,
          cs0.documentId,
          MAX(cs0.sessionId) AS latestSessionId
        FROM ChatSessions cs0
        INNER JOIN ChatMessages cm0 ON cs0.sessionId = cm0.sessionId
        WHERE cs0.documentId IS NOT NULL
        GROUP BY cs0.userId, cs0.documentId
      ) latest
        ON latest.latestSessionId = cs.sessionId

      INNER JOIN Users u
        ON cs.userId = u.userId
       AND u.role = 'student'

      INNER JOIN Documents d
        ON cs.documentId = d.documentId
       AND d.uploadStatus = 'success'

      LEFT JOIN Users uploader
        ON d.uploaderId = uploader.userId

      INNER JOIN (
        SELECT
          sessionId,
          COUNT(*) AS messageCount,
          MAX(createdAt) AS lastMessageAt
        FROM ChatMessages
        GROUP BY sessionId
      ) msgStats
        ON msgStats.sessionId = cs.sessionId

      LEFT JOIN (
        SELECT
          sf0.studentId,
          sf0.documentId,
          MAX(sf0.feedbackId) AS latestFeedbackId
        FROM StudentFeedback sf0
        GROUP BY sf0.studentId, sf0.documentId
      ) latestFeedback
        ON latestFeedback.studentId = cs.userId
       AND latestFeedback.documentId = cs.documentId

      LEFT JOIN StudentFeedback sf
        ON sf.feedbackId = latestFeedback.latestFeedbackId

      ORDER BY cs.updatedAt DESC, cs.createdAt DESC
    `);

    const data = rows.map((item) => ({
      ...item,
      submittedAt: item.lastMessageAt
        ? new Date(item.lastMessageAt).toISOString().split("T")[0]
        : item.sessionUpdatedAt
          ? new Date(item.sessionUpdatedAt).toISOString().split("T")[0]
          : "-",
      status: item.feedbackId ? "reviewed" : "pending",
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Cannot load student submissions",
      detail: error.message,
    });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const { studentId, teacherId, documentId } = req.body;

    if (!studentId || !documentId) {
      return res.status(400).json({
        success: false,
        message: "Missing studentId or documentId",
      });
    }

    const [studentRows] = await pool.query(
      `
      SELECT userId, fullName, email
      FROM Users
      WHERE userId = ?
        AND role = 'student'
      LIMIT 1
      `,
      [studentId],
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = studentRows[0];

    const [docRows] = await pool.query(
      `
      SELECT
        d.documentId,
        d.fileName,
        d.fileUrl,
        d.uploadDate,
        d.uploadedBy,
        d.reviewStatus,
        uploader.fullName AS uploaderName
      FROM Documents d
      LEFT JOIN Users uploader ON d.uploaderId = uploader.userId
      WHERE d.documentId = ?
        AND d.uploadStatus = 'success'
      LIMIT 1
      `,
      [documentId],
    );

    if (docRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const document = docRows[0];

    const [messages] = await pool.query(
      `
      SELECT
        cs.sessionId,
        cs.title,
        cm.sender,
        cm.message,
        cm.createdAt
      FROM ChatSessions cs
      INNER JOIN ChatMessages cm ON cs.sessionId = cm.sessionId
      WHERE cs.userId = ?
        AND cs.documentId = ?
      ORDER BY cs.createdAt ASC, cm.createdAt ASC
      `,
      [studentId, documentId],
    );

    if (messages.length === 0) {
      return res.json({
        success: false,
        message:
          "No chat history found for this student and document. Student needs to chat with this file first.",
      });
    }

    const sessionId = messages[messages.length - 1]?.sessionId || null;

    const chatHistory = messages
      .map((msg) => `${String(msg.sender).toUpperCase()}: ${msg.message}`)
      .join("\n");

    const prompt = `
Bạn là giáo viên AI dùng để đánh giá quá trình học của học sinh.

Dựa trên lịch sử hỏi đáp giữa học sinh và chatbot, hãy phân tích:
- Học sinh hiểu gì tốt
- Học sinh yếu phần nào
- Học sinh hay hỏi vấn đề gì
- Giáo viên nên hỗ trợ gì tiếp theo

THÔNG TIN:
Student: ${student.fullName}
Document: ${document.fileName}
Document uploaded by: ${document.uploadedBy}

LỊCH SỬ CHAT:
${chatHistory}

YÊU CẦU:
Trả lời đúng format dưới đây, không thêm tiêu đề khác.

SUMMARY:
Tóm tắt mức độ hiểu bài của học sinh trong 2-4 câu.

STRENGTHS:
Liệt kê điểm mạnh của học sinh.

WEAKNESSES:
Liệt kê điểm yếu, phần còn mơ hồ, hoặc vấn đề học sinh thường hỏi.

RECOMMENDATIONS:
Gợi ý giáo viên nên hỗ trợ học sinh như thế nào.

SCORE:
Cho điểm từ 0 đến 100 dựa trên mức độ hiểu bài thể hiện qua câu hỏi.
`;

    const aiResult = await generateAnswer(prompt);

    const summary = extractSection(aiResult, "SUMMARY", "STRENGTHS");
    const strengths = extractSection(aiResult, "STRENGTHS", "WEAKNESSES");
    const weaknesses = extractSection(
      aiResult,
      "WEAKNESSES",
      "RECOMMENDATIONS",
    );
    const recommendations = extractSection(
      aiResult,
      "RECOMMENDATIONS",
      "SCORE",
    );
    const score = extractScore(aiResult);

    const [insertResult] = await pool.query(
      `
      INSERT INTO StudentFeedback
      (
        studentId,
        teacherId,
        documentId,
        sessionId,
        summary,
        strengths,
        weaknesses,
        recommendations,
        score,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated')
      `,
      [
        studentId,
        teacherId || null,
        documentId,
        sessionId,
        summary,
        strengths,
        weaknesses,
        recommendations,
        score,
      ],
    );

    res.json({
      success: true,
      feedback: {
        feedbackId: insertResult.insertId,
        studentId,
        teacherId,
        documentId,
        sessionId,
        summary,
        strengths,
        weaknesses,
        recommendations,
        score,
        status: "generated",
        raw: aiResult,
      },
      student,
      document,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Generate feedback failed",
      detail: error.message,
    });
  }
});

router.post("/ask", async (req, res) => {
  try {
    const { studentId, documentId, question } = req.body;

    if (!studentId || !documentId || !question) {
      return res.status(400).json({
        success: false,
        message: "Missing studentId, documentId or question",
      });
    }

    const [studentRows] = await pool.query(
      `
      SELECT userId, fullName, email
      FROM Users
      WHERE userId = ?
        AND role = 'student'
      LIMIT 1
      `,
      [studentId],
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = studentRows[0];

    const [docRows] = await pool.query(
      `
      SELECT
        d.documentId,
        d.fileName,
        d.uploadedBy,
        uploader.fullName AS uploaderName
      FROM Documents d
      LEFT JOIN Users uploader ON d.uploaderId = uploader.userId
      WHERE d.documentId = ?
        AND d.uploadStatus = 'success'
      LIMIT 1
      `,
      [documentId],
    );

    if (docRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const doc = docRows[0];

    const [feedbackRows] = await pool.query(
      `
      SELECT *
      FROM StudentFeedback
      WHERE studentId = ?
        AND documentId = ?
      ORDER BY createdAt DESC
      LIMIT 1
      `,
      [studentId, documentId],
    );

    const [messages] = await pool.query(
      `
      SELECT cm.sender, cm.message, cm.createdAt
      FROM ChatSessions cs
      INNER JOIN ChatMessages cm ON cs.sessionId = cm.sessionId
      WHERE cs.userId = ?
        AND cs.documentId = ?
      ORDER BY cs.createdAt ASC, cm.createdAt ASC
      `,
      [studentId, documentId],
    );

    const feedback = feedbackRows[0];

    const chatHistory = messages
      .map((msg) => `${String(msg.sender).toUpperCase()}: ${msg.message}`)
      .join("\n");

    const prompt = `
Bạn là trợ lý cho giáo viên.

Giáo viên đang xem quá trình học của học sinh:
Student: ${student.fullName}
File: ${doc.fileName}
File uploaded by: ${doc.uploadedBy}

FEEDBACK HIỆN CÓ:
Summary: ${feedback?.summary || "Chưa có"}
Strengths: ${feedback?.strengths || "Chưa có"}
Weaknesses: ${feedback?.weaknesses || "Chưa có"}
Recommendations: ${feedback?.recommendations || "Chưa có"}
Score: ${feedback?.score ?? "Chưa có"}

LỊCH SỬ CHAT CỦA HỌC SINH:
${chatHistory || "Không có lịch sử chat."}

CÂU HỎI CỦA GIÁO VIÊN:
${question}

Hãy trả lời ngắn gọn, thực tế, bằng tiếng Việt, dựa trên feedback và lịch sử chat.
`;

    const answer = await generateAnswer(prompt);

    res.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Ask feedback failed",
      detail: error.message,
    });
  }
});

export default router;