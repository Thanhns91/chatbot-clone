import express from "express";
import pool from "../db.js";
import { qdrant, COLLECTION_NAME } from "../qdrant.js";
import { embedText } from "../huggingface.js";
import { generateAnswer } from "../groq.js";

const router = express.Router();

function getKeywords(message) {
  return String(message || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

function keywordScore(text, keywords) {
  const lower = String(text || "").toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) score += 1;
  }

  return score;
}

function getNoInfoAnswer(responseLanguage) {
  return responseLanguage === "en"
    ? "The document does not contain this information."
    : "Tài liệu không có thông tin này.";
}

function getMissingDocumentAnswer(responseLanguage) {
  return responseLanguage === "en"
    ? "Document not found."
    : "Không tìm thấy tài liệu này.";
}

function getMissingInputAnswer(responseLanguage) {
  return responseLanguage === "en"
    ? "Missing documentId or message."
    : "Thiếu documentId hoặc message.";
}

router.post("/", async (req, res) => {
  try {
    const {
      documentId,
      message,
      approvedAnswers = [],
      responseLanguage = "vi",
    } = req.body;

    const noInfoAnswer = getNoInfoAnswer(responseLanguage);

    if (!documentId || !message) {
      return res.status(400).json({
        answer: getMissingInputAnswer(responseLanguage),
      });
    }

    const [docRows] = await pool.query(
      `
      SELECT
        documentId,
        fileName,
        vectorDocumentId,
        versionGroupId,
        versionNo,
        isDuplicate
      FROM Documents
      WHERE documentId = ?
      LIMIT 1
      `,
      [documentId]
    );

    if (docRows.length === 0) {
      return res.json({
        answer: getMissingDocumentAnswer(responseLanguage),
        outOfScope: true,
      });
    }

    const selectedDoc = docRows[0];

    const qdrantDocumentId =
      selectedDoc.vectorDocumentId || selectedDoc.documentId;

    console.log("CHAT SELECTED DOCUMENT:", selectedDoc.documentId);
    console.log("QDRANT DOCUMENT ID:", qdrantDocumentId);
    console.log("RESPONSE LANGUAGE:", responseLanguage);

    const keywords = getKeywords(message);
    const vector = await embedText(message);

    const qdrantFilter = {
      must: [
        {
          key: "documentId",
          match: {
            value: qdrantDocumentId,
          },
        },
      ],
    };

    const vectorResults = await qdrant.search(COLLECTION_NAME, {
      vector,
      limit: 10,
      with_payload: true,
      filter: qdrantFilter,
    });

    const scrollResult = await qdrant.scroll(COLLECTION_NAME, {
      limit: 1000,
      with_payload: true,
      with_vector: false,
      filter: qdrantFilter,
    });

    const allChunks = scrollResult.points || [];

    if (allChunks.length === 0) {
      return res.json({
        answer: noInfoAnswer,
        outOfScope: true,
        documentId: selectedDoc.documentId,
        vectorDocumentId: qdrantDocumentId,
      });
    }

    const keywordResults = allChunks
      .map((point) => {
        const score = keywordScore(point.payload?.text, keywords);

        return {
          id: point.id,
          payload: point.payload,
          keywordScore: score,
          score,
        };
      })
      .filter((item) => item.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, 5);

    const topVectorScore = vectorResults[0]?.score || 0;
    const hasKeywordMatch = keywordResults.length > 0;
    const hasStrongSemanticMatch = topVectorScore >= 0.2;

    console.log("ALL CHUNKS:", allChunks.length);
    console.log("KEYWORDS:", keywords);
    console.log("KEYWORD RESULTS:", keywordResults.length);
    console.log("TOP VECTOR SCORE:", topVectorScore);

    if (!hasKeywordMatch && !hasStrongSemanticMatch) {
      return res.json({
        answer: noInfoAnswer,
        outOfScope: true,
        score: topVectorScore,
        documentId: selectedDoc.documentId,
        vectorDocumentId: qdrantDocumentId,
      });
    }

    const mergedMap = new Map();

    for (const item of keywordResults) {
      mergedMap.set(item.id, item);
    }

    for (const item of vectorResults) {
      if (!mergedMap.has(item.id)) {
        mergedMap.set(item.id, item);
      }
    }

    let finalChunks = Array.from(mergedMap.values()).slice(0, 6);

    if (finalChunks.length === 0) {
      finalChunks = vectorResults.slice(0, 6);
    }

    if (finalChunks.length === 0 && allChunks.length > 0) {
      finalChunks = allChunks.slice(0, 6).map((point) => ({
        id: point.id,
        payload: point.payload,
        score: 0,
        keywordScore: 0,
      }));
    }

    const context = finalChunks
      .map((item, index) => {
        return `CHUNK ${index + 1}:\n${item.payload?.text || ""}`;
      })
      .join("\n\n---\n\n");

    const approvedContext = Array.isArray(approvedAnswers)
      ? approvedAnswers
          .slice(-5)
          .map((item, index) => {
            return `APPROVED ${index + 1}
QUESTION: ${item.question || ""}
ANSWER: ${item.answer || ""}`;
          })
          .join("\n\n")
      : "";

    const answerLanguageRule =
      responseLanguage === "en"
        ? "Answer in English."
        : "Trả lời bằng tiếng Việt.";

    const prompt = `
Bạn là chatbot hỏi đáp dựa trên tài liệu đã upload.

TÀI LIỆU ĐANG ĐƯỢC CHỌN:
- File name: ${selectedDoc.fileName}
- Version: ${selectedDoc.versionNo || 1}

NHIỆM VỤ:
Trả lời QUESTION dựa trên CONTEXT TỪ TÀI LIỆU.

QUY TẮC BẮT BUỘC:
- Chỉ được dùng thông tin có trong CONTEXT TỪ TÀI LIỆU.
- Không được dùng kiến thức bên ngoài.
- Không được tự giải toán, viết code, viết công thức, hoặc trả lời kiến thức chung nếu CONTEXT không có.
- APPROVED ANSWERS chỉ là các câu trả lời trước đó user đã đánh dấu phù hợp để học cách trình bày. Nó không phải nguồn kiến thức mới.
- Nếu CONTEXT không có thông tin trực tiếp để trả lời QUESTION, chỉ trả lời đúng một câu:
"${noInfoAnswer}"
- ${answerLanguageRule}

APPROVED ANSWERS:
${approvedContext || "Không có."}

CONTEXT TỪ TÀI LIỆU:
${context}

QUESTION:
${message}

ANSWER:
`;

    const answer = await generateAnswer(prompt);

    res.json({
      answer: answer || noInfoAnswer,
      outOfScope: answer?.includes(noInfoAnswer) || false,
      documentId: selectedDoc.documentId,
      vectorDocumentId: qdrantDocumentId,
      versionNo: selectedDoc.versionNo || 1,
      isDuplicate: Boolean(selectedDoc.isDuplicate),
      responseLanguage,
      evidence: finalChunks.map((item) => ({
        chunkIndex: item.payload?.chunkIndex,
        text: item.payload?.text,
        score: item.score || item.keywordScore || 0,
      })),
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      answer: "Lỗi chat",
      detail: error.message,
    });
  }
});

export default router;