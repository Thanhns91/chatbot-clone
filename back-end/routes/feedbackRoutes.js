import express from "express";
import pool from "../db.js";
import { generateAnswer } from "../groq.js";

const router = express.Router();

function extractSection(text, start, end) {
  const regex = new RegExp(`${start}:\\s*([\\s\\S]*?)${end}:`, "i");
  return text.match(regex)?.[1]?.trim() || "";
}

function extractLastSection(text, start) {
  const regex = new RegExp(`${start}:\\s*([\\s\\S]*)`, "i");
  return text.match(regex)?.[1]?.trim() || "";
}

function extractScore(text) {
  const match = text.match(/SCORE:\s*(\d+)/i);
  if (!match) return null;

  const score = Number(match[1]);

  if (Number.isNaN(score)) return null;

  return Math.max(0, Math.min(100, score));
}

router.get("/submissions", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        d.id,
        d.documentId,
        d.fileName,
        d.fileType,
        d.fileUrl,
        d.uploadDate,
        d.reviewStatus,
        d.uploaderId AS studentId,
        u.fullName AS student,
        u.email AS studentEmail,

        sf.feedbackId,
        sf.summary,
        sf.strengths,
        sf.weaknesses,
        sf.recommendations,
        sf.score,
        sf.status AS feedbackStatus,
        sf.createdAt AS feedbackCreatedAt

      FROM Documents d
      JOIN Users u ON d.uploaderId = u.userId

      LEFT JOIN StudentFeedback sf
        ON sf.feedbackId = (
          SELECT sf2.feedbackId
          FROM StudentFeedback sf2
          WHERE sf2.studentId = d.uploaderId
            AND sf2.documentId = d.documentId
          ORDER BY sf2.createdAt DESC
          LIMIT 1
        )

      WHERE d.uploadedBy = 'student'
        AND d.uploadStatus = 'success'

      ORDER BY d.uploadDate DESC
    `);

    const data = rows.map((item) => ({
      ...item,
      submittedAt: item.uploadDate
        ? new Date(item.uploadDate).toISOString().split("T")[0]
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
      WHERE userId = ? AND role = 'student'
      LIMIT 1
      `,
      [studentId]
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
      SELECT documentId, fileName, fileUrl, uploadDate
      FROM Documents
      WHERE documentId = ?
      LIMIT 1
      `,
      [documentId]
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
      JOIN ChatMessages cm ON cs.sessionId = cm.sessionId
      WHERE cs.userId = ?
        AND cs.documentId = ?
      ORDER BY cm.createdAt ASC
      `,
      [studentId, documentId]
    );

    if (messages.length === 0) {
      return res.json({
        success: false,
        message:
          "No chat history found for this student and document. Student needs to chat with this file first.",
      });
    }

    const sessionId = messages[0]?.sessionId || null;

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
    const weaknesses = extractSection(aiResult, "WEAKNESSES", "RECOMMENDATIONS");
    const recommendations = extractSection(aiResult, "RECOMMENDATIONS", "SCORE");
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
      ]
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

    const [docRows] = await pool.query(
      `
      SELECT d.documentId, d.fileName, u.fullName AS student
      FROM Documents d
      JOIN Users u ON d.uploaderId = u.userId
      WHERE d.documentId = ?
        AND d.uploaderId = ?
      LIMIT 1
      `,
      [documentId, studentId]
    );

    if (docRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
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
      [studentId, documentId]
    );

    const [messages] = await pool.query(
      `
      SELECT cm.sender, cm.message, cm.createdAt
      FROM ChatSessions cs
      JOIN ChatMessages cm ON cs.sessionId = cm.sessionId
      WHERE cs.userId = ?
        AND cs.documentId = ?
      ORDER BY cm.createdAt ASC
      `,
      [studentId, documentId]
    );

    const feedback = feedbackRows[0];

    const chatHistory = messages
      .map((msg) => `${String(msg.sender).toUpperCase()}: ${msg.message}`)
      .join("\n");

    const prompt = `
Bạn là trợ lý cho giáo viên.

Giáo viên đang xem feedback học sinh:
Student: ${doc.student}
File: ${doc.fileName}

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