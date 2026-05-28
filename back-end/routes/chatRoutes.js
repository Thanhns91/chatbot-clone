import express from "express";

import { qdrant, COLLECTION_NAME } from "../qdrant.js";
import { embedText } from "../huggingface.js";
import { generateAnswer } from "../groq.js";

const router = express.Router();

function getKeywords(message) {
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function keywordScore(text, keywords) {
  const lower = text.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      score += 1;
    }
  }

  return score;
}

router.post("/", async (req, res) => {
  try {
    const { documentId, message } = req.body;

    if (!documentId || !message) {
      return res.status(400).json({
        answer: "Thiếu documentId hoặc message",
      });
    }

    const keywords = getKeywords(message);

    // 1. Vector search
    const vector = await embedText(message);

    const vectorResults = await qdrant.search(COLLECTION_NAME, {
      vector,
      limit: 10,
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

    // 2. Keyword search: lấy toàn bộ chunk của document
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

    // 3. Chấm điểm keyword cho tất cả chunk
    const keywordResults = allChunks
      .map((point) => ({
        id: point.id,
        payload: point.payload,
        score: keywordScore(point.payload.text, keywords),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // 4. Gộp vector + keyword, bỏ trùng
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
        return `CHUNK ${index + 1}:\n${item.payload.text}`;
      })
      .join("\n\n---\n\n");

    console.log("VECTOR RESULT:", vectorResults.length);
    console.log("KEYWORD RESULT:", keywordResults.length);
    console.log("FINAL CONTEXT:", context);

 const prompt = `
Bạn là chatbot hỏi đáp tài liệu.

Dựa vào CONTEXT bên dưới, hãy trả lời QUESTION.

QUY TẮC:
- Nếu CONTEXT có thông tin liên quan, hãy trả lời bằng thông tin đó.
- Không được bịa thêm ngoài CONTEXT.
- Trả lời bằng tiếng Việt.
- Nếu QUESTION là một cụm gần giống trong CONTEXT, hãy giải thích hoặc liệt kê nội dung ngay sau cụm đó.

CONTEXT:
${context}

QUESTION:
${message}

ANSWER:
`;

    const answer = await generateAnswer(prompt);

    res.json({
      answer: answer || "Không có phản hồi",
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