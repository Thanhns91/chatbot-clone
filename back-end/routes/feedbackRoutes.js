import express from "express";
import pool from "../db.js";
import { generateAnswer } from "../groq.js";

const router = express.Router();

function extractSection(text, start, end) {
  const regex = new RegExp(`${start}:\\s*([\\s\\S]*?)${end}:`, "i");
  return text.match(regex)?.[1]?.trim() || "";
}

function extractScore(text) {
  const match = text.match(/SCORE:\s*(\d+)/i);
  if (!match) return null;

  const score = Number(match[1]);
  if (Number.isNaN(score)) return null;

  return Math.max(0, Math.min(100, score));
}

function normalizeVietnamese(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDateKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function cleanText(text = "", maxLength = 260) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function classifyBusinessQuestion(question = "") {
  const q = normalizeVietnamese(question);

  const rules = [
    {
      key: "business_process",
      label: "Quy trình nghiệp vụ",
      keywords: [
        "quy trinh",
        "workflow",
        "flow",
        "cac buoc",
        "buoc nao",
        "process",
        "nghiep vu",
        "thuc hien nhu the nao",
      ],
    },
    {
      key: "business_rule",
      label: "Quy tắc nghiệp vụ",
      keywords: [
        "rule",
        "business rule",
        "quy tac",
        "dieu kien",
        "rang buoc",
        "constraint",
        "validation",
        "hop le",
        "khong hop le",
        "duoc phep",
        "khong duoc",
      ],
    },
    {
      key: "requirement_classification",
      label: "Phân loại yêu cầu",
      keywords: [
        "fr",
        "nfr",
        "functional",
        "non functional",
        "yeu cau chuc nang",
        "phi chuc nang",
        "phan loai yeu cau",
        "requirement",
        "srs",
      ],
    },
    {
      key: "actor_usecase",
      label: "Actor / Use case",
      keywords: [
        "actor",
        "use case",
        "nguoi dung",
        "vai tro",
        "tac nhan",
        "luong su kien",
        "scenario",
        "uc",
      ],
    },
    {
      key: "data_model",
      label: "Dữ liệu / Entity / Database",
      keywords: [
        "database",
        "bang",
        "table",
        "entity",
        "attribute",
        "du lieu",
        "truong",
        "cot",
        "relationship",
        "quan he",
        "erd",
      ],
    },
    {
      key: "ui_ux",
      label: "Giao diện / Trải nghiệm người dùng",
      keywords: [
        "ui",
        "ux",
        "giao dien",
        "man hinh",
        "button",
        "nut",
        "form",
        "hien thi",
        "library",
        "dashboard",
      ],
    },
    {
      key: "testing_quality",
      label: "Kiểm thử / Chất lượng",
      keywords: [
        "test",
        "testing",
        "test case",
        "bug",
        "loi",
        "kiem thu",
        "expected",
        "actual",
        "defect",
      ],
    },
    {
      key: "implementation",
      label: "Triển khai kỹ thuật",
      keywords: [
        "code",
        "api",
        "backend",
        "frontend",
        "react",
        "node",
        "express",
        "sql",
        "deploy",
        "railway",
        "vercel",
      ],
    },
    {
      key: "definition",
      label: "Khái niệm / Định nghĩa",
      keywords: [
        "la gi",
        "dinh nghia",
        "khai niem",
        "meaning",
        "what is",
        "giai thich",
      ],
    },
    {
      key: "comparison",
      label: "So sánh / Phân biệt",
      keywords: [
        "so sanh",
        "khac nhau",
        "phan biet",
        "compare",
        "difference",
        "versus",
        "vs",
      ],
    },
    {
      key: "summary",
      label: "Tóm tắt / Ôn tập",
      keywords: [
        "tom tat",
        "tong ket",
        "noi dung chinh",
        "summary",
        "overview",
        "on tap",
      ],
    },
  ];

  const matched = rules.find((rule) =>
    rule.keywords.some((keyword) => q.includes(normalizeVietnamese(keyword))),
  );

  return matched || { key: "unknown", label: "Chưa rõ mục đích hỏi" };
}

function buildFeedbackAnalytics(messages = [], activities = []) {
  const userMessages = messages.filter((msg) => msg.sender === "user");
  const aiMessages = messages.filter((msg) => msg.sender === "ai");
  const sessionIds = new Set(messages.map((msg) => msg.sessionId).filter(Boolean));
  const activeDays = new Set(
    userMessages.map((msg) => toDateKey(msg.createdAt)).filter(Boolean),
  );

  const firstQuestionAt = userMessages[0]?.createdAt || null;
  const lastQuestionAt = userMessages[userMessages.length - 1]?.createdAt || null;

  const categoryMap = new Map();

  userMessages.forEach((msg) => {
    const category = classifyBusinessQuestion(msg.message);
    const current = categoryMap.get(category.key) || {
      key: category.key,
      label: category.label,
      count: 0,
      examples: [],
    };

    current.count += 1;

    if (current.examples.length < 3) {
      current.examples.push(cleanText(msg.message, 180));
    }

    categoryMap.set(category.key, current);
  });

  const categories = [...categoryMap.values()].sort((a, b) => b.count - a.count);

  const totalQuestions = userMessages.length;
  const activeDayCount = activeDays.size;
  const avgQuestionsPerActiveDay = activeDayCount
    ? Number((totalQuestions / activeDayCount).toFixed(1))
    : 0;

  let engagementLevel = "Chưa đủ dữ liệu";
  if (totalQuestions >= 12 || avgQuestionsPerActiveDay >= 5) {
    engagementLevel = "Hoạt động cao";
  } else if (totalQuestions >= 5) {
    engagementLevel = "Hoạt động trung bình";
  } else if (totalQuestions >= 1) {
    engagementLevel = "Hoạt động thấp";
  }

  const activitySummary = activities
    .map((item) => `${item.activityType}: ${item.count}`)
    .join("; ");

  return {
    totalMessages: messages.length,
    totalQuestions,
    totalAiReplies: aiMessages.length,
    sessionCount: sessionIds.size,
    activeDayCount,
    avgQuestionsPerActiveDay,
    firstQuestionAt: firstQuestionAt ? new Date(firstQuestionAt).toISOString() : null,
    lastQuestionAt: lastQuestionAt ? new Date(lastQuestionAt).toISOString() : null,
    engagementLevel,
    categories,
    activitySummary: activitySummary || "Không có dữ liệu StudentActivities",
    recentQuestions: userMessages.slice(-5).map((msg) => cleanText(msg.message, 220)),
  };
}

function analyticsToPromptText(analytics) {
  const categoryText = analytics.categories.length
    ? analytics.categories
        .map(
          (cat) =>
            `- ${cat.label} (${cat.key}): ${cat.count} câu. Ví dụ: ${cat.examples
              .map((item) => `"${item}"`)
              .join(" | ")}`,
        )
        .join("\n")
    : "Không có câu hỏi của học sinh.";

  const recentQuestionText = analytics.recentQuestions.length
    ? analytics.recentQuestions.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "Không có câu hỏi gần đây.";

  return `
THỐNG KÊ HOẠT ĐỘNG:
- Tổng số message: ${analytics.totalMessages}
- Số câu hỏi của học sinh: ${analytics.totalQuestions}
- Số phản hồi AI: ${analytics.totalAiReplies}
- Số session liên quan: ${analytics.sessionCount}
- Số ngày học sinh có hoạt động hỏi: ${analytics.activeDayCount}
- Trung bình câu hỏi / ngày active: ${analytics.avgQuestionsPerActiveDay}
- Mức độ hoạt động: ${analytics.engagementLevel}
- Câu hỏi đầu tiên: ${analytics.firstQuestionAt || "Không có"}
- Câu hỏi gần nhất: ${analytics.lastQuestionAt || "Không có"}
- StudentActivities: ${analytics.activitySummary}

PHÂN LOẠI CÂU HỎI THEO NGHIỆP VỤ / MỤC ĐÍCH HỌC:
${categoryText}

5 CÂU HỎI GẦN NHẤT:
${recentQuestionText}
`;
}

function buildFallbackFeedback(analytics) {
  const strongestCategory = analytics.categories[0]?.label || "chưa rõ";
  const score = Math.min(85, Math.max(35, 35 + analytics.totalQuestions * 5));

  return {
    summary: `${analytics.engagementLevel}: ${analytics.totalQuestions} câu hỏi trong ${analytics.activeDayCount} ngày active, nổi bật ở nhóm "${strongestCategory}".`,
    strengths: `- Có tương tác với tài liệu; nhóm hỏi nổi bật: ${strongestCategory}.`,
    weaknesses: `- Dữ liệu còn ít hoặc thiếu câu hỏi vận dụng nếu tổng câu hỏi thấp.`,
    recommendations: `- Kiểm tra nhanh 2 câu vận dụng theo nhóm "${strongestCategory}".\n- Giao 1 bài nhỏ yêu cầu học sinh tự giải thích lại bằng ví dụ.`,
    score,
  };
}

async function getStudentActivities(studentId, documentId) {
  try {
    const [rows] = await pool.query(
      `
      SELECT activityType, COUNT(*) AS count
      FROM StudentActivities
      WHERE userId = ?
        AND (? IS NULL OR documentId = ?)
      GROUP BY activityType
      ORDER BY count DESC
      `,
      [studentId, documentId || null, documentId || null],
    );

    return rows.map((item) => ({
      activityType: item.activityType,
      count: Number(item.count || 0),
    }));
  } catch (error) {
    console.log("Cannot load student activities:", error.message);
    return [];
  }
}

async function updateQuestionCategories(messages = []) {
  const userMessages = messages.filter((msg) => msg.sender === "user" && msg.messageId);

  for (const msg of userMessages) {
    const category = classifyBusinessQuestion(msg.message);

    try {
      await pool.query(
        `
        UPDATE ChatMessages
        SET questionCategory = ?
        WHERE messageId = ?
          AND (questionCategory IS NULL OR questionCategory = '')
        `,
        [category.key, msg.messageId],
      );
    } catch (error) {
      console.log("Update question category failed:", error.message);
    }
  }
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
        AND d.isDeleted = FALSE
        AND d.reviewStatus = 'approved'

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
      SELECT documentId, fileName, fileUrl, uploadDate, reviewStatus
      FROM Documents
      WHERE documentId = ?
        AND uploaderId = ?
        AND uploadedBy = 'student'
        AND uploadStatus = 'success'
        AND isDeleted = FALSE
        AND reviewStatus = 'approved'
      LIMIT 1
      `,
      [documentId, studentId],
    );

    if (docRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found or not public yet",
      });
    }

    const document = docRows[0];

    const [messages] = await pool.query(
      `
      SELECT
        cm.messageId,
        cs.sessionId,
        cs.title,
        cm.sender,
        cm.message,
        cm.questionCategory,
        cm.createdAt
      FROM ChatSessions cs
      JOIN ChatMessages cm ON cs.sessionId = cm.sessionId
      WHERE cs.userId = ?
        AND cs.documentId = ?
      ORDER BY cm.createdAt ASC
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

    await updateQuestionCategories(messages);

    const sessionId = messages[0]?.sessionId || null;
    const activities = await getStudentActivities(studentId, documentId);
    const analytics = buildFeedbackAnalytics(messages, activities);

    const chatHistory = messages
      .map((msg) => `${String(msg.sender).toUpperCase()}: ${cleanText(msg.message, 500)}`)
      .join("\n");

    const analyticsText = analyticsToPromptText(analytics);

    const prompt = `
Bạn là chuyên gia cố vấn sư phạm và phân tích dữ liệu học tập cho giảng viên.

Nhiệm vụ của bạn là đánh giá chân thực, cụ thể và có giá trị sư phạm thực tế về quá trình học tập của sinh viên dựa trên lịch sử tương tác giữa sinh viên và Chatbot. KHÔNG đánh giá rập khuôn như robot.

THÔNG TIN SINH VIÊN & BÀI HỌC:
- Sinh viên: ${student.fullName} (${student.email})
- Tài liệu học tập: ${document.fileName}

${analyticsText}

LỊCH SỬ TƯƠNG TÁC CHI TIẾT:
${chatHistory}

TIÊU CHÍ ĐÁNH GIÁ THỰC TẾ & CHUYÊN MÔN SƯ PHẠM:
1. MỨC ĐỘ CHỦ ĐỘNG & TƯƠNG TÁC: Đánh giá qua số ngày active, tổng số câu hỏi và tính liên tục trong quá trình đọc tài liệu (học chủ động hay chỉ hỏi đối phó 1 câu trước giờ nộp).
2. CẤP ĐỘ TƯ DUY CÂU HỎI (Bloom's Taxonomy):
   - Mức độ Nhận biết: Chỉ hỏi định nghĩa/khái niệm "là gì", "danh sách nào".
   - Mức độ Phân tích/Hiểu: Hỏi "vì sao", "như thế nào", "khác nhau ra sao".
   - Mức độ Vận dụng/Phản biện: Đưa ra tình huống thực tế, đoạn mã/bài tập cụ thể hoặc hỏi trường hợp ngoại lệ (Edge cases).
3. MẠCH TƯ DUY LÝ LUẬN: Đánh giá câu hỏi có chuỗi logic phát triển bài học (tổng quan -> chi tiết -> bài tập) hay chỉ hỏi rời rạc.
4. ĐỘ TRỌNG TÂM KIẾN THỨC: Xác định sinh viên có tập trung vào cốt lõi tài liệu (${document.fileName}) hay bị lệch sang mảng khác.

CHUẨN RUBRIC THANG ĐIỂM 100:
- 0-30: Rất ít tương tác (1-2 câu), dữ liệu không đủ để đánh giá hoặc chỉ chào hỏi.
- 31-50: Tương tác mức cơ bản, chỉ hỏi tra cứu khái niệm rời rạc, chưa có tư duy vận dụng.
- 51-70: Tương tác ổn, hỏi đúng trọng tâm bài học nhưng các câu hỏi còn ở mức bề nổi, thiếu chiều sâu bài tập/tình huống.
- 71-85: Tương tác tốt, biết đặt câu hỏi phân tích nghiệp vụ/quy trình, có chuỗi hỏi phát triển kiến thức rõ ràng.
- 86-100: Tương tác xuất sắc, có tư duy phản biện cao, tự đưa ra bài tập/tình huống/đoạn code cụ thể để đối chiếu với Chatbot.

YÊU CẦU FORMAT CHÍNH XÁC:

SUMMARY:
Tóm tắt ngắn gọn 1 câu (tối đa 35 từ) nhận xét chuyên môn về thái độ học tập và cấp độ tư duy của sinh viên.

STRENGTHS:
Tối đa 2 dòng bullet (mỗi dòng tối đa 20 từ), trích dẫn minh chứng từ câu hỏi thực tế của sinh viên.

WEAKNESSES:
Tối đa 2 dòng bullet (mỗi dòng tối đa 20 từ), nêu rõ điểm hổng kiến thức hoặc hạn chế tư duy cần khắc phục.

RECOMMENDATIONS:
Tối đa 2 dòng bullet, đưa ra 2 HÀNH ĐỘNG CỤ THỂ giảng viên có thể dùng ngay trên lớp (ví dụ: gọi sinh viên giải thích câu X, giao bài tập vận dụng Y).

SCORE:
Một con số nguyên duy nhất từ 0 đến 100 theo chuẩn Rubric trên.
`;

    const aiResult = await generateAnswer(prompt, {
      maxTokens: 500,
      temperature: 0.2,
    });

    const fallback = buildFallbackFeedback(analytics);

    const summary = extractSection(aiResult, "SUMMARY", "STRENGTHS") || fallback.summary;
    const strengths = extractSection(aiResult, "STRENGTHS", "WEAKNESSES") || fallback.strengths;
    const weaknesses = extractSection(aiResult, "WEAKNESSES", "RECOMMENDATIONS") || fallback.weaknesses;
    const recommendations = extractSection(aiResult, "RECOMMENDATIONS", "SCORE") || fallback.recommendations;
    const score = extractScore(aiResult) ?? fallback.score;

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
        analytics,
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
      SELECT d.documentId, d.fileName, d.reviewStatus, u.fullName AS student
      FROM Documents d
      JOIN Users u ON d.uploaderId = u.userId
      WHERE d.documentId = ?
        AND d.uploaderId = ?
        AND d.uploadedBy = 'student'
        AND d.uploadStatus = 'success'
        AND d.isDeleted = FALSE
        AND d.reviewStatus = 'approved'
      LIMIT 1
      `,
      [documentId, studentId],
    );

    if (docRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Submission not found or not public yet",
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
      SELECT cm.messageId, cm.sender, cm.message, cm.questionCategory, cm.createdAt, cs.sessionId
      FROM ChatSessions cs
      JOIN ChatMessages cm ON cs.sessionId = cm.sessionId
      WHERE cs.userId = ?
        AND cs.documentId = ?
      ORDER BY cm.createdAt ASC
      `,
      [studentId, documentId],
    );

    const feedback = feedbackRows[0];
    const activities = await getStudentActivities(studentId, documentId);
    const analytics = buildFeedbackAnalytics(messages, activities);
    const analyticsText = analyticsToPromptText(analytics);

    const chatHistory = messages
      .slice(-30)
      .map((msg) => `${String(msg.sender).toUpperCase()}: ${cleanText(msg.message, 400)}`)
      .join("\n");

    const prompt = `
Bạn là trợ lý phân tích học tập cho giáo viên.
Không trả lời kiểu chatbot chung chung. Hãy trả lời theo hướng thực tiễn, có bằng chứng từ hoạt động học sinh.

Student: ${doc.student}
File: ${doc.fileName}

FEEDBACK GẦN NHẤT:
Summary: ${feedback?.summary || "Chưa có"}
Strengths: ${feedback?.strengths || "Chưa có"}
Weaknesses: ${feedback?.weaknesses || "Chưa có"}
Recommendations: ${feedback?.recommendations || "Chưa có"}
Score: ${feedback?.score ?? "Chưa có"}

${analyticsText}

LỊCH SỬ CHAT GẦN ĐÂY:
${chatHistory || "Không có lịch sử chat."}

CÂU HỎI CỦA GIÁO VIÊN:
${question}

YÊU CẦU TRẢ LỜI:
- Trả lời bằng tiếng Việt.
- Trả lời tối đa 4 câu hoặc 3 bullet ngắn, không viết dài.
- Nếu có thể, đưa ra: nhận định, bằng chứng, hành động giáo viên nên làm.
- Nếu dữ liệu chưa đủ, nói rõ thiếu dữ liệu gì và nên kiểm tra thêm gì.
`;

    const answer = await generateAnswer(prompt, {
      maxTokens: 320,
      temperature: 0.25,
    });

    res.json({
      success: true,
      answer,
      analytics,
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
