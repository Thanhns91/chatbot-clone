import express from "express";
import pool from "../db.js";
import { qdrant, COLLECTION_NAME } from "../qdrant.js";
import { embedText } from "../huggingface.js";
import { generateAnswer } from "../groq.js";

const router = express.Router();

const MAX_USER_QUESTION_CHARS = 3000;
const MAX_EMBED_QUERY_CHARS = 1500;
const MAX_HISTORY_CHARS = 2500;
const MAX_CONTEXT_CHARS = 12000;
const MAX_SINGLE_CHUNK_CHARS = 1600;

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
  const lower = String(text || "").toLowerCase().normalize("NFC");
  let score = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) score += 1;
  }

  return score;
}

function removeVietnameseTones(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function getImportantKeywords(message) {
  const rawWords = String(message || "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const stopWords = new Set([
    "what",
    "who",
    "where",
    "when",
    "why",
    "how",
    "is",
    "are",
    "was",
    "were",
    "the",
    "a",
    "an",
    "of",
    "in",
    "on",
    "for",
    "to",
    "and",
    "or",
    "with",
    "about",
    "give",
    "me",
    "tell",
    "explain",
    "là",
    "gì",
    "ai",
    "ở",
    "đâu",
    "khi",
    "nào",
    "tại",
    "sao",
    "như",
    "thế",
    "của",
    "trong",
    "về",
    "cho",
    "tôi",
    "hãy",
    "nêu",
    "giải",
    "thích",
    "trình",
    "bày",
    "biết",
    "các",
    "những",
    "một",
    "và",
    "hoặc",
  ]);

  return rawWords
    .filter((word) => {
      const lower = word.toLowerCase();

      if (stopWords.has(lower)) return false;

      if (/^[A-Z0-9]{2,}$/.test(word)) return true;

      return lower.length >= 3;
    })
    .map((word) => word.toLowerCase());
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasExactImportantKeywordMatch(text, importantKeywords) {
  const originalText = String(text || "").toLowerCase().normalize("NFC");
  const noToneText = removeVietnameseTones(originalText).toLowerCase();

  return importantKeywords.some((keyword) => {
    const originalKeyword = String(keyword || "").toLowerCase().normalize("NFC");
    const noToneKeyword = removeVietnameseTones(originalKeyword).toLowerCase();

    const escapedOriginal = escapeRegExp(originalKeyword);
    const escapedNoTone = escapeRegExp(noToneKeyword);

    const originalRegex = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapedOriginal}([^\\p{L}\\p{N}]|$)`,
      "iu",
    );

    const noToneRegex = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapedNoTone}([^\\p{L}\\p{N}]|$)`,
      "iu",
    );

    return originalRegex.test(originalText) || noToneRegex.test(noToneText);
  });
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

function limitText(text = "", maxChars = 1000) {
  const value = String(text || "").trim();

  if (value.length <= maxChars) return value;

  return `${value.slice(
    0,
    maxChars,
  )}\n...[Nội dung đã được rút gọn do quá dài]`;
}

function buildContextWithBudget(finalChunks, docNameMap) {
  let total = 0;
  const parts = [];

  for (let index = 0; index < finalChunks.length; index++) {
    const item = finalChunks[index];

    const sourceDocumentId =
      item.payload?.vectorDocumentId ||
      item.payload?.documentId ||
      item.sourceDocumentId;

    const sourceFile =
      docNameMap.get(sourceDocumentId) ||
      item.payload?.fileName ||
      "Unknown file";

    const chunkText = limitText(
      item.payload?.text || "",
      MAX_SINGLE_CHUNK_CHARS,
    );

    const block = `SOURCE ${index + 1}
FILE: ${sourceFile}
${chunkText}`;

    if (total + block.length > MAX_CONTEXT_CHARS) break;

    parts.push(block);
    total += block.length;
  }

  return parts.join("\n\n---\n\n");
}

function extractRequestedPages(message) {
  const text = String(message || "").toLowerCase();
  const pages = [];

  const regex = /(?:trang|page)\s*(\d+)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const page = Number(match[1]);
    if (!Number.isNaN(page)) pages.push(page);
  }

  return [...new Set(pages)];
}

function isContinueQuestion(message) {
  const text = String(message || "").toLowerCase().normalize("NFC");

  return (
    text.includes("tiếp") ||
    text.includes("còn lại") ||
    text.includes("continue") ||
    text.includes("phần sau") ||
    text.includes("phần còn")
  );
}

function isQuoteRequest(message) {
  const text = String(message || "").toLowerCase().normalize("NFC");

  return (
    text.includes("trích dẫn") ||
    text.includes("nguyên văn") ||
    text.includes("lời nói") ||
    text.includes("câu nói") ||
    text.includes("phát biểu") ||
    text.includes("quote") ||
    text.includes("quotes")
  );
}

function extractQuoteTargetName(message) {
  const text = String(message || "").trim();

  const patterns = [
    /(?:lời nói của|câu nói của|phát biểu của|trích dẫn của|của)\s+([A-ZÀ-Ỹ][\p{L}.'-]+(?:\s+[A-ZÀ-Ỹ][\p{L}.'-]+){0,5})/u,
    /(?:quote|quotes|statement|statements)\s+(?:of|by|from)\s+([A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+){0,5})/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].replace(/[?.!,;:]+$/g, "").trim();
    }
  }

  const capitalized = text.match(
    /\b[A-ZÀ-Ỹ][\p{L}.'-]+(?:\s+[A-ZÀ-Ỹ][\p{L}.'-]+){1,4}\b/u,
  );

  return capitalized?.[0]?.trim() || "";
}

function normalizeSearchText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textContainsPersonName(text, personName) {
  const normalizedText = normalizeSearchText(text);
  const normalizedName = normalizeSearchText(personName);

  if (!normalizedText || !normalizedName) return false;

  if (normalizedText.includes(normalizedName)) return true;

  const tokens = normalizedName
    .split(/\s+/)
    .filter((token) => token.length >= 2);

  if (tokens.length === 0) return false;

  const hitCount = tokens.filter((token) =>
    normalizedText.includes(token),
  ).length;

  return hitCount === tokens.length;
}

function buildQuoteFocusedChunks(allChunks, personName) {
  if (!personName) return [];

  const grouped = new Map();

  for (const point of allChunks) {
    const sourceDocumentId =
      point.payload?.vectorDocumentId ||
      point.payload?.documentId ||
      point.sourceDocumentId ||
      "unknown";

    if (!grouped.has(sourceDocumentId)) {
      grouped.set(sourceDocumentId, []);
    }

    grouped.get(sourceDocumentId).push(point);
  }

  const selected = new Map();

  for (const [, chunks] of grouped.entries()) {
    const sorted = [...chunks].sort((a, b) => {
      const aIndex = Number(a.payload?.chunkIndex || 0);
      const bIndex = Number(b.payload?.chunkIndex || 0);
      return aIndex - bIndex;
    });

    for (let i = 0; i < sorted.length; i++) {
      const text = sorted[i].payload?.text || "";

      if (!textContainsPersonName(text, personName)) continue;

      const start = Math.max(0, i - 1);
      const end = Math.min(sorted.length - 1, i + 2);

      for (let j = start; j <= end; j++) {
        const item = sorted[j];

        selected.set(String(item.id), {
          id: item.id,
          payload: item.payload,
          sourceDocumentId:
            item.payload?.vectorDocumentId ||
            item.payload?.documentId ||
            item.sourceDocumentId,
          keywordScore: 20,
          score: 20,
        });
      }
    }
  }

  return Array.from(selected.values());
}

function makeQdrantFilter(documentId) {
  return {
    must: [
      {
        key: "documentId",
        match: {
          value: documentId,
        },
      },
    ],
  };
}

async function getRecentHistory(sessionId) {
  if (!sessionId) return "";

  const [historyRows] = await pool.query(
    `
    SELECT sender, message
    FROM ChatMessages
    WHERE sessionId = ?
    ORDER BY createdAt DESC
    LIMIT 10
    `,
    [sessionId],
  );

  return historyRows
    .reverse()
    .map((item) => `${String(item.sender).toUpperCase()}: ${item.message}`)
    .join("\n");
}

router.post("/", async (req, res) => {
  try {
    const {
      documentId,
      documentIds,
      sessionId,
      message,
      approvedAnswers = [],
      responseLanguage = "vi",
    } = req.body;

    const targetDocumentIds = Array.isArray(documentIds)
      ? documentIds.filter(Boolean)
      : documentId
        ? [documentId]
        : [];

    const uniqueTargetDocumentIds = [...new Set(targetDocumentIds.map(String))];
    const noInfoAnswer = getNoInfoAnswer(responseLanguage);
    const safeMessage = limitText(message, MAX_USER_QUESTION_CHARS);

    if (uniqueTargetDocumentIds.length === 0 || !safeMessage) {
      return res.status(400).json({
        answer: getMissingInputAnswer(responseLanguage),
      });
    }

    const placeholders = uniqueTargetDocumentIds.map(() => "?").join(",");

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
      WHERE documentId IN (${placeholders})
      `,
      uniqueTargetDocumentIds,
    );

    if (docRows.length === 0) {
      return res.json({
        answer: getMissingDocumentAnswer(responseLanguage),
        outOfScope: true,
      });
    }

    const vectorDocs = docRows.map((doc) => ({
      ...doc,
      qdrantDocumentId: doc.vectorDocumentId || doc.documentId,
    }));

    const docNameMap = new Map();

    for (const doc of vectorDocs) {
      docNameMap.set(doc.qdrantDocumentId, doc.fileName);
      docNameMap.set(doc.documentId, doc.fileName);
    }

    const recentHistory = await getRecentHistory(sessionId);
    const safeRecentHistory = limitText(recentHistory, MAX_HISTORY_CHARS);

    const searchMessage = isContinueQuestion(safeMessage)
      ? `${safeRecentHistory}\n${safeMessage}`
      : safeMessage;

    const embedSearchMessage = limitText(
      searchMessage,
      MAX_EMBED_QUERY_CHARS,
    );

    const keywords = getKeywords(searchMessage);
    const importantKeywords = getImportantKeywords(safeMessage);
    const requestedPages = extractRequestedPages(safeMessage);
    const quoteMode = isQuoteRequest(safeMessage);
    const quoteTargetName = quoteMode ? extractQuoteTargetName(safeMessage) : "";
    const vector = await embedText(embedSearchMessage);

    console.log("CHAT DOCUMENTS:", uniqueTargetDocumentIds);
    console.log(
      "QDRANT DOCUMENT IDS:",
      vectorDocs.map((doc) => doc.qdrantDocumentId),
    );
    console.log("KEYWORDS:", keywords);
    console.log("IMPORTANT KEYWORDS:", importantKeywords);
    console.log("REQUESTED PAGES:", requestedPages);
    console.log("QUOTE MODE:", quoteMode, quoteTargetName);
    console.log("RESPONSE LANGUAGE:", responseLanguage);

    const allVectorResults = [];
    const allChunks = [];

    for (const doc of vectorDocs) {
      const qdrantFilter = makeQdrantFilter(doc.qdrantDocumentId);

      const vectorResults = await qdrant.search(COLLECTION_NAME, {
        vector,
        limit: Math.max(8, Math.ceil(18 / vectorDocs.length)),
        with_payload: true,
        filter: qdrantFilter,
      });

      allVectorResults.push(
        ...vectorResults.map((item) => ({
          ...item,
          sourceDocumentId: doc.qdrantDocumentId,
        })),
      );

      const scrollResult = await qdrant.scroll(COLLECTION_NAME, {
        limit: 1000,
        with_payload: true,
        with_vector: false,
        filter: qdrantFilter,
      });

      allChunks.push(
        ...(scrollResult.points || []).map((point) => ({
          ...point,
          sourceDocumentId: doc.qdrantDocumentId,
        })),
      );
    }

    if (allChunks.length === 0) {
      return res.json({
        answer: noInfoAnswer,
        outOfScope: true,
        documentIds: uniqueTargetDocumentIds,
      });
    }

    const pageResults = requestedPages.length
      ? allChunks
          .map((point) => {
            const text = String(point.payload?.text || "");

            const hasPage = requestedPages.some((page) => {
              const pagePattern = new RegExp(
                `(?:\\[?PAGE\\s*${page}\\]?|trang\\s*${page}|page\\s*${page})`,
                "i",
              );

              return pagePattern.test(text);
            });

            return {
              id: point.id,
              payload: point.payload,
              sourceDocumentId: point.sourceDocumentId,
              keywordScore: hasPage ? 10 : 0,
              score: hasPage ? 10 : 0,
            };
          })
          .filter((item) => item.keywordScore > 0)
          .slice(0, 8)
      : [];

    const keywordResults = allChunks
      .map((point) => {
        const text = point.payload?.text || "";
        const score = keywordScore(text, keywords);
        const importantExactMatch = hasExactImportantKeywordMatch(
          text,
          importantKeywords,
        );

        return {
          id: point.id,
          payload: point.payload,
          sourceDocumentId: point.sourceDocumentId,
          keywordScore: importantExactMatch ? score + 5 : score,
          importantExactMatch,
          score: importantExactMatch ? score + 5 : score,
        };
      })
      .filter((item) => item.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, 10);

    const quoteFocusedResults =
      quoteMode && quoteTargetName
        ? buildQuoteFocusedChunks(allChunks, quoteTargetName)
        : [];

    const vectorResults = allVectorResults
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 18);

    const topVectorScore = vectorResults[0]?.score || 0;

    const hasImportantExactMatch = keywordResults.some(
      (item) => item.importantExactMatch,
    );

    const hasEnoughKeywordMatch =
      hasImportantExactMatch ||
      keywordResults.length >= 2 ||
      keywordResults.some((item) => item.keywordScore >= 2) ||
      pageResults.length > 0 ||
      quoteFocusedResults.length > 0;

    const hasStrongSemanticMatch = topVectorScore >= 0.35;

    console.log("ALL CHUNKS:", allChunks.length);
    console.log("KEYWORD RESULTS:", keywordResults.length);
    console.log("IMPORTANT EXACT MATCH:", hasImportantExactMatch);
    console.log("PAGE RESULTS:", pageResults.length);
    console.log("QUOTE RESULTS:", quoteFocusedResults.length);
    console.log("TOP VECTOR SCORE:", topVectorScore);

    if (quoteMode && quoteTargetName && quoteFocusedResults.length === 0) {
      return res.json({
        answer:
          responseLanguage === "en"
            ? `The document does not contain direct quotes from ${quoteTargetName}.`
            : `Tài liệu không có trích dẫn nguyên văn lời nói của ${quoteTargetName}.`,
        outOfScope: true,
        documentIds: uniqueTargetDocumentIds,
      });
    }

    if (!quoteMode && !hasEnoughKeywordMatch && !hasStrongSemanticMatch) {
      return res.json({
        answer: noInfoAnswer,
        outOfScope: true,
        score: topVectorScore,
        documentIds: uniqueTargetDocumentIds,
      });
    }

    const mergedMap = new Map();

    for (const item of pageResults) {
      mergedMap.set(String(item.id), item);
    }

    for (const item of quoteFocusedResults) {
      mergedMap.set(String(item.id), item);
    }

    for (const item of keywordResults) {
      mergedMap.set(String(item.id), item);
    }

    for (const item of vectorResults) {
      if (!mergedMap.has(String(item.id))) {
        mergedMap.set(String(item.id), item);
      }
    }

    let finalChunks = Array.from(mergedMap.values()).slice(
      0,
      quoteMode ? 18 : 12,
    );

    if (finalChunks.length === 0) {
      finalChunks = vectorResults.slice(0, quoteMode ? 18 : 12);
    }

    if (finalChunks.length === 0 && allChunks.length > 0) {
      finalChunks = allChunks.slice(0, quoteMode ? 18 : 12).map((point) => ({
        id: point.id,
        payload: point.payload,
        sourceDocumentId: point.sourceDocumentId,
        score: 0,
        keywordScore: 0,
      }));
    }

    const context = buildContextWithBudget(finalChunks, docNameMap);

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

    const selectedFileList = vectorDocs
      .map((doc, index) => `${index + 1}. ${doc.fileName}`)
      .join("\n");

    const quoteRule =
      quoteMode && quoteTargetName
        ? `
YÊU CẦU TRÍCH DẪN NGUYÊN VĂN:
- Người cần trích dẫn: ${quoteTargetName}
- Chỉ liệt kê các câu nói/trích dẫn được gắn trực tiếp với ${quoteTargetName}.
- Không được lấy các câu mô tả chung về công ty, sản phẩm, chiến lược, hoặc đoạn văn không phải lời nói của ${quoteTargetName}.
- Nếu một câu không được gắn rõ với ${quoteTargetName}, không được đưa vào danh sách.
- Giữ nguyên văn câu trích dẫn như trong tài liệu.
- Không tự sửa câu, không diễn giải lại.
`
        : "";

    const prompt = `
Bạn là chatbot hỏi đáp dựa trên tài liệu đã upload.

TÀI LIỆU ĐANG ĐƯỢC CHỌN:
${selectedFileList}

LỊCH SỬ GẦN ĐÂY:
${safeRecentHistory || "Không có."}

NHIỆM VỤ:
Trả lời QUESTION dựa trên CONTEXT TỪ TÀI LIỆU. Có thể tổng hợp nhiều file nếu câu hỏi liên quan nhiều file.

QUY TẮC BẮT BUỘC:
- Chỉ được dùng thông tin có trong CONTEXT TỪ TÀI LIỆU.
- Không được dùng kiến thức bên ngoài.
- Không được tự giải toán, viết code, viết công thức, hoặc trả lời kiến thức chung nếu CONTEXT không có.
- Nếu hỏi về trang, chỉ trả lời khi CONTEXT có marker PAGE/trang tương ứng.
- Nếu câu hỏi là "giải thích tiếp", "phần còn lại", hãy dựa vào LỊCH SỬ GẦN ĐÂY để hiểu đang tiếp nội dung nào, nhưng kiến thức vẫn phải lấy từ CONTEXT.
${quoteRule}
- APPROVED ANSWERS chỉ là câu trả lời trước đó user đánh dấu phù hợp để học cách trình bày. Nó không phải nguồn kiến thức mới.
- Nếu CONTEXT không có thông tin trực tiếp để trả lời QUESTION, chỉ trả lời đúng một câu:
"${noInfoAnswer}"
- ${answerLanguageRule}

APPROVED ANSWERS:
${approvedContext || "Không có."}

CONTEXT TỪ TÀI LIỆU:
${context}

QUESTION:
${safeMessage}

ANSWER:
`;

    const answer = await generateAnswer(prompt);

    res.json({
      answer: answer || noInfoAnswer,
      outOfScope: answer?.includes(noInfoAnswer) || false,
      documentId: uniqueTargetDocumentIds[0],
      documentIds: uniqueTargetDocumentIds,
      responseLanguage,
      evidence: finalChunks.map((item) => ({
        fileName:
          docNameMap.get(
            item.payload?.vectorDocumentId ||
              item.payload?.documentId ||
              item.sourceDocumentId,
          ) || item.payload?.fileName,
        documentId: item.payload?.documentId,
        vectorDocumentId: item.payload?.vectorDocumentId,
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