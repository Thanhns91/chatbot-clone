import express from "express";
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
    .filter((w) => w.length > 3);
}

function keywordScore(text, keywords) {
  const lower = String(text || "").toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) score += 1;
  }

  return score;
}

router.post("/", async (req, res) => {
  try {
    const { documentId, message, approvedAnswers = [] } = req.body;

    if (!documentId || !message) {
      return res.status(400).json({
        answer: "Thiếu documentId hoặc message",
      });
    }

    const keywords = getKeywords(message);
    const vector = await embedText(message);

    const vectorResults = await qdrant.search(COLLECTION_NAME, {
      vector,
      limit: 10,
      with_payload: true,
      filter: {
        must: [
          {
            key: "documentId",
            match: {
              value: documentId,
            },
          },
        ],
      },
    });

    const scrollResult = await qdrant.scroll(COLLECTION_NAME, {
      limit: 1000,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          {
            key: "documentId",
            match: {
              value: documentId,
            },
          },
        ],
      },
    });

    const allChunks = scrollResult.points || [];

    if (allChunks.length === 0) {
      return res.json({
        answer: "Tài liệu không có thông tin này.",
        outOfScope: true,
      });
    }

    const keywordResults = allChunks
      .map((point) => ({
        id: point.id,
        payload: point.payload,
        keywordScore: keywordScore(point.payload?.text, keywords),
        score: keywordScore(point.payload?.text, keywords),
      }))
      .filter((item) => item.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, 5);

    const topVectorScore = vectorResults[0]?.score || 0;
    const hasKeywordMatch = keywordResults.length > 0;
    const hasStrongSemanticMatch = topVectorScore >= 0.35;

    if (!hasKeywordMatch && !hasStrongSemanticMatch) {
      return res.json({
        answer: "Tài liệu không có thông tin này.",
        outOfScope: true,
        score: topVectorScore,
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

    const finalChunks = Array.from(mergedMap.values()).slice(0, 6);

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

    const prompt = `
Bạn là chatbot hỏi đáp dựa trên tài liệu đã upload.

NHIỆM VỤ:
Trả lời QUESTION dựa trên CONTEXT TỪ TÀI LIỆU.

QUY TẮC BẮT BUỘC:
- Chỉ được dùng thông tin có trong CONTEXT TỪ TÀI LIỆU.
- Không được dùng kiến thức bên ngoài.
- Không được tự giải toán, viết code, viết công thức, hoặc trả lời kiến thức chung nếu CONTEXT không có.
- APPROVED ANSWERS chỉ là các câu trả lời trước đó user đã đánh dấu phù hợp để học cách trình bày. Nó không phải nguồn kiến thức mới.
- Nếu CONTEXT không có thông tin trực tiếp để trả lời QUESTION, chỉ trả lời đúng một câu:
"Tài liệu không có thông tin này."
- Trả lời bằng tiếng Việt.

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
      answer: answer || "Tài liệu không có thông tin này.",
      outOfScope: answer?.includes("Tài liệu không có thông tin này.") || false,
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
