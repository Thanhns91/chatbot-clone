import express from "express";
import { qdrant, COLLECTION_NAME } from "../qdrant.js";
import { ai } from "../gemini.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { documentId, message } = req.body;

    // embedding câu hỏi
    const embeddingResponse =
      await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: message,
      });

    const vector =
      embeddingResponse.embeddings[0].values;

    // search qdrant
   const searchResult = await qdrant.search(
  COLLECTION_NAME,
  {
    vector,
    limit: 2,

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
  }
);

    // lấy context
    const context = searchResult
      .map((item) => item.payload.text)
      .join("\n");

    // prompt
    const prompt = `
Bạn là chatbot hỏi đáp tài liệu.

Context:
${context}

Question:
${message}

Trả lời ngắn gọn bằng tiếng Việt.
`;

    // gọi gemini
    const response =
      await ai.models.generateContent({
       model: "gemini-2.0-flash-lite",
        contents: prompt,
      });

    const answer = response.text;

    res.json({
      answer,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      answer: "Lỗi chat",
    });
  }
});

export default router;