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

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getImportantKeywords(message) {
  const rawWords = String(message || "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const stopWords = new Set([
    // English
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

    // Vietnamese
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

      // Giữ keyword ngắn / acronym: AI, RAG, LLM, ORAN, API, GenAI
      if (/^[A-Z0-9]{2,}$/.test(word)) return true;

      return lower.length >= 3;
    })
    .map((word) => word.toLowerCase());
}

function hasExactImportantKeywordMatch(text, importantKeywords) {
  const originalText = String(text || "").toLowerCase().normalize("NFC");
  const noToneText = removeVietnameseTones(originalText).toLowerCase();

  return importantKeywords.some((keyword) => {
    const originalKeyword = String(keyword || "").toLowerCase().normalize("NFC");
    const noToneKeyword = removeVietnameseTones(originalKeyword).toLowerCase();

    const originalRegex = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(originalKeyword)}([^\\p{L}\\p{N}]|$)`,
      "iu",
    );

    const noToneRegex = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(noToneKeyword)}([^\\p{L}\\p{N}]|$)`,
      "iu",
    );

    return originalRegex.test(originalText) || noToneRegex.test(noToneText);
  });
}

function extractQuoteSearchKeywords(message) {
  const keywords = getImportantKeywords(message);

  const quoteStopWords = new Set([
    "trích",
    "dẫn",
    "trich",
    "dan",
    "nguyên",
    "văn",
    "nguyen",
    "van",
    "lời",
    "nói",
    "loi",
    "noi",
    "câu",
    "cau",
    "cái",
    "ấy",
    "đó",
    "kia",
    "quote",
    "quotes",
    "sentence",
    "sentences",
    "direct",
    "from",
    "by",
    "of",
  ]);

  return keywords.filter((keyword) => {
    const lower = keyword.toLowerCase();
    const noToneKeyword = removeVietnameseTones(lower).toLowerCase();

    return !quoteStopWords.has(lower) && !quoteStopWords.has(noToneKeyword);
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


function buildSourceExcerpt(finalChunks, docNameMap) {
  const parts = [];
  const usedFiles = new Set();

  for (let index = 0; index < finalChunks.length && parts.length < 3; index++) {
    const item = finalChunks[index];

    const sourceDocumentId =
      item.payload?.vectorDocumentId ||
      item.payload?.documentId ||
      item.sourceDocumentId;

    const sourceFile =
      docNameMap.get(sourceDocumentId) ||
      item.payload?.fileName ||
      "Unknown file";

    const rawText = String(item.payload?.text || "").trim();

    if (!rawText) continue;

    usedFiles.add(sourceFile);

    parts.push(
      `[Source ${parts.length + 1} - ${sourceFile}]\n${limitText(
        rawText,
        1400,
      )}`,
    );
  }

  return {
    sourceExcerpt: parts.join("\n\n---\n\n").slice(0, 5000),
    sourceDocumentName: Array.from(usedFiles).join(", "),
  };
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
    text.includes("quotes") ||
    text.includes("direct quote")
  );
}

function normalizeSentenceForDisplay(sentence = "") {
  return String(sentence || "")
    .replace(/\s+/g, " ")
    .replace(/^PAGE\s+\d+\s*/i, "")
    .replace(/^\[?PAGE\s+\d+\]?\s*/i, "")
    .trim();
}

function splitIntoSentences(text = "") {
  const normalized = String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const sentences =
    normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [];

  return sentences
    .map(normalizeSentenceForDisplay)
    .filter((sentence) => sentence.length > 0);
}

function buildQuoteFocusedChunks(allChunks, quoteKeywords) {
  if (!Array.isArray(quoteKeywords) || quoteKeywords.length === 0) return [];

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

      const hasQuoteKeyword = hasExactImportantKeywordMatch(
        text,
        quoteKeywords,
      );

      if (!hasQuoteKeyword) continue;

      const start = Math.max(0, i - 1);
      const end = Math.min(sorted.length - 1, i + 1);

      for (let j = start; j <= end; j++) {
        const item = sorted[j];

        selected.set(String(item.id), {
          id: item.id,
          payload: item.payload,
          sourceDocumentId:
            item.payload?.vectorDocumentId ||
            item.payload?.documentId ||
            item.sourceDocumentId,
          keywordScore: 30,
          score: 30,
          importantExactMatch: true,
        });
      }
    }
  }

  return Array.from(selected.values());
}

function extractDirectQuotesFromChunks(finalChunks, quoteKeywords, docNameMap) {
  if (!Array.isArray(quoteKeywords) || quoteKeywords.length === 0) return [];

  const quotes = [];
  const seen = new Set();

  for (const item of finalChunks) {
    const text = item.payload?.text || "";
    const sentences = splitIntoSentences(text);

    for (const sentence of sentences) {
      if (!hasExactImportantKeywordMatch(sentence, quoteKeywords)) continue;

      const cleanedSentence = normalizeSentenceForDisplay(sentence);

      if (cleanedSentence.length < 8) continue;

      const dedupeKey = cleanedSentence.toLowerCase();

      if (seen.has(dedupeKey)) continue;

      seen.add(dedupeKey);

      const sourceDocumentId =
        item.payload?.vectorDocumentId ||
        item.payload?.documentId ||
        item.sourceDocumentId;

      quotes.push({
        text: cleanedSentence,
        fileName:
          docNameMap.get(sourceDocumentId) ||
          item.payload?.fileName ||
          "Unknown file",
        source:
          item.payload?.chunkIndex !== undefined
            ? `SOURCE ${item.payload.chunkIndex + 1}`
            : "SOURCE",
      });

      if (quotes.length >= 5) return quotes;
    }
  }

  return quotes;
}

function formatDirectQuoteAnswer(quotes, responseLanguage) {
  if (!quotes || quotes.length === 0) return "";

  if (responseLanguage === "en") {
    return [
      "Direct quote found in the document:",
      "",
      ...quotes.map((quote, index) => {
        const prefix = quotes.length > 1 ? `${index + 1}. ` : "";
        return `${prefix}"${quote.text}"\nSource: ${quote.fileName}`;
      }),
    ].join("\n");
  }

  return [
    "Câu được trích dẫn trong tài liệu là:",
    "",
    ...quotes.map((quote, index) => {
      const prefix = quotes.length > 1 ? `${index + 1}. ` : "";
      return `${prefix}"${quote.text}"\nNguồn: ${quote.fileName}`;
    }),
  ].join("\n");
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
    const quoteMode = isQuoteRequest(safeMessage);
    const quoteSearchKeywords = quoteMode
      ? extractQuoteSearchKeywords(safeMessage)
      : [];
    const requestedPages = extractRequestedPages(safeMessage);
    const vector = await embedText(embedSearchMessage);

    console.log("CHAT DOCUMENTS:", uniqueTargetDocumentIds);
    console.log(
      "QDRANT DOCUMENT IDS:",
      vectorDocs.map((doc) => doc.qdrantDocumentId),
    );
    console.log("KEYWORDS:", keywords);
    console.log("IMPORTANT KEYWORDS:", importantKeywords);
    console.log("QUOTE MODE:", quoteMode);
    console.log("QUOTE KEYWORDS:", quoteSearchKeywords);
    console.log("REQUESTED PAGES:", requestedPages);
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

    const quoteFocusedResults = quoteMode
      ? buildQuoteFocusedChunks(
          allChunks,
          quoteSearchKeywords.length > 0
            ? quoteSearchKeywords
            : importantKeywords,
        )
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

    if (quoteMode && quoteFocusedResults.length === 0) {
      const keywordText =
        quoteSearchKeywords.length > 0
          ? quoteSearchKeywords.join(", ")
          : safeMessage;

      return res.json({
        answer:
          responseLanguage === "en"
            ? `The document does not contain a direct quote related to "${keywordText}".`
            : `Tài liệu không có câu trích dẫn nguyên văn liên quan đến "${keywordText}".`,
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

    const { sourceExcerpt, sourceDocumentName } = buildSourceExcerpt(
      finalChunks,
      docNameMap,
    );

    if (quoteMode) {
      const quoteKeywords =
        quoteSearchKeywords.length > 0
          ? quoteSearchKeywords
          : importantKeywords;

      const directQuotes = extractDirectQuotesFromChunks(
        finalChunks,
        quoteKeywords,
        docNameMap,
      );

      if (directQuotes.length > 0) {
        return res.json({
          answer: formatDirectQuoteAnswer(directQuotes, responseLanguage),
          outOfScope: false,
          documentId: uniqueTargetDocumentIds[0],
          documentIds: uniqueTargetDocumentIds,
          responseLanguage,
          sourceExcerpt,
          sourceDocumentName,
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
      }
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

    const quoteRule = quoteMode
      ? `
YÊU CẦU TRÍCH DẪN NGUYÊN VĂN:
- Từ khóa/cụm cần tìm: ${
          quoteSearchKeywords.length > 0
            ? quoteSearchKeywords.join(", ")
            : safeMessage
        }
- Hãy trích dẫn nguyên văn câu hoặc đoạn ngắn trong CONTEXT có chứa/tập trung vào từ khóa trên.
- Không hiểu các từ như GenAI, RAG, ORAN, LLM, AI là tên người.
- Không trả lời kiểu "lời nói của GenAI" hoặc "lời nói của RAG".
- Nếu thấy câu bắt đầu bằng từ khóa được hỏi, ưu tiên trích nguyên câu đó.
- Giữ nguyên văn tiếng Anh nếu tài liệu là tiếng Anh.
- Không diễn giải lại, không tự viết lại nội dung.
- Nếu đã trích được câu, không thêm câu "${noInfoAnswer}".
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
- Nếu có ít nhất một phần trong CONTEXT trả lời được QUESTION, hãy trả lời dựa trên phần đó.
- Nếu đang chọn nhiều file, không cần nói file nào không có thông tin.
- Không được thêm câu "${noInfoAnswer}" sau khi đã trả lời được nội dung chính.
- Chỉ khi toàn bộ CONTEXT không có bất kỳ thông tin nào liên quan đến QUESTION thì mới trả lời đúng một câu:
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

    let answer = await generateAnswer(prompt);

    if (answer && answer.includes(noInfoAnswer)) {
      const cleanedAnswer = answer
        .replace(noInfoAnswer, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (cleanedAnswer.length > 0) {
        answer = cleanedAnswer;
      }
    }

    const isOutOfScope = !answer || answer.trim() === noInfoAnswer;

    res.json({
      answer: answer || noInfoAnswer,
      outOfScope: isOutOfScope,
      documentId: uniqueTargetDocumentIds[0],
      documentIds: uniqueTargetDocumentIds,
      responseLanguage,
      sourceExcerpt,
      sourceDocumentName,
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