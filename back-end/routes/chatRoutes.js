import express from "express";

import pool from "../db.js";

import {
  qdrant,
  COLLECTION_NAME,
} from "../qdrant.js";

import { embedText } from "../huggingface.js";
import { generateAnswer } from "../groq.js";

const router = express.Router();

const MAX_USER_QUESTION_CHARS = 3000;
const MAX_EMBED_QUERY_CHARS = 2000;
const MAX_HISTORY_CHARS = 3000;
const MAX_CONTEXT_CHARS = 18000;
const MAX_SINGLE_CHUNK_CHARS = 2200;
const MAX_NORMAL_CHUNKS = 18;
const MAX_QUOTE_CHUNKS = 22;

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_YEAR_PATTERN =
  new RegExp(
    `\\b(${ENGLISH_MONTHS.join(
      "|",
    )})\\s+((?:19|20)\\d{2})\\b`,
    "i",
  );

const VI_MONTH_BY_ENGLISH = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/*
 * Từ khóa mở rộng Việt → Anh.
 *
 * Đây chỉ là từ khóa tìm kiếm, không phải
 * đáp án cứng. Câu trả lời vẫn phải lấy
 * hoàn toàn từ nội dung tài liệu.
 */
const BILINGUAL_EXPANSION_RULES = [
  {
    keys: [
      "xuat ban",
      "cong bo",
      "phat hanh",
      "thang va nam",
      "ngay thang",
    ],
    terms: [
      "published",
      "publication",
      "issued",
      "release date",
      "this publication",
      ...ENGLISH_MONTHS,
    ],
  },
  {
    keys: [
      "muc tieu",
      "muc dich",
      "cung cap tai nguyen",
    ],
    terms: [
      "goal",
      "purpose",
      "offer a resource",
      "organizations",
      "manage risks",
      "trustworthy",
      "responsible",
    ],
  },
  {
    keys: [
      "thiet ke",
      "phat trien",
      "trien khai",
      "su dung",
    ],
    terms: [
      "designing",
      "developing",
      "deploying",
      "using",
      "development",
      "deployment",
      "use",
    ],
  },
  {
    keys: [
      "dau ra",
      "du doan",
      "khuyen nghi",
      "quyet dinh",
      "moi truong thuc",
      "moi truong ao",
    ],
    terms: [
      "outputs",
      "predictions",
      "recommendations",
      "decisions",
      "real environments",
      "virtual environments",
    ],
  },
  {
    keys: [
      "dang tin cay",
      "dac tinh",
      "dac diem",
    ],
    terms: [
      "trustworthy",
      "characteristics",
      "valid and reliable",
      "safe",
      "secure and resilient",
      "accountable and transparent",
      "explainable and interpretable",
      "privacy-enhanced",
      "fair with harmful bias managed",
    ],
  },
  {
    keys: [
      "bon chuc nang",
      "ai rmf core",
      "core",
    ],
    terms: [
      "four functions",
      "GOVERN",
      "MAP",
      "MEASURE",
      "MANAGE",
      "Core is composed",
    ],
  },
  {
    keys: [
      "pham vi ap dung",
      "xuyen suot",
      "moi giai doan",
    ],
    terms: [
      "applies to all stages",
      "cross-cutting",
      "system-specific contexts",
      "specific stages",
      "AI lifecycle",
    ],
  },
  {
    keys: [
      "xac suat",
      "hau qua",
      "hai thanh phan",
      "phep do tong hop",
    ],
    terms: [
      "probability",
      "magnitude",
      "degree of consequences",
      "composite measure",
      "event occurring",
    ],
  },
  {
    keys: [
      "tich cuc",
      "tieu cuc",
      "co hoi",
      "de doa",
      "tac dong",
    ],
    terms: [
      "positive",
      "negative",
      "both",
      "opportunities",
      "threats",
      "impacts",
      "consequences",
    ],
  },
  {
    keys: [
      "khong the do luong",
      "do luong thich hop",
      "rui ro cao",
      "rui ro thap",
      "dong nghia",
    ],
    terms: [
      "inability to appropriately measure",
      "does not imply",
      "high or low risk",
      "risk measurement",
    ],
  },
  {
    keys: [
      "thieu dong thuan",
      "phuong phap do",
      "kiem chung",
    ],
    terms: [
      "lack of consensus",
      "robust and verifiable",
      "measurement methods",
      "risk and trustworthiness",
      "different AI use cases",
    ],
  },
  {
    keys: [
      "chap nhan rui ro",
      "muc chap nhan",
      "risk tolerance",
    ],
    terms: [
      "risk tolerance",
      "does not prescribe",
      "highly contextual",
      "application",
      "use-case specific",
    ],
  },
  {
    keys: [
      "khong the chap nhan",
      "tham hoa",
      "thiet hai nghiem trong",
      "dung phat trien",
      "dung trien khai",
    ],
    terms: [
      "unacceptable negative risk",
      "catastrophic risks",
      "severe harms",
      "development and deployment should cease",
      "safe manner",
      "until risks can be sufficiently managed",
    ],
  },
  {
    keys: [
      "uu tien ban dau",
      "du lieu nhay cam",
      "du lieu duoc bao ve",
      "thong tin nhan dang",
      "pii",
      "tac dong den con nguoi",
    ],
    terms: [
      "higher initial prioritization",
      "sensitive or protected data",
      "personally identifiable information",
      "direct or indirect impact on humans",
    ],
  },
  {
    keys: [
      "chi su dung ai rmf",
      "co che trach nhiem",
      "vai tro va trach nhiem",
      "van hoa",
      "dong luc",
      "cam ket lanh dao",
    ],
    terms: [
      "AI RMF alone",
      "accountability mechanisms",
      "roles and responsibilities",
      "culture",
      "incentive structures",
      "organizational commitment",
      "senior levels",
    ],
  },
  {
    keys: [
      "ai actor",
      "da dang",
      "kinh nghiem",
      "chuyen mon",
      "nen tang",
      "nhan khau hoc",
      "da nganh",
    ],
    terms: [
      "AI actors",
      "diversity of experience",
      "expertise",
      "backgrounds",
      "demographically diverse",
      "disciplinarily diverse teams",
    ],
  },
  {
    keys: [
      "tevv",
      "kiem thu",
      "danh gia",
      "xac minh",
      "xac thuc",
      "rui ro moi noi",
      "khac phuc",
    ],
    terms: [
      "TEVV",
      "performed regularly",
      "technical societal legal and ethical",
      "anticipating impacts",
      "tracking emergent risks",
      "mid-course remediation",
      "post-hoc risk management",
    ],
  },
  {
    keys: [
      "khong mong muon",
      "khong cong bang",
      "mo duc",
      "khong the dien giai",
      "mat can bang",
    ],
    terms: [
      "undesirable",
      "highly secure but unfair",
      "accurate but opaque and uninterpretable",
      "inaccurate but secure",
      "balancing tradeoffs",
    ],
  },
  {
    keys: [
      "do chinh xac",
      "tap kiem thu",
      "dai dien",
      "phuong phap kiem thu",
    ],
    terms: [
      "accuracy measurements",
      "test sets",
      "clearly defined",
      "realistic",
      "representative",
      "conditions of expected use",
      "test methodology",
      "documentation",
    ],
  },
  {
    keys: [
      "transparency",
      "explainability",
      "interpretability",
      "dieu gi da xay ra",
      "nhu the nao",
      "vi sao",
      "y nghia",
    ],
    terms: [
      "Transparency",
      "Explainability",
      "Interpretability",
      "what happened",
      "how a decision was made",
      "why a decision was made",
      "meaning or context",
    ],
  },
  {
    keys: [
      "thien lech",
      "bias",
      "nhan thuc con nguoi",
    ],
    terms: [
      "three major categories",
      "systemic",
      "computational and statistical",
      "human-cognitive",
      "AI bias",
    ],
  },
  {
    keys: [
      "checklist",
      "thu tu co dinh",
      "chuoi buoc",
    ],
    terms: [
      "do not constitute a checklist",
      "not necessarily an ordered set of steps",
      "actions",
    ],
  },
  {
    keys: [
      "sau khi",
      "bat dau voi",
      "tiep tuc",
      "tinh lap",
      "tham chieu cheo",
    ],
    terms: [
      "After instituting",
      "start with the MAP function",
      "continue to MEASURE or MANAGE",
      "iterative",
      "cross-referencing",
    ],
  },
  {
    keys: [
      "thiet lap boi canh",
      "dinh khung rui ro",
      "chuc nang map",
    ],
    terms: [
      "MAP function",
      "establishes the context",
      "frame risks",
      "related to an AI system",
    ],
  },
  {
    keys: [
      "dinh luong",
      "dinh tinh",
      "hon hop",
      "truoc trien khai",
      "thuong xuyen khi van hanh",
    ],
    terms: [
      "quantitative",
      "qualitative",
      "mixed-method",
      "analyze",
      "assess",
      "benchmark",
      "monitor",
      "tested before deployment",
      "regularly while in operation",
    ],
  },
  {
    keys: [
      "phan ung voi rui ro",
      "giam thieu",
      "chuyen giao",
      "tranh",
      "chap nhan",
    ],
    terms: [
      "risk response options",
      "mitigating",
      "transferring",
      "avoiding",
      "accepting",
    ],
  },
];

function removeVietnameseTones(
  value = "",
) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeSearchText(
  value = "",
) {
  return removeVietnameseTones(
    String(value || "")
      .toLowerCase(),
  )
    .replace(
      /[^\p{L}\p{N}\s.-]/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(
  value = "",
) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function uniqueStrings(values = []) {
  const seen = new Set();

  return values.filter((value) => {
    const normalized =
      normalizeSearchText(value);

    if (!normalized) return false;

    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);

    return true;
  });
}

function getKeywords(message) {
  return String(message || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(
      /[^\p{L}\p{N}\s.-]/gu,
      " ",
    )
    .split(/\s+/)
    .map((word) =>
      word.trim(),
    )
    .filter(
      (word) =>
        word.length >= 2,
    );
}

function getImportantKeywords(
  message,
) {
  const rawWords = String(
    message || "",
  )
    .normalize("NFC")
    .replace(
      /[^\p{L}\p{N}\s.-]/gu,
      " ",
    )
    .split(/\s+/)
    .map((word) =>
      word.trim(),
    )
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
    "list",

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
    "được",
    "theo",
  ]);

  return rawWords
    .filter((word) => {
      const lower =
        word.toLowerCase();

      if (
        stopWords.has(lower)
      ) {
        return false;
      }

      if (
        /^[A-Z0-9.-]{2,}$/.test(
          word,
        )
      ) {
        return true;
      }

      return lower.length >= 3;
    })
    .map((word) =>
      word.toLowerCase(),
    );
}

function isQuoteRequest(message) {
  const text =
    normalizeSearchText(message);

  return (
    text.includes("trich dan") ||
    text.includes("nguyen van") ||
    text.includes("loi noi") ||
    text.includes("cau noi") ||
    text.includes("phat bieu") ||
    text.includes("quote") ||
    text.includes("direct quote")
  );
}

function isContinueQuestion(message) {
  const text =
    normalizeSearchText(message);

  return (
    text.includes("tiep") ||
    text.includes("con lai") ||
    text.includes("continue") ||
    text.includes("phan sau") ||
    text.includes("phan con")
  );
}

function buildQuestionProfile(
  message,
) {
  const normalized =
    normalizeSearchText(message);

  const expansionTerms = [];

  for (
    const rule of
    BILINGUAL_EXPANSION_RULES
  ) {
    const matched =
      rule.keys.some((key) =>
        normalized.includes(key),
      );

    if (matched) {
      expansionTerms.push(
        ...rule.terms,
      );
    }
  }

  const dateIntent =
    /\b(ngay|thang|nam|date|month|year|when)\b/.test(
      normalized,
    ) ||
    /(xuat ban|cong bo|phat hanh|publication|published|issued)/.test(
      normalized,
    );

  const publicationDateIntent =
    dateIntent &&
    /(xuat ban|cong bo|phat hanh|publication|published|issued|release)/.test(
      normalized,
    );

  const listIntent =
    /(liet ke|danh sach|day du|bao gom|nhung gi|cac loai|cac nhom|bon chuc nang|ba nhom|ba loai|hai truong hop|bon lua chon)/.test(
      normalized,
    );

  const comparisonIntent =
    /(so sanh|khac nhau|khac .* nhu the nao|lan luot|phan biet|versus|difference|compare)/.test(
      normalized,
    );

  const negativeIntent =
    /(khong|co .* khong|dong nghia|chi .* co|khong the|does not|not imply|is not|cannot)/.test(
      normalized,
    );

  const processIntent =
    /(khi|sau khi|truoc khi|thuong xuyen|trong khi|cho den khi|quy trinh|tiep tuc|bat dau|xuyen suot)/.test(
      normalized,
    );

  const countIntent =
    /(hai|ba|bon|nam|sau|bay|tam|chin|muoi|\d+)\s+(loai|nhom|chuc nang|thanh phan|truong hop|lua chon|dac tinh)/.test(
      normalized,
    );

  const multiPartIntent =
    /\bva\b/.test(normalized) ||
    /\bhoac\b/.test(
      normalized,
    ) ||
    /nhung .* nao .* va/.test(
      normalized,
    );

  return {
    normalized,
    expansionTerms:
      uniqueStrings(
        expansionTerms,
      ),
    dateIntent,
    publicationDateIntent,
    listIntent,
    comparisonIntent,
    negativeIntent,
    processIntent,
    countIntent,
    multiPartIntent,
    quoteMode:
      isQuoteRequest(message),
  };
}

function expandedKeywordScore(
  text,
  terms,
) {
  const normalizedText =
    normalizeSearchText(text);

  let score = 0;

  for (const term of terms) {
    const normalizedTerm =
      normalizeSearchText(term);

    if (!normalizedTerm) {
      continue;
    }

    if (
      normalizedTerm.includes(
        " ",
      )
    ) {
      if (
        normalizedText.includes(
          normalizedTerm,
        )
      ) {
        score += 5;
      }

      continue;
    }

    const exactPattern =
      new RegExp(
        `(^|[^\\p{L}\\p{N}])${escapeRegExp(
          normalizedTerm,
        )}([^\\p{L}\\p{N}]|$)`,
        "iu",
      );

    if (
      exactPattern.test(
        normalizedText,
      )
    ) {
      score += 2;
    } else if (
      normalizedText.includes(
        normalizedTerm,
      )
    ) {
      score += 1;
    }
  }

  return score;
}

function hasExactImportantKeywordMatch(
  text,
  importantKeywords,
) {
  if (
    !Array.isArray(
      importantKeywords,
    ) ||
    importantKeywords.length === 0
  ) {
    return false;
  }

  const normalizedText =
    normalizeSearchText(text);

  return importantKeywords.some(
    (keyword) => {
      const normalizedKeyword =
        normalizeSearchText(
          keyword,
        );

      if (!normalizedKeyword) {
        return false;
      }

      if (
        normalizedKeyword.includes(
          " ",
        )
      ) {
        return normalizedText.includes(
          normalizedKeyword,
        );
      }

      const regex = new RegExp(
        `(^|[^\\p{L}\\p{N}])${escapeRegExp(
          normalizedKeyword,
        )}([^\\p{L}\\p{N}]|$)`,
        "iu",
      );

      return regex.test(
        normalizedText,
      );
    },
  );
}

function extractQuoteSearchKeywords(
  message,
) {
  const keywords =
    getImportantKeywords(message);

  const quoteStopWords =
    new Set([
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
      "quote",
      "quotes",
      "sentence",
      "sentences",
      "direct",
      "from",
      "by",
      "of",
    ]);

  return keywords.filter(
    (keyword) => {
      const lower =
        keyword.toLowerCase();

      const noTone =
        normalizeSearchText(
          lower,
        );

      return (
        !quoteStopWords.has(
          lower,
        ) &&
        !quoteStopWords.has(
          noTone,
        )
      );
    },
  );
}

function getNoInfoAnswer(
  responseLanguage,
) {
  return responseLanguage === "en"
    ? "The document does not contain this information."
    : "Tài liệu không có thông tin này.";
}

function getMissingDocumentAnswer(
  responseLanguage,
) {
  return responseLanguage === "en"
    ? "Document not found."
    : "Không tìm thấy tài liệu này.";
}

function getMissingInputAnswer(
  responseLanguage,
) {
  return responseLanguage === "en"
    ? "Missing documentId or message."
    : "Thiếu documentId hoặc message.";
}

function limitText(
  text = "",
  maxChars = 1000,
) {
  const value = String(
    text || "",
  ).trim();

  if (
    value.length <= maxChars
  ) {
    return value;
  }

  return `${value.slice(
    0,
    maxChars,
  )}\n...[Nội dung đã được rút gọn do quá dài]`;
}

function buildContextWithBudget(
  finalChunks,
  docNameMap,
) {
  let total = 0;
  const parts = [];

  for (
    let index = 0;
    index <
    finalChunks.length;
    index += 1
  ) {
    const item =
      finalChunks[index];

    const sourceDocumentId =
      item.payload
        ?.vectorDocumentId ||
      item.payload?.documentId ||
      item.sourceDocumentId;

    const sourceFile =
      docNameMap.get(
        sourceDocumentId,
      ) ||
      item.payload?.fileName ||
      "Unknown file";

    const chunkText =
      limitText(
        item.payload?.text ||
          "",
        MAX_SINGLE_CHUNK_CHARS,
      );

    const block = `SOURCE ${index + 1}
FILE: ${sourceFile}
CHUNK_INDEX: ${item.payload?.chunkIndex ?? "unknown"}
${chunkText}`;

    if (
      total + block.length >
      MAX_CONTEXT_CHARS
    ) {
      break;
    }

    parts.push(block);
    total += block.length;
  }

  return parts.join(
    "\n\n---\n\n",
  );
}

function buildSourceExcerpt(
  finalChunks,
  docNameMap,
) {
  const parts = [];
  const usedFiles = new Set();

  for (
    let index = 0;
    index <
      finalChunks.length &&
    parts.length < 4;
    index += 1
  ) {
    const item =
      finalChunks[index];

    const sourceDocumentId =
      item.payload
        ?.vectorDocumentId ||
      item.payload?.documentId ||
      item.sourceDocumentId;

    const sourceFile =
      docNameMap.get(
        sourceDocumentId,
      ) ||
      item.payload?.fileName ||
      "Unknown file";

    const rawText = String(
      item.payload?.text || "",
    ).trim();

    if (!rawText) continue;

    usedFiles.add(sourceFile);

    parts.push(
      `[Source ${parts.length + 1} - ${sourceFile}]\n${limitText(
        rawText,
        1600,
      )}`,
    );
  }

  return {
    sourceExcerpt:
      parts
        .join(
          "\n\n---\n\n",
        )
        .slice(0, 6500),

    sourceDocumentName:
      Array.from(
        usedFiles,
      ).join(", "),
  };
}

function extractRequestedPages(
  message,
) {
  const text = String(
    message || "",
  ).toLowerCase();

  const pages = [];

  const regex =
    /(?:trang|page)\s*(\d+)/gi;

  let match;

  while (
    (match =
      regex.exec(text)) !== null
  ) {
    const page =
      Number(match[1]);

    if (
      !Number.isNaN(page)
    ) {
      pages.push(page);
    }
  }

  return [
    ...new Set(pages),
  ];
}

function normalizeSentenceForDisplay(
  sentence = "",
) {
  return String(sentence || "")
    .replace(/\s+/g, " ")
    .replace(
      /^\[?PAGE\s+\d+\]?\s*/i,
      "",
    )
    .replace(
      /^\[FRONT MATTER\]\s*/i,
      "",
    )
    .trim();
}

function splitIntoSentences(
  text = "",
) {
  const normalized = String(
    text || "",
  )
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  return (
    normalized.match(
      /[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g,
    ) || []
  )
    .map(
      normalizeSentenceForDisplay,
    )
    .filter(
      (sentence) =>
        sentence.length > 0,
    );
}

function buildQuoteFocusedChunks(
  allChunks,
  quoteKeywords,
) {
  if (
    !Array.isArray(
      quoteKeywords,
    ) ||
    quoteKeywords.length === 0
  ) {
    return [];
  }

  const grouped = new Map();

  for (const point of allChunks) {
    const sourceDocumentId =
      point.payload
        ?.vectorDocumentId ||
      point.payload?.documentId ||
      point.sourceDocumentId ||
      "unknown";

    if (
      !grouped.has(
        sourceDocumentId,
      )
    ) {
      grouped.set(
        sourceDocumentId,
        [],
      );
    }

    grouped
      .get(sourceDocumentId)
      .push(point);
  }

  const selected = new Map();

  for (const chunks of grouped.values()) {
    const sorted = [
      ...chunks,
    ].sort((first, second) => {
      const firstIndex =
        Number(
          first.payload
            ?.chunkIndex || 0,
        );

      const secondIndex =
        Number(
          second.payload
            ?.chunkIndex || 0,
        );

      return (
        firstIndex -
        secondIndex
      );
    });

    for (
      let index = 0;
      index < sorted.length;
      index += 1
    ) {
      const text =
        sorted[index]
          .payload?.text || "";

      if (
        !hasExactImportantKeywordMatch(
          text,
          quoteKeywords,
        )
      ) {
        continue;
      }

      const start = Math.max(
        0,
        index - 1,
      );

      const end = Math.min(
        sorted.length - 1,
        index + 1,
      );

      for (
        let adjacent = start;
        adjacent <= end;
        adjacent += 1
      ) {
        const item =
          sorted[adjacent];

        selected.set(
          String(item.id),
          {
            id: item.id,
            payload:
              item.payload,
            sourceDocumentId:
              item.payload
                ?.vectorDocumentId ||
              item.payload
                ?.documentId ||
              item.sourceDocumentId,

            keywordScore: 35,
            score: 35,
            importantExactMatch:
              true,
          },
        );
      }
    }
  }

  return Array.from(
    selected.values(),
  );
}

function buildFocusedChunks(
  allChunks,
  profile,
  searchTerms,
) {
  return allChunks
    .map((point) => {
      const text = String(
        point.payload?.text || "",
      );

      const normalizedText =
        normalizeSearchText(text);

      const chunkIndex =
        Number(
          point.payload
            ?.chunkIndex || 0,
        );

      let score =
        expandedKeywordScore(
          text,
          searchTerms,
        );

      if (profile.dateIntent) {
        if (
          MONTH_YEAR_PATTERN.test(
            text,
          )
        ) {
          score += 20;
        }

        if (
          /this publication|publication|published|issued|release date|doi\.org/i.test(
            text,
          )
        ) {
          score += 10;
        }

        if (chunkIndex <= 4) {
          score += 4;
        }

        if (
          /\[FRONT MATTER\]/i.test(
            text,
          )
        ) {
          score += 8;
        }
      }

      if (profile.listIntent) {
        if (
          /include:|includes:|composed of|following|categories|characteristics|options can include/i.test(
            text,
          )
        ) {
          score += 6;
        }

        if (
          /[•●▪]\s|\b1\.|\b2\.|\b3\./.test(
            text,
          )
        ) {
          score += 3;
        }
      }

      if (
        profile.comparisonIntent &&
        /\bwhile\b|\bwhereas\b|\bdistinct\b|\bdifferent\b|\bcompared\b|\bbut\b|\brather than\b/i.test(
          text,
        )
      ) {
        score += 6;
      }

      if (
        profile.negativeIntent &&
        /\bdoes not\b|\bdo not\b|\bnot\b|\bno\b|\bwithout\b|\bcannot\b|\bshould cease\b|\buntil\b/i.test(
          text,
        )
      ) {
        score += 6;
      }

      if (
        profile.processIntent &&
        /\bbefore\b|\bafter\b|\bregularly\b|\bwhile in operation\b|\bthroughout\b|\biterative\b|\bcross-referencing\b|\bcontinue\b|\buntil\b/i.test(
          text,
        )
      ) {
        score += 5;
      }

      if (
        profile.countIntent &&
        /\b(?:two|three|four|five|six|seven|eight|nine|ten)\b|composed of|identified .* categories|options can include/i.test(
          normalizedText,
        )
      ) {
        score += 4;
      }

      return {
        id: point.id,
        payload: point.payload,
        sourceDocumentId:
          point.sourceDocumentId,
        keywordScore: score,
        score,
        focusedMatch: true,
      };
    })
    .filter(
      (item) =>
        item.keywordScore >= 4,
    )
    .sort(
      (first, second) =>
        second.keywordScore -
        first.keywordScore,
    )
    .slice(0, 16);
}

function extractDirectQuotesFromChunks(
  finalChunks,
  quoteKeywords,
  docNameMap,
) {
  if (
    !Array.isArray(
      quoteKeywords,
    ) ||
    quoteKeywords.length === 0
  ) {
    return [];
  }

  const quotes = [];
  const seen = new Set();

  for (const item of finalChunks) {
    const text =
      item.payload?.text || "";

    const sentences =
      splitIntoSentences(text);

    for (const sentence of sentences) {
      if (
        !hasExactImportantKeywordMatch(
          sentence,
          quoteKeywords,
        )
      ) {
        continue;
      }

      const cleanedSentence =
        normalizeSentenceForDisplay(
          sentence,
        );

      if (
        cleanedSentence.length <
        8
      ) {
        continue;
      }

      const dedupeKey =
        normalizeSearchText(
          cleanedSentence,
        );

      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);

      const sourceDocumentId =
        item.payload
          ?.vectorDocumentId ||
        item.payload
          ?.documentId ||
        item.sourceDocumentId;

      quotes.push({
        text:
          cleanedSentence,

        fileName:
          docNameMap.get(
            sourceDocumentId,
          ) ||
          item.payload
            ?.fileName ||
          "Unknown file",
      });

      if (
        quotes.length >= 5
      ) {
        return quotes;
      }
    }
  }

  return quotes;
}

function formatDirectQuoteAnswer(
  quotes,
  responseLanguage,
) {
  if (!quotes.length) return "";

  if (
    responseLanguage === "en"
  ) {
    return [
      "Direct quote from the file:",
      "",
      ...quotes.map(
        (quote, index) =>
          `${
            quotes.length > 1
              ? `${index + 1}. `
              : ""
          }“${quote.text}”\nSource: ${quote.fileName}`,
      ),
    ].join("\n");
  }

  return [
    "Trích dẫn nguyên văn từ file:",
    "",
    ...quotes.map(
      (quote, index) =>
        `${
          quotes.length > 1
            ? `${index + 1}. `
            : ""
        }“${quote.text}”\nNguồn: ${quote.fileName}`,
    ),
  ].join("\n");
}

function getBestEvidenceQuote(
  finalChunks,
  searchTerms,
) {
  let best = null;

  for (const item of finalChunks) {
    const rawText = String(
      item.payload?.text || "",
    );

    const candidates = [
      ...rawText
        .split("\n")
        .map((line) =>
          normalizeSentenceForDisplay(
            line,
          ),
        ),

      ...splitIntoSentences(
        rawText,
      ),
    ].filter(
      (candidate) =>
        candidate.length >= 8 &&
        candidate.length <= 1400,
    );

    for (const candidate of candidates) {
      const score =
        expandedKeywordScore(
          candidate,
          searchTerms,
        );

      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          candidate.length >
            best.text.length)
      ) {
        best = {
          text: candidate,
          score,
        };
      }
    }
  }

  return best?.text || "";
}

function extractPublicationDate(
  finalChunks,
) {
  for (const item of finalChunks) {
    const text = String(
      item.payload?.text || "",
    );

    const match =
      text.match(
        MONTH_YEAR_PATTERN,
      );

    if (!match) continue;

    return {
      exact: match[0],
      month:
        VI_MONTH_BY_ENGLISH[
          match[1].toLowerCase()
        ],
      year: Number(match[2]),
    };
  }

  return null;
}

function buildPublicationDateAnswer(
  publicationDate,
  responseLanguage,
) {
  if (
    responseLanguage === "en"
  ) {
    return `Answer: ${publicationDate.exact}.

Direct quote from the file:
“${publicationDate.exact}”`;
  }

  return `Đáp án: Tháng ${publicationDate.month} năm ${publicationDate.year}.

Trích dẫn nguyên văn từ file:
“${publicationDate.exact}”`;
}

function ensureAnswerFormat({
  answer,
  responseLanguage,
  noInfoAnswer,
  context,
  fallbackQuote,
}) {
  let normalizedAnswer = String(
    answer || "",
  ).trim();

  if (
    !normalizedAnswer ||
    normalizedAnswer ===
      noInfoAnswer
  ) {
    return noInfoAnswer;
  }

  const answerLabel =
    responseLanguage === "en"
      ? "Answer:"
      : "Đáp án:";

  const quoteLabel =
    responseLanguage === "en"
      ? "Direct quote from the file:"
      : "Trích dẫn nguyên văn từ file:";

  if (
    !normalizedAnswer
      .toLowerCase()
      .startsWith(
        answerLabel.toLowerCase(),
      )
  ) {
    normalizedAnswer =
      `${answerLabel} ${normalizedAnswer}`;
  }

  const normalizedContext =
    normalizeSearchText(context);

  const quoteMatches = [
    ...normalizedAnswer.matchAll(
      /[“"]([^”"]{8,})[”"]/g,
    ),
  ];

  const hasGroundedQuote =
    quoteMatches.some(
      (match) =>
        normalizedContext.includes(
          normalizeSearchText(
            match[1],
          ),
        ),
    );

  const quoteLabelIndex =
    normalizedAnswer
      .toLowerCase()
      .indexOf(
        quoteLabel.toLowerCase(),
      );

  if (
    quoteLabelIndex >= 0 &&
    !hasGroundedQuote
  ) {
    normalizedAnswer =
      normalizedAnswer
        .slice(
          0,
          quoteLabelIndex,
        )
        .trim();
  }

  if (
    !hasGroundedQuote &&
    fallbackQuote
  ) {
    normalizedAnswer +=
      `\n\n${quoteLabel}\n“${fallbackQuote}”`;
  }

  // ===== FIX CONTRADICTION BETWEEN "Đáp án: Có" AND NEGATIVE CONSTRAINTS LIKE "is not allowed" / "không được" =====
  const textToCheck = `${normalizedAnswer} ${context || ""} ${fallbackQuote || ""}`;

  const hasNegativeInQuote =
    /(is not allowed|not allowed|is not permitted|not permitted|forbidden|prohibited|does not allow|cannot|không được|không cho phép|không được phép)/i.test(
      textToCheck,
    );

  if (hasNegativeInQuote) {
    if (/^Đáp án:\s*Có/i.test(normalizedAnswer)) {
      normalizedAnswer = normalizedAnswer.replace(
        /^Đáp án:\s*Có/i,
        "Đáp án: Không",
      );
    } else if (/^Answer:\s*Yes/i.test(normalizedAnswer)) {
      normalizedAnswer = normalizedAnswer.replace(
        /^Answer:\s*Yes/i,
        "Answer: No",
      );
    }
  }

  return normalizedAnswer;
}

function buildQuestionTypeRules(
  profile,
) {
  const rules = [];

  if (profile.dateIntent) {
    rules.push(
      "- Đây là câu hỏi ngày/tháng/năm: kiểm tra kỹ phần FRONT MATTER, trang tiêu đề, DOI, thông tin phát hành và các chunk đầu tài liệu.",
      "- Có thể dịch “January 2023” thành “Tháng 1 năm 2023”, nhưng phần trích dẫn phải giữ nguyên tiếng Anh.",
    );
  }

  if (profile.listIntent) {
    rules.push(
      "- Đây là câu hỏi danh sách: phải liệt kê đầy đủ mọi mục được nêu trong đoạn nguồn; không tự thêm mục.",
    );
  }

  if (profile.countIntent) {
    rules.push(
      "- Nếu câu hỏi nêu số lượng như hai, ba hoặc bốn, câu trả lời phải đủ đúng số lượng đó khi CONTEXT cung cấp.",
    );
  }

  if (profile.comparisonIntent) {
    rules.push(
      "- Đây là câu hỏi so sánh: phải nêu rõ từng đối tượng khác nhau ở điểm nào và giữ đúng thứ tự được hỏi.",
    );
  }

  if (profile.negativeIntent) {
    rules.push(
      "- Đây là câu hỏi có phủ định hoặc Có/Không: phải giữ chính xác các từ như “không”, “không đồng nghĩa”, “không quy định”, “không nhất thiết”.",
    );
  }

  if (profile.processIntent) {
    rules.push(
      "- Đây là câu hỏi quy trình hoặc điều kiện: phải giữ đủ các mốc trước, sau, trong khi, thường xuyên, cho đến khi và điều kiện đi kèm.",
    );
  }

  if (profile.multiPartIntent) {
    rules.push(
      "- Câu hỏi có nhiều vế: phải trả lời đầy đủ từng vế, không bỏ sót phần sau chữ “và” hoặc “hoặc”.",
    );
  }

  return rules.join("\n");
}

function makeQdrantFilter(
  documentId,
) {
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

async function getRecentHistory(
  sessionId,
  currentQuestion = "",
) {
  if (!sessionId) return "";

  const [historyRows] =
    await pool.query(
      `
      SELECT sender, message
      FROM ChatMessages
      WHERE sessionId = ?
      ORDER BY createdAt DESC
      LIMIT 10
      `,
      [sessionId],
    );

  const normCurrent = normalizeSearchText(currentQuestion);
  const reversed = historyRows.reverse();
  const filteredRows = [];

  for (let i = 0; i < reversed.length; i++) {
    const item = reversed[i];
    if (
      item.sender === "user" &&
      normCurrent &&
      normalizeSearchText(item.message) === normCurrent
    ) {
      // Skip this previous identical question turn AND its assistant response
      if (
        i + 1 < reversed.length &&
        (reversed[i + 1].sender === "assistant" ||
          reversed[i + 1].sender === "bot")
      ) {
        i++;
      }
      continue;
    }
    filteredRows.push(item);
  }

  return filteredRows
    .map(
      (item) =>
        `${String(
          item.sender,
        ).toUpperCase()}: ${item.message}`,
    )
    .join("\n");
}

router.post(
  "/",
  async (req, res) => {
    try {
      const {
        documentId,
        documentIds,
        sessionId,
        message,
        approvedAnswers = [],
        responseLanguage = "vi",
      } = req.body;

      const targetDocumentIds =
        Array.isArray(
          documentIds,
        )
          ? documentIds.filter(
              Boolean,
            )
          : documentId
            ? [documentId]
            : [];

      const uniqueTargetDocumentIds =
        [
          ...new Set(
            targetDocumentIds.map(
              String,
            ),
          ),
        ];

      const noInfoAnswer =
        getNoInfoAnswer(
          responseLanguage,
        );

      const safeMessage =
        limitText(
          message,
          MAX_USER_QUESTION_CHARS,
        );

      if (
        uniqueTargetDocumentIds
          .length === 0 ||
        !safeMessage
      ) {
        return res
          .status(400)
          .json({
            answer:
              getMissingInputAnswer(
                responseLanguage,
              ),
          });
      }

      const placeholders =
        uniqueTargetDocumentIds
          .map(() => "?")
          .join(",");

      const [docRows] =
        await pool.query(
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

      if (
        docRows.length === 0
      ) {
        return res.json({
          answer:
            getMissingDocumentAnswer(
              responseLanguage,
            ),
          outOfScope: true,
        });
      }

      const vectorDocs =
        docRows.map((doc) => ({
          ...doc,

          qdrantDocumentId:
            doc.vectorDocumentId ||
            doc.documentId,
        }));

      const docNameMap =
        new Map();

      for (const doc of vectorDocs) {
        docNameMap.set(
          doc.qdrantDocumentId,
          doc.fileName,
        );

        docNameMap.set(
          doc.documentId,
          doc.fileName,
        );
      }

      const recentHistory =
        await getRecentHistory(
          sessionId,
          safeMessage,
        );

      const safeRecentHistory =
        limitText(
          recentHistory,
          MAX_HISTORY_CHARS,
        );

      const searchMessage =
        isContinueQuestion(
          safeMessage,
        )
          ? `${safeRecentHistory}\n${safeMessage}`
          : safeMessage;

      const profile =
        buildQuestionProfile(
          searchMessage,
        );

      const rawKeywords =
        getKeywords(
          searchMessage,
        );

      const importantKeywords =
        getImportantKeywords(
          safeMessage,
        );

      const searchTerms =
        uniqueStrings([
          ...rawKeywords,
          ...importantKeywords,
          ...profile.expansionTerms,
        ]);

      const quoteSearchKeywords =
        profile.quoteMode
          ? extractQuoteSearchKeywords(
              safeMessage,
            )
          : [];

      const requestedPages =
        extractRequestedPages(
          safeMessage,
        );

      const expandedEmbedQuery =
        [
          searchMessage,
          profile.expansionTerms
            .length
            ? `English document concepts: ${profile.expansionTerms.join(
                ", ",
              )}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

      const embedSearchMessage =
        limitText(
          expandedEmbedQuery,
          MAX_EMBED_QUERY_CHARS,
        );

      const vector =
        await embedText(
          embedSearchMessage,
        );

      const allVectorResults =
        [];

      const allChunks = [];

      for (const doc of vectorDocs) {
        const qdrantFilter =
          makeQdrantFilter(
            doc.qdrantDocumentId,
          );

        const vectorResults =
          await qdrant.search(
            COLLECTION_NAME,
            {
              vector,

              limit: Math.max(
                12,
                Math.ceil(
                  28 /
                    vectorDocs.length,
                ),
              ),

              with_payload: true,
              filter: qdrantFilter,
            },
          );

        allVectorResults.push(
          ...vectorResults.map(
            (item) => ({
              ...item,

              sourceDocumentId:
                doc.qdrantDocumentId,
            }),
          ),
        );

        const scrollResult =
          await qdrant.scroll(
            COLLECTION_NAME,
            {
              limit: 1000,
              with_payload: true,
              with_vector: false,
              filter: qdrantFilter,
            },
          );

        allChunks.push(
          ...(
            scrollResult.points ||
            []
          ).map((point) => ({
            ...point,

            sourceDocumentId:
              doc.qdrantDocumentId,
          })),
        );
      }

      if (
        allChunks.length === 0
      ) {
        return res.json({
          answer: noInfoAnswer,
          outOfScope: true,
          documentIds:
            uniqueTargetDocumentIds,
        });
      }

      const pageResults =
        requestedPages.length
          ? allChunks
              .map((point) => {
                const text =
                  String(
                    point.payload
                      ?.text || "",
                  );

                const hasPage =
                  requestedPages.some(
                    (page) => {
                      const pattern =
                        new RegExp(
                          `(?:\\[?PAGE\\s*${page}\\]?|trang\\s*${page}|page\\s*${page})`,
                          "i",
                        );

                      return pattern.test(
                        text,
                      );
                    },
                  );

                return {
                  id: point.id,
                  payload:
                    point.payload,
                  sourceDocumentId:
                    point.sourceDocumentId,
                  keywordScore:
                    hasPage
                      ? 30
                      : 0,
                  score:
                    hasPage
                      ? 30
                      : 0,
                };
              })
              .filter(
                (item) =>
                  item.keywordScore >
                  0,
              )
              .slice(0, 10)
          : [];

      const keywordResults =
        allChunks
          .map((point) => {
            const text =
              point.payload
                ?.text || "";

            const lexicalScore =
              expandedKeywordScore(
                text,
                searchTerms,
              );

            const importantExactMatch =
              hasExactImportantKeywordMatch(
                text,
                [
                  ...importantKeywords,
                  ...profile.expansionTerms,
                ],
              );

            const score =
              lexicalScore +
              (importantExactMatch
                ? 8
                : 0);

            return {
              id: point.id,
              payload:
                point.payload,
              sourceDocumentId:
                point.sourceDocumentId,
              keywordScore: score,
              importantExactMatch,
              score,
            };
          })
          .filter(
            (item) =>
              item.keywordScore >
              0,
          )
          .sort(
            (first, second) =>
              second.keywordScore -
              first.keywordScore,
          )
          .slice(0, 16);

      const focusedResults =
        buildFocusedChunks(
          allChunks,
          profile,
          searchTerms,
        );

      const quoteFocusedResults =
        profile.quoteMode
          ? buildQuoteFocusedChunks(
              allChunks,
              quoteSearchKeywords
                .length
                ? quoteSearchKeywords
                : [
                    ...importantKeywords,
                    ...profile.expansionTerms,
                  ],
            )
          : [];

      const vectorResults =
        allVectorResults
          .sort(
            (first, second) =>
              (second.score ||
                0) -
              (first.score ||
                0),
          )
          .slice(0, 24);

      const topVectorScore =
        vectorResults[0]
          ?.score || 0;

      const hasImportantExactMatch =
        keywordResults.some(
          (item) =>
            item
              .importantExactMatch,
        );

      const hasEnoughKeywordMatch =
        hasImportantExactMatch ||
        keywordResults.length >=
          2 ||
        keywordResults.some(
          (item) =>
            item.keywordScore >=
            4,
        ) ||
        pageResults.length > 0 ||
        focusedResults.length >
          0 ||
        quoteFocusedResults
          .length > 0;

      const semanticThreshold =
        profile.expansionTerms
          .length > 0
          ? 0.25
          : 0.32;

      const hasStrongSemanticMatch =
        topVectorScore >=
        semanticThreshold;

      if (
        profile.quoteMode &&
        quoteFocusedResults
          .length === 0
      ) {
        const keywordText =
          quoteSearchKeywords
            .length
            ? quoteSearchKeywords.join(
                ", ",
              )
            : safeMessage;

        return res.json({
          answer:
            responseLanguage ===
            "en"
              ? `The document does not contain a direct quote related to "${keywordText}".`
              : `Tài liệu không có câu trích dẫn nguyên văn liên quan đến "${keywordText}".`,

          outOfScope: true,

          documentIds:
            uniqueTargetDocumentIds,
        });
      }

      if (
        !profile.quoteMode &&
        !hasEnoughKeywordMatch &&
        !hasStrongSemanticMatch
      ) {
        return res.json({
          answer: noInfoAnswer,
          outOfScope: true,
          score:
            topVectorScore,
          documentIds:
            uniqueTargetDocumentIds,
        });
      }

      const mergedMap =
        new Map();

      for (const item of focusedResults) {
        mergedMap.set(
          String(item.id),
          item,
        );
      }

      for (const item of pageResults) {
        mergedMap.set(
          String(item.id),
          item,
        );
      }

      for (
        const item of
        quoteFocusedResults
      ) {
        mergedMap.set(
          String(item.id),
          item,
        );
      }

      for (const item of keywordResults) {
        if (
          !mergedMap.has(
            String(item.id),
          )
        ) {
          mergedMap.set(
            String(item.id),
            item,
          );
        }
      }

      for (const item of vectorResults) {
        if (
          !mergedMap.has(
            String(item.id),
          )
        ) {
          mergedMap.set(
            String(item.id),
            item,
          );
        }
      }

      let finalChunks =
        Array.from(
          mergedMap.values(),
        ).slice(
          0,
          profile.quoteMode
            ? MAX_QUOTE_CHUNKS
            : MAX_NORMAL_CHUNKS,
        );

      if (
        finalChunks.length === 0
      ) {
        finalChunks =
          vectorResults.slice(
            0,
            profile.quoteMode
              ? MAX_QUOTE_CHUNKS
              : MAX_NORMAL_CHUNKS,
          );
      }

      if (
        finalChunks.length ===
          0 &&
        allChunks.length > 0
      ) {
        finalChunks =
          allChunks
            .sort(
              (first, second) =>
                Number(
                  first.payload
                    ?.chunkIndex ||
                    0,
                ) -
                Number(
                  second.payload
                    ?.chunkIndex ||
                    0,
                ),
            )
            .slice(
              0,
              MAX_NORMAL_CHUNKS,
            )
            .map((point) => ({
              id: point.id,
              payload:
                point.payload,
              sourceDocumentId:
                point.sourceDocumentId,
              score: 0,
              keywordScore: 0,
            }));
      }

      const {
        sourceExcerpt,
        sourceDocumentName,
      } = buildSourceExcerpt(
        finalChunks,
        docNameMap,
      );

      /*
       * Ngày xuất bản được xử lý trực tiếp
       * để không phụ thuộc vào việc model
       * phải tự dịch tên tháng.
       */
      if (
        profile.publicationDateIntent
      ) {
        const publicationDate =
          extractPublicationDate(
            finalChunks,
          );

        if (publicationDate) {
          return res.json({
            answer:
              buildPublicationDateAnswer(
                publicationDate,
                responseLanguage,
              ),

            outOfScope: false,

            documentId:
              uniqueTargetDocumentIds[0],

            documentIds:
              uniqueTargetDocumentIds,

            responseLanguage,

            sourceExcerpt,
            sourceDocumentName,

            evidence:
              finalChunks.map(
                (item) => ({
                  fileName:
                    docNameMap.get(
                      item.payload
                        ?.vectorDocumentId ||
                        item.payload
                          ?.documentId ||
                        item.sourceDocumentId,
                    ) ||
                    item.payload
                      ?.fileName,

                  documentId:
                    item.payload
                      ?.documentId,

                  vectorDocumentId:
                    item.payload
                      ?.vectorDocumentId,

                  chunkIndex:
                    item.payload
                      ?.chunkIndex,

                  text:
                    item.payload
                      ?.text,

                  score:
                    item.score ||
                    item.keywordScore ||
                    0,
                }),
              ),
          });
        }
      }

      if (profile.quoteMode) {
        const quoteKeywords =
          quoteSearchKeywords
            .length
            ? quoteSearchKeywords
            : [
                ...importantKeywords,
                ...profile.expansionTerms,
              ];

        const directQuotes =
          extractDirectQuotesFromChunks(
            finalChunks,
            quoteKeywords,
            docNameMap,
          );

        if (
          directQuotes.length > 0
        ) {
          return res.json({
            answer:
              formatDirectQuoteAnswer(
                directQuotes,
                responseLanguage,
              ),

            outOfScope: false,

            documentId:
              uniqueTargetDocumentIds[0],

            documentIds:
              uniqueTargetDocumentIds,

            responseLanguage,

            sourceExcerpt,
            sourceDocumentName,

            evidence:
              finalChunks.map(
                (item) => ({
                  fileName:
                    docNameMap.get(
                      item.payload
                        ?.vectorDocumentId ||
                        item.payload
                          ?.documentId ||
                        item.sourceDocumentId,
                    ) ||
                    item.payload
                      ?.fileName,

                  documentId:
                    item.payload
                      ?.documentId,

                  vectorDocumentId:
                    item.payload
                      ?.vectorDocumentId,

                  chunkIndex:
                    item.payload
                      ?.chunkIndex,

                  text:
                    item.payload
                      ?.text,

                  score:
                    item.score ||
                    item.keywordScore ||
                    0,
                }),
              ),
          });
        }
      }

      const context =
        buildContextWithBudget(
          finalChunks,
          docNameMap,
        );

      const approvedContext =
        Array.isArray(
          approvedAnswers,
        )
          ? approvedAnswers
              .slice(-5)
              .map(
                (
                  item,
                  index,
                ) => `APPROVED ${index + 1}
QUESTION: ${item.question || ""}
ANSWER: ${item.answer || ""}`,
              )
              .join("\n\n")
          : "";

      const selectedFileList =
        vectorDocs
          .map(
            (doc, index) =>
              `${index + 1}. ${doc.fileName}`,
          )
          .join("\n");

      const answerLanguageRule =
        responseLanguage === "en"
          ? `
- Write the explanation in English.
- Use this exact response structure:

Answer: <direct answer>

Direct quote from the file:
“<exact copied sentence or short passage from CONTEXT>”
`
          : `
- Viết phần giải thích bằng tiếng Việt.
- Dùng chính xác cấu trúc:

Đáp án: <câu trả lời trực tiếp>

Trích dẫn nguyên văn từ file:
“<câu hoặc đoạn ngắn được sao chép chính xác từ CONTEXT>”
`;

      const questionTypeRules =
        buildQuestionTypeRules(
          profile,
        );

      const prompt = `
Bạn là chatbot hỏi đáp dựa trên tài liệu người dùng đã chọn.

TÀI LIỆU ĐANG ĐƯỢC CHỌN:
${selectedFileList}

LỊCH SỬ GẦN ĐÂY:
${safeRecentHistory || "Không có."}

NHIỆM VỤ:
Trả lời QUESTION chỉ dựa trên CONTEXT TỪ TÀI LIỆU.

QUY TẮC NGUỒN:
- Chỉ được sử dụng thông tin xuất hiện trong CONTEXT TỪ TÀI LIỆU.
- Không dùng kiến thức bên ngoài, kể cả khi bạn biết đáp án.
- Không suy đoán từ tên file hoặc kiến thức chung.
- FRONT MATTER, trang tiêu đề, metadata, bảng, danh sách và tiêu đề mục đều là nguồn hợp lệ nếu chúng xuất hiện trong CONTEXT.
- APPROVED ANSWERS chỉ dùng để học cách trình bày; không được xem là nguồn kiến thức.
- Nếu nhiều file được chọn, chỉ tổng hợp những file có thông tin liên quan.

QUY TẮC TRẢ LỜI:
- Đọc toàn bộ CONTEXT trước khi kết luận không có thông tin.
- Trả lời thẳng vào câu hỏi, không mở đầu dài dòng.
- Phải trả lời đầy đủ tất cả các vế của QUESTION.
- Giữ chính xác quan hệ phủ định, điều kiện, số lượng, thứ tự và phạm vi áp dụng.
- ĐẶC BIỆT VỀ CÂU HỎI CÓ/KHÔNG (Is ...?, Can ...?, Có ... không?): Nếu đoạn trích nguồn chứa cụm từ phủ định như "is not allowed", "not allowed", "not permitted", "forbidden", "prohibited", "cannot", "does not allow", "không được", "không cho phép", thì ĐÁP ÁN BẮT BUỘC PHẢI LÀ "Đáp án: Không" (hoặc "Answer: No"). CẤM KHÔNG ĐƯỢC trả lời "Đáp án: Có" khi trong đoạn trích có từ "not allowed" hoặc "không được".
- Không được đổi “không” thành “có”, không được bỏ các điều kiện như “trước”, “sau”, “thường xuyên”, “cho đến khi”.
- Khi câu nguồn dùng các từ “can”, “may”, “should” hoặc “does not”, bản dịch phải giữ đúng mức độ khẳng định.
- Nếu câu hỏi yêu cầu danh sách, phải lấy đủ các mục trong câu hoặc đoạn nguồn và không thêm mục ngoài tài liệu.
- Nếu tài liệu tiếng Anh, phần Đáp án có thể dịch sang tiếng Việt nhưng phần Trích dẫn phải sao chép nguyên văn tiếng Anh.
- Trích dẫn phải là một câu hoặc đoạn ngắn có thật trong CONTEXT, không được dịch, sửa chữ hoặc tự viết lại.
- Không đặt nội dung diễn giải của bạn bên trong dấu ngoặc kép.
${questionTypeRules}
${answerLanguageRule}

QUY TẮC KHÔNG CÓ THÔNG TIN:
- Nếu có ít nhất một đoạn trong CONTEXT trả lời được một phần quan trọng của QUESTION, phải trả lời phần đó.
- Chỉ khi toàn bộ CONTEXT hoàn toàn không có thông tin liên quan thì mới trả lời đúng duy nhất một câu:
"${noInfoAnswer}"
- Không được viết câu "${noInfoAnswer}" sau khi đã đưa ra đáp án.

APPROVED ANSWERS:
${approvedContext || "Không có."}

CONTEXT TỪ TÀI LIỆU:
${context}

QUESTION:
${safeMessage}

ANSWER:
`;

      let answer =
        await generateAnswer(
          prompt,
        );

      if (
        answer &&
        answer.includes(
          noInfoAnswer,
        )
      ) {
        const cleanedAnswer =
          answer
            .replace(
              noInfoAnswer,
              "",
            )
            .replace(
              /\n{3,}/g,
              "\n\n",
            )
            .trim();

        if (
          cleanedAnswer.length >
          0
        ) {
          answer =
            cleanedAnswer;
        }
      }

      const fallbackQuote =
        getBestEvidenceQuote(
          finalChunks,
          searchTerms,
        );

      answer =
        ensureAnswerFormat({
          answer,
          responseLanguage,
          noInfoAnswer,
          context,
          fallbackQuote,
        });

      const isOutOfScope =
        !answer ||
        answer.trim() ===
          noInfoAnswer;

      return res.json({
        answer:
          answer ||
          noInfoAnswer,

        outOfScope:
          isOutOfScope,

        documentId:
          uniqueTargetDocumentIds[0],

        documentIds:
          uniqueTargetDocumentIds,

        responseLanguage,

        sourceExcerpt,
        sourceDocumentName,

        evidence:
          finalChunks.map(
            (item) => ({
              fileName:
                docNameMap.get(
                  item.payload
                    ?.vectorDocumentId ||
                    item.payload
                      ?.documentId ||
                    item.sourceDocumentId,
                ) ||
                item.payload
                  ?.fileName,

              documentId:
                item.payload
                  ?.documentId,

              vectorDocumentId:
                item.payload
                  ?.vectorDocumentId,

              chunkIndex:
                item.payload
                  ?.chunkIndex,

              text:
                item.payload
                  ?.text,

              score:
                item.score ||
                item.keywordScore ||
                0,
            }),
          ),
      });
    } catch (error) {
      console.log(
        "Chat failed:",
        error,
      );

      return res
        .status(500)
        .json({
          answer: "Lỗi chat",
          detail:
            error.message,
        });
    }
  },
);

export default router;