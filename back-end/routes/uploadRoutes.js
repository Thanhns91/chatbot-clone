import express from "express";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import xlsx from "xlsx";
import { v4 as uuidv4 } from "uuid";

import pool from "../db.js";
import cloudinary from "../cloudinary.js";
import {
  qdrant,
  COLLECTION_NAME,
} from "../qdrant.js";
import { semanticChunk } from "../chunking.js";
import { embedText } from "../huggingface.js";
import { checkUploadQuota } from "../subscriptionService.js";

const router = express.Router();

export const documents = [];

const upload = multer({
  dest: "uploads/",
});

function cleanupFile(filePath) {
  try {
    if (
      filePath &&
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.log(
      "Cleanup file failed:",
      error.message,
    );
  }
}

function fixFileNameEncoding(
  fileName = "",
) {
  try {
    const decoded = Buffer.from(
      fileName,
      "latin1",
    ).toString("utf8");

    if (decoded.includes(" ")) {
      return fileName;
    }

    return decoded;
  } catch {
    return fileName;
  }
}

function normalizeTextForHash(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function createContentHash(text) {
  const normalizedText =
    normalizeTextForHash(text);

  return crypto
    .createHash("sha256")
    .update(
      normalizedText,
      "utf8",
    )
    .digest("hex");
}

function parseNullableNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

async function uploadDocumentToCloudinary(
  filePath,
  documentId,
  fileName,
) {
  const safeName =
    fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w-]+/g, "-")
      .slice(0, 80) ||
    "document";

  const result =
    await cloudinary.uploader.upload(
      filePath,
      {
        folder:
          "ai-learning/documents",

        resource_type: "raw",

        public_id:
          `${documentId}-${safeName}`,

        use_filename: false,
        unique_filename: false,
        overwrite: true,

        filename_override:
          fileName,
      },
    );

  return result.secure_url;
}

async function extractText(
  filePath,
  originalName,
) {
  const ext = originalName
    .toLowerCase()
    .split(".")
    .pop();

  if (ext === "pdf") {
    const fileBuffer =
      fs.readFileSync(filePath);

    const parser =
      new PDFParse({
        data: fileBuffer,
      });

    const pdfData =
      await parser.getText();

    const rawText =
      pdfData.text || "";

    const formFeedPages =
      rawText
        .split(/\f+/)
        .filter(Boolean);

    if (
      formFeedPages.length > 1
    ) {
      return formFeedPages
        .map(
          (
            pageText,
            index,
          ) =>
            `\n\nPAGE ${
              index + 1
            }\n${pageText}`,
        )
        .join("\n\n");
    }

    return `\n\nPAGE 1\n${rawText}`;
  }

  if (ext === "docx") {
    const result =
      await mammoth.extractRawText(
        {
          path: filePath,
        },
      );

    return result.value;
  }

  if (
    ext === "xlsx" ||
    ext === "xls"
  ) {
    const workbook =
      xlsx.readFile(filePath);

    let text = "";

    workbook.SheetNames.forEach(
      (sheetName) => {
        const sheet =
          workbook.Sheets[
            sheetName
          ];

        const rows =
          xlsx.utils.sheet_to_json(
            sheet,
            {
              header: 1,
              defval: "",
            },
          );

        text +=
          `\nSheet: ${sheetName}\n`;

        rows.forEach((row) => {
          text +=
            row.join(" | ") +
            "\n";
        });
      },
    );

    return text;
  }

  throw new Error(
    "Unsupported file type",
  );
}

async function getUploaderInfo(
  uploaderId,
) {
  const [userRows] =
    await pool.query(
      `
      SELECT
        userId,
        fullName,
        role,
        status
      FROM Users
      WHERE userId = ?
      LIMIT 1
      `,
      [uploaderId],
    );

  return userRows[0] || null;
}

/*
 * QUY TẮC DUPLICATE
 *
 * 1. Ưu tiên tìm file của chính người upload.
 * 2. Nếu không có, chỉ tìm file đã Public/approved.
 * 3. Bỏ qua toàn bộ file Student đang Private của người khác.
 */
async function getDuplicateInfo(
  contentHash,
  uploaderId,
) {
  const selectColumns = `
    SELECT
      documentId,
      fileName,
      fileType,
      fileUrl,
      fileSizeBytes,
      contentHash,
      versionGroupId,
      versionNo,
      vectorDocumentId,
      originalDocumentId,
      uploaderId,
      uploadedBy,
      reviewStatus,
      uploadDate,
      isDuplicate,
      subjectId,
      topicId,
      documentTypeId,
      levelId,
      tags,
      summary
    FROM Documents
  `;

  /*
   * Trùng file của chính user.
   */
  const [ownDocuments] =
    await pool.query(
      `
      ${selectColumns}
      WHERE uploadStatus = 'success'
        AND isDeleted = FALSE
        AND contentHash = ?
        AND uploaderId = ?
      ORDER BY
        versionNo ASC,
        uploadDate ASC
      LIMIT 1
      `,
      [
        contentHash,
        uploaderId,
      ],
    );

  let originalDoc =
    ownDocuments[0] || null;

  let duplicateScope =
    originalDoc
      ? "own"
      : null;

  /*
   * Không có file của chính user:
   * chỉ tìm tài liệu Public.
   *
   * File Private của Student khác
   * không tham gia kiểm tra trùng.
   */
  if (!originalDoc) {
    const [publicDocuments] =
      await pool.query(
        `
        ${selectColumns}
        WHERE uploadStatus = 'success'
          AND isDeleted = FALSE
          AND contentHash = ?
          AND reviewStatus = 'approved'
        ORDER BY
          versionNo ASC,
          uploadDate ASC
        LIMIT 1
        `,
        [contentHash],
      );

    originalDoc =
      publicDocuments[0] ||
      null;

    if (originalDoc) {
      duplicateScope =
        "public";
    }
  }

  if (!originalDoc) {
    return null;
  }

  const versionGroupId =
    originalDoc.versionGroupId ||
    originalDoc.originalDocumentId ||
    originalDoc.documentId;

  const vectorDocumentId =
    originalDoc.vectorDocumentId ||
    originalDoc.documentId;

  const originalDocumentId =
    originalDoc.originalDocumentId ||
    originalDoc.documentId;

  /*
   * Tính version cho cả:
   * - File của chính user.
   * - File Public của người khác.
   */
  const [versionRows] =
    await pool.query(
      `
      SELECT
        COALESCE(
          MAX(versionNo),
          0
        ) + 1 AS nextVersion
      FROM Documents
      WHERE isDeleted = FALSE
        AND (
          versionGroupId = ?
          OR documentId = ?
          OR originalDocumentId = ?
        )
      `,
      [
        versionGroupId,
        originalDocumentId,
        originalDocumentId,
      ],
    );

  const nextVersion =
    Math.max(
      Number(
        versionRows[0]
          ?.nextVersion || 2,
      ),

      Number(
        originalDoc.versionNo ||
          1,
      ) + 1,
    );

  return {
    originalDoc,
    duplicateScope,
    versionGroupId,
    vectorDocumentId,
    originalDocumentId,
    nextVersion,
  };
}

async function getReplaceTargetInfo(
  replaceDocumentId,
) {
  if (!replaceDocumentId) {
    return null;
  }

  const [rows] =
    await pool.query(
      `
      SELECT
        documentId,
        fileName,
        fileType,
        fileUrl,
        fileSizeBytes,
        contentHash,
        versionGroupId,
        versionNo,
        vectorDocumentId,
        originalDocumentId,
        uploaderId,
        uploadedBy,
        reviewStatus,
        subjectId,
        topicId,
        documentTypeId,
        levelId,
        tags,
        summary,
        isDeleted
      FROM Documents
      WHERE documentId = ?
        AND isDeleted = FALSE
      LIMIT 1
      `,
      [replaceDocumentId],
    );

  if (rows.length === 0) {
    throw new Error(
      "Replace target document not found",
    );
  }

  const originalDoc = rows[0];

  const versionGroupId =
    originalDoc.versionGroupId ||
    originalDoc.originalDocumentId ||
    originalDoc.documentId;

  const originalDocumentId =
    originalDoc.originalDocumentId ||
    originalDoc.documentId;

  const [versionRows] =
    await pool.query(
      `
      SELECT
        COALESCE(
          MAX(versionNo),
          0
        ) + 1 AS nextVersion
      FROM Documents
      WHERE versionGroupId = ?
         OR documentId = ?
         OR originalDocumentId = ?
      `,
      [
        versionGroupId,
        originalDocumentId,
        originalDocumentId,
      ],
    );

  return {
    originalDoc,
    versionGroupId,

    vectorDocumentId:
      originalDoc.vectorDocumentId ||
      originalDoc.documentId,

    originalDocumentId,

    nextVersion: Math.max(
      Number(
        versionRows[0]
          ?.nextVersion || 2,
      ),

      Number(
        originalDoc.versionNo ||
          1,
      ) + 1,
    ),
  };
}

function normalizeForMeta(
  value = "",
) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(/đ/g, "d")
    .replace(
      /[^a-z0-9\s]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMetadataCandidate(
  text,
  values = [],
) {
  const haystack =
    normalizeForMeta(text);

  return values.reduce(
    (score, value) => {
      const keyword =
        normalizeForMeta(value);

      if (!keyword) {
        return score;
      }

      if (
        haystack.includes(
          keyword,
        )
      ) {
        return (
          score +
          Math.max(
            3,
            keyword.length,
          )
        );
      }

      return score;
    },
    0,
  );
}

function buildAutoTags({
  subject,
  topic,
  documentType,
  level,
  fileName,
}) {
  const ext = String(
    fileName || "",
  )
    .split(".")
    .pop()
    ?.toLowerCase();

  const tags = [
    subject?.subjectCode,
    subject?.subjectName,
    topic?.topicName,
    documentType?.typeName,
    level?.levelName,
    ext,
  ]
    .filter(Boolean)
    .map((item) =>
      String(item).trim(),
    )
    .filter(Boolean);

  return [
    ...new Set(tags),
  ]
    .slice(0, 8)
    .join(", ");
}

function pickBestSubject(
  subjects,
  fileName,
  text,
) {
  if (!subjects.length) {
    return null;
  }

  const source =
    `${fileName}\n${String(
      text || "",
    ).slice(0, 5000)}`;

  const scored = subjects
    .map((subject) => ({
      subject,

      score:
        scoreMetadataCandidate(
          source,
          [
            subject.subjectCode,
            subject.subjectName,
            subject.description,
          ],
        ),
    }))
    .sort(
      (first, second) =>
        second.score -
        first.score,
    );

  return scored[0]?.score > 0
    ? scored[0].subject
    : subjects[0];
}

function pickBestTopic(
  topics,
  subjectId,
  fileName,
  text,
) {
  const subjectTopics =
    topics.filter(
      (topic) =>
        String(topic.subjectId) ===
        String(subjectId),
    );

  if (!subjectTopics.length) {
    return null;
  }

  const source =
    `${fileName}\n${String(
      text || "",
    ).slice(0, 5000)}`;

  const scored =
    subjectTopics
      .map((topic) => ({
        topic,

        score:
          scoreMetadataCandidate(
            source,
            [
              topic.topicName,
              topic.description,
            ],
          ),
      }))
      .sort(
        (first, second) =>
          second.score -
          first.score,
      );

  const uncategorized =
    subjectTopics.find(
      (topic) =>
        normalizeForMeta(
          topic.topicName,
        ).includes(
          "uncategorized",
        ),
    );

  return scored[0]?.score > 0
    ? scored[0].topic
    : uncategorized ||
        subjectTopics[0];
}

function pickBestDocumentType(
  documentTypes,
  fileName,
  uploadedBy,
) {
  if (!documentTypes.length) {
    return null;
  }

  const name =
    normalizeForMeta(fileName);

  const typeHints = [
    {
      keys: [
        "assignment",
        "bai tap",
        "homework",
        "exercise",
        "submission",
      ],
      name: "Assignment",
    },
    {
      keys: [
        "slide",
        "ppt",
        "pptx",
        "presentation",
      ],
      name: "Slide",
    },
    {
      keys: [
        "case",
        "case study",
      ],
      name: "Case Study",
    },
    {
      keys: [
        "research",
        "paper",
        "journal",
      ],
      name: "Research Paper",
    },
    {
      keys: [
        "reference",
        "tham khao",
        "ref",
      ],
      name: "Reference",
    },
    {
      keys: [
        "lecture",
        "lesson",
        "bai giang",
        "material",
      ],
      name: "Lecture",
    },
  ];

  const matchedHint =
    typeHints.find((hint) =>
      hint.keys.some((key) =>
        name.includes(key),
      ),
    );

  const wantedName =
    matchedHint?.name ||
    (uploadedBy === "student"
      ? "Assignment"
      : "Lecture");

  return (
    documentTypes.find(
      (type) =>
        normalizeForMeta(
          type.typeName,
        ) ===
        normalizeForMeta(
          wantedName,
        ),
    ) ||
    documentTypes[0]
  );
}

function pickBestLevel(
  documentLevels,
  text,
) {
  if (!documentLevels.length) {
    return null;
  }

  const content =
    normalizeForMeta(text);

  const advancedWords = [
    "advanced",
    "nang cao",
    "architecture",
    "evaluation",
    "optimization",
    "research",
  ];

  const beginnerWords = [
    "basic",
    "intro",
    "introduction",
    "co ban",
    "overview",
    "tong quan",
  ];

  let wantedName =
    "Intermediate";

  if (
    advancedWords.some((word) =>
      content.includes(
        normalizeForMeta(word),
      ),
    )
  ) {
    wantedName = "Advanced";
  } else if (
    beginnerWords.some((word) =>
      content.includes(
        normalizeForMeta(word),
      ),
    )
  ) {
    wantedName = "Beginner";
  }

  return (
    documentLevels.find(
      (level) =>
        normalizeForMeta(
          level.levelName,
        ) ===
        normalizeForMeta(
          wantedName,
        ),
    ) ||
    documentLevels[0]
  );
}

async function autoFillMetadata(
  metadata,
  {
    text,
    fileName,
    uploadedBy,
  },
) {
  const [subjects] =
    await pool.query(`
      SELECT
        subjectId,
        subjectCode,
        subjectName,
        description
      FROM Subjects
      ORDER BY
        subjectCode,
        subjectName
    `);

  const [topics] =
    await pool.query(`
      SELECT
        topicId,
        subjectId,
        topicName,
        description
      FROM Topics
      ORDER BY topicName
    `);

  const [documentTypes] =
    await pool.query(`
      SELECT
        documentTypeId,
        typeName,
        description
      FROM DocumentTypes
      ORDER BY typeName
    `);

  const [documentLevels] =
    await pool.query(`
      SELECT
        levelId,
        levelName,
        description
      FROM DocumentLevels
      ORDER BY levelId
    `);

  const selectedSubject =
    metadata.subjectId
      ? subjects.find(
          (subject) =>
            String(
              subject.subjectId,
            ) ===
            String(
              metadata.subjectId,
            ),
        )
      : pickBestSubject(
          subjects,
          fileName,
          text,
        );

  const subjectId =
    metadata.subjectId ||
    selectedSubject?.subjectId ||
    null;

  const selectedTopic =
    metadata.topicId
      ? topics.find(
          (topic) =>
            String(
              topic.topicId,
            ) ===
            String(
              metadata.topicId,
            ),
        )
      : pickBestTopic(
          topics,
          subjectId,
          fileName,
          text,
        );

  const selectedType =
    metadata.documentTypeId
      ? documentTypes.find(
          (type) =>
            String(
              type.documentTypeId,
            ) ===
            String(
              metadata.documentTypeId,
            ),
        )
      : pickBestDocumentType(
          documentTypes,
          fileName,
          uploadedBy,
        );

  const selectedLevel =
    metadata.levelId
      ? documentLevels.find(
          (level) =>
            String(
              level.levelId,
            ) ===
            String(
              metadata.levelId,
            ),
        )
      : pickBestLevel(
          documentLevels,
          text,
        );

  return {
    subjectId,

    topicId:
      metadata.topicId ||
      selectedTopic?.topicId ||
      null,

    documentTypeId:
      metadata.documentTypeId ||
      selectedType
        ?.documentTypeId ||
      null,

    levelId:
      metadata.levelId ||
      selectedLevel?.levelId ||
      null,

    tags:
      metadata.tags ||
      buildAutoTags({
        subject:
          selectedSubject,

        topic:
          selectedTopic,

        documentType:
          selectedType,

        level:
          selectedLevel,

        fileName,
      }),

    summary:
      metadata.summary ||
      null,
  };
}

async function validateMetadata({
  subjectId,
  topicId,
  documentTypeId,
  levelId,
}) {
  if (subjectId) {
    const [rows] =
      await pool.query(
        `
        SELECT subjectId
        FROM Subjects
        WHERE subjectId = ?
        LIMIT 1
        `,
        [subjectId],
      );

    if (rows.length === 0) {
      throw new Error(
        "Invalid subjectId",
      );
    }
  }

  if (topicId) {
    const [rows] =
      await pool.query(
        `
        SELECT topicId
        FROM Topics
        WHERE topicId = ?
          AND (
            ? IS NULL
            OR subjectId = ?
          )
        LIMIT 1
        `,
        [
          topicId,
          subjectId,
          subjectId,
        ],
      );

    if (rows.length === 0) {
      throw new Error(
        "Invalid topicId",
      );
    }
  }

  if (documentTypeId) {
    const [rows] =
      await pool.query(
        `
        SELECT documentTypeId
        FROM DocumentTypes
        WHERE documentTypeId = ?
        LIMIT 1
        `,
        [documentTypeId],
      );

    if (rows.length === 0) {
      throw new Error(
        "Invalid documentTypeId",
      );
    }
  }

  if (levelId) {
    const [rows] =
      await pool.query(
        `
        SELECT levelId
        FROM DocumentLevels
        WHERE levelId = ?
        LIMIT 1
        `,
        [levelId],
      );

    if (rows.length === 0) {
      throw new Error(
        "Invalid levelId",
      );
    }
  }
}

async function insertDocumentVersion(
  connection,
  {
    documentId,
    versionGroupId,
    versionNo,
    contentHash,
    vectorDocumentId,
    actionType,
    replacedDocumentId,
    createdBy,
  },
) {
  if (versionGroupId) {
    await connection.query(
      `
      UPDATE DocumentVersions
      SET isCurrent = FALSE
      WHERE versionGroupId = ?
      `,
      [versionGroupId],
    );
  }

  await connection.query(
    `
    INSERT INTO DocumentVersions
    (
      documentId,
      versionGroupId,
      versionNo,
      contentHash,
      vectorDocumentId,
      actionType,
      replacedDocumentId,
      isCurrent,
      createdBy
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      TRUE,
      ?
    )
    `,
    [
      documentId,
      versionGroupId,
      versionNo,
      contentHash,
      vectorDocumentId,
      actionType,
      replacedDocumentId ||
        null,
      createdBy || null,
    ],
  );
}

async function insertStudentActivity(
  connection,
  {
    userId,
    activityType,
    documentId,
    subjectId,
    topicId,
    metadata,
  },
) {
  if (
    !userId ||
    !activityType
  ) {
    return;
  }

  await connection.query(
    `
    INSERT INTO StudentActivities
    (
      userId,
      activityType,
      documentId,
      subjectId,
      topicId,
      metadata
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      activityType,
      documentId || null,
      subjectId || null,
      topicId || null,

      metadata
        ? JSON.stringify(
            metadata,
          )
        : null,
    ],
  );
}

async function notifyStudentsAboutTeacherUpload(
  connection,
  documentId,
  fileName,
) {
  if (!documentId) return;

  const [students] =
    await connection.query(
      `
      SELECT userId
      FROM Users
      WHERE role = 'student'
        AND status = 'active'
      `,
    );

  if (students.length === 0) {
    return;
  }

  const values =
    students.map(
      (student) => [
        student.userId,
        documentId,
        null,

        "New teacher material uploaded",

        `Teacher uploaded a new file: ${fileName}`,

        "student_upload",
      ],
    );

  await connection.query(
    `
    INSERT INTO Notifications
    (
      receiverId,
      documentId,
      feedbackId,
      title,
      message,
      type
    )
    VALUES ?
    `,
    [values],
  );
}

async function safeNotifyTeacherUpload(
  connection,
  uploadedBy,
  documentId,
  fileName,
) {
  if (
    uploadedBy !== "teacher"
  ) {
    return;
  }

  try {
    await notifyStudentsAboutTeacherUpload(
      connection,
      documentId,
      fileName,
    );
  } catch (notifyError) {
    console.log(
      "Create notification failed:",
      notifyError.message,
    );
  }
}

async function safeDeleteVectors(
  documentId,
) {
  if (!documentId) return;

  try {
    await qdrant.delete(
      COLLECTION_NAME,
      {
        wait: true,

        filter: {
          should: [
            {
              key:
                "documentId",

              match: {
                value:
                  documentId,
              },
            },
            {
              key:
                "vectorDocumentId",

              match: {
                value:
                  documentId,
              },
            },
          ],
        },
      },
    );
  } catch (error) {
    console.log(
      "Delete Qdrant vectors failed:",
      error.message,
    );
  }
}

async function upsertDocumentVectors({
  chunks,
  documentId,
  fileName,
  uploadedBy,
  uploaderId,
  metadata,
}) {
  const points = [];

  for (
    let index = 0;
    index < chunks.length;
    index += 1
  ) {
    const vector =
      await embedText(
        chunks[index],
      );

    points.push({
      id: uuidv4(),
      vector,

      payload: {
        documentId,

        vectorDocumentId:
          documentId,

        fileName,
        uploadedBy,
        uploaderId,

        text: chunks[index],

        chunkIndex: index,

        subjectId:
          metadata.subjectId ||
          null,

        topicId:
          metadata.topicId ||
          null,

        documentTypeId:
          metadata.documentTypeId ||
          null,

        levelId:
          metadata.levelId ||
          null,
      },
    });
  }

  await qdrant.upsert(
    COLLECTION_NAME,
    {
      points,
    },
  );

  return points.length;
}

router.post(
  "/",
  upload.single("file"),
  async (req, res) => {
    let connection;

    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "No file uploaded",
          });
      }

      const fileName =
        fixFileNameEncoding(
          req.file.originalname,
        );

      const fileType =
        req.file.mimetype;

      const fileSizeBytes =
        Number(
          req.file.size || 0,
        );

      const uploaderId =
        Number(
          req.body.uploaderId,
        );

      if (!uploaderId) {
        cleanupFile(
          req.file.path,
        );

        return res
          .status(400)
          .json({
            success: false,
            error:
              "Missing uploaderId",
          });
      }

      const uploader =
        await getUploaderInfo(
          uploaderId,
        );

      if (!uploader) {
        cleanupFile(
          req.file.path,
        );

        return res
          .status(404)
          .json({
            success: false,
            error:
              "Uploader not found",
          });
      }

      if (
        uploader.status ===
        "blocked"
      ) {
        cleanupFile(
          req.file.path,
        );

        return res
          .status(403)
          .json({
            success: false,
            error:
              "Your account is blocked",
          });
      }

      if (
        uploader.role ===
        "admin"
      ) {
        cleanupFile(
          req.file.path,
        );

        return res
          .status(403)
          .json({
            success: false,
            error:
              "Admin is not allowed to upload documents",
          });
      }

      const uploadedBy =
        uploader.role;

      const reviewStatus =
        uploadedBy === "teacher"
          ? "approved"
          : "private";

      let metadata = {
        subjectId:
          parseNullableNumber(
            req.body.subjectId,
          ),

        topicId:
          parseNullableNumber(
            req.body.topicId,
          ),

        documentTypeId:
          parseNullableNumber(
            req.body
              .documentTypeId,
          ),

        levelId:
          parseNullableNumber(
            req.body.levelId,
          ),

        tags:
          req.body.tags ||
          null,

        summary:
          req.body.summary ||
          null,
      };

      const allowVersion =
        req.body.allowVersion ===
          "true" ||
        req.body.allowVersion ===
          true;

      const duplicateAction =
        req.body
          .duplicateAction ||
        (allowVersion
          ? "new_version"
          : "");

      const replaceDocumentId =
        req.body
          .replaceDocumentId ||
        null;

      const explicitReplaceInfo =
        duplicateAction ===
          "replace_old" &&
        replaceDocumentId
          ? await getReplaceTargetInfo(
              replaceDocumentId,
            )
          : null;

      if (explicitReplaceInfo) {
        const oldDoc =
          explicitReplaceInfo
            .originalDoc;

        /*
         * Chỉ Teacher được replace.
         */
        if (
          uploadedBy !==
          "teacher"
        ) {
          cleanupFile(
            req.file.path,
          );

          return res
            .status(403)
            .json({
              success: false,
              error:
                "Only teachers can replace documents",
            });
        }

        /*
         * Không được replace file của
         * Teacher khác hoặc Student.
         */
        if (
          oldDoc.uploadedBy !==
            "teacher" ||
          Number(
            oldDoc.uploaderId,
          ) !==
            Number(uploaderId)
        ) {
          cleanupFile(
            req.file.path,
          );

          return res
            .status(403)
            .json({
              success: false,
              error:
                "You can only replace your own uploaded document",
            });
        }

        metadata = {
          subjectId:
            metadata.subjectId ||
            oldDoc.subjectId ||
            null,

          topicId:
            metadata.topicId ||
            oldDoc.topicId ||
            null,

          documentTypeId:
            metadata.documentTypeId ||
            oldDoc.documentTypeId ||
            null,

          levelId:
            metadata.levelId ||
            oldDoc.levelId ||
            null,

          tags:
            metadata.tags ||
            oldDoc.tags ||
            null,

          summary:
            metadata.summary ||
            oldDoc.summary ||
            null,
        };
      }

      const documentId =
        uuidv4();

      const text =
        await extractText(
          req.file.path,
          fileName,
        );

      if (
        !text ||
        text.trim().length === 0
      ) {
        throw new Error(
          "Cannot extract text from this file.",
        );
      }

      metadata =
        await autoFillMetadata(
          metadata,
          {
            text,
            fileName,
            uploadedBy,
          },
        );

      await validateMetadata(
        metadata,
      );

      const contentHash =
        createContentHash(text);

      const duplicateInfo =
        await getDuplicateInfo(
          contentHash,
          uploaderId,
        );

      const replaceInfo =
        explicitReplaceInfo ||
        duplicateInfo;

      /*
       * Chưa chọn action:
       * trả dữ liệu cho Toast xử lý.
       */
      if (
        duplicateInfo &&
        !duplicateAction
      ) {
        cleanupFile(
          req.file.path,
        );

        /*
         * Trùng file của chính user.
         */
        if (
          duplicateInfo
            .duplicateScope ===
          "own"
        ) {
          const canReplace =
            uploadedBy ===
            "teacher";

          const actions = [
            {
              key:
                "new_version",

              label:
                `Save as Version ${duplicateInfo.nextVersion}`,
            },
          ];

          if (canReplace) {
            actions.push({
              key:
                "replace_old",

              label:
                "Replace old file",
            });
          }

          return res.json({
            success: true,
            duplicate: true,
            needConfirm: true,
            versionCreated:
              false,

            duplicateType:
              "own",

            canReplace,

            message:
              "Bạn đã upload tài liệu này trước đó. Hãy chọn cách tiếp tục.",

            actions,

            currentFileName:
              fileName,

            existingDocumentId:
              duplicateInfo
                .originalDoc
                .documentId,

            existingFileName:
              duplicateInfo
                .originalDoc
                .fileName,

            nextVersion:
              duplicateInfo
                .nextVersion,

            versionGroupId:
              duplicateInfo
                .versionGroupId,

            vectorDocumentId:
              duplicateInfo
                .vectorDocumentId,

            originalDocumentId:
              duplicateInfo
                .originalDocumentId,
          });
        }

        /*
         * Teacher upload trùng tài liệu
         * đã Public của người khác.
         *
         * Được tạo Version nhưng
         * không được Replace.
         */
        if (
          duplicateInfo
            .duplicateScope ===
            "public" &&
          uploadedBy ===
            "teacher"
        ) {
          return res.json({
            success: true,
            duplicate: true,
            needConfirm: true,
            versionCreated:
              false,

            duplicateType:
              "public",

            canReplace: false,

            message:
              "Tài liệu này đã tồn tại trong thư viện công khai. Bạn có muốn lưu thành phiên bản mới không?",

            actions: [
              {
                key:
                  "new_version",

                label:
                  `Save as Version ${duplicateInfo.nextVersion}`,
              },
            ],

            currentFileName:
              fileName,

            existingDocumentId:
              duplicateInfo
                .originalDoc
                .documentId,

            existingFileName:
              duplicateInfo
                .originalDoc
                .fileName,

            nextVersion:
              duplicateInfo
                .nextVersion,

            versionGroupId:
              duplicateInfo
                .versionGroupId,

            vectorDocumentId:
              duplicateInfo
                .vectorDocumentId,

            originalDocumentId:
              duplicateInfo
                .originalDocumentId,
          });
        }

        /*
         * Student upload trùng tài liệu
         * đã Public thì chặn.
         */
        return res
          .status(409)
          .json({
            success: false,
            duplicate: true,
            needConfirm: false,

            duplicateType:
              "public",

            message:
              "Tài liệu này đã tồn tại trong thư viện công khai.",

            existingDocumentId:
              duplicateInfo
                .originalDoc
                .documentId,

            existingFileName:
              duplicateInfo
                .originalDoc
                .fileName,

            existingUploadedBy:
              duplicateInfo
                .originalDoc
                .uploadedBy,
          });
      }

      /*
       * Không cho gửi replace_old
       * đối với Public duplicate
       * thuộc người khác.
       */
      if (
        duplicateAction ===
          "replace_old" &&
        duplicateInfo
          ?.duplicateScope ===
          "public"
      ) {
        cleanupFile(
          req.file.path,
        );

        return res
          .status(403)
          .json({
            success: false,
            duplicate: true,

            message:
              "Bạn không thể thay thế tài liệu công khai của người khác.",
          });
      }

      /*
       * Kiểm tra quota.
       *
       * Chỉ replace_old mới được
       * trừ dung lượng file cũ.
       */
      const quotaReplaceDocumentId =
        duplicateAction ===
        "replace_old"
          ? replaceDocumentId ||
            duplicateInfo
              ?.originalDoc
              ?.documentId ||
            null
          : null;

      const storageCheck =
        await checkUploadQuota({
          userId: uploaderId,

          incomingBytes:
            fileSizeBytes,

          replaceDocumentId:
            quotaReplaceDocumentId,
        });

      if (!storageCheck.allowed) {
        cleanupFile(
          req.file.path,
        );

        return res
          .status(413)
          .json({
            success: false,

            code:
              "STORAGE_LIMIT_EXCEEDED",

            message:
              "Bạn đã vượt giới hạn dung lượng lưu trữ. Hãy xóa bớt tài liệu hoặc nâng cấp gói.",

            storage: {
              usedBytes:
                storageCheck
                  .usedBytes,

              limitBytes:
                storageCheck
                  .limitBytes,

              remainingBytes:
                storageCheck
                  .remainingBytes,

              incomingBytes:
                storageCheck
                  .incomingBytes,

              replacedBytes:
                storageCheck
                  .replacedBytes,

              projectedBytes:
                storageCheck
                  .projectedBytes,

              percentage:
                storageCheck
                  .percentage,

              plan:
                storageCheck.plan,
            },
          });
      }

      const fileUrl =
        await uploadDocumentToCloudinary(
          req.file.path,
          documentId,
          fileName,
        );

      connection =
        await pool.getConnection();

      await connection.beginTransaction();

      /*
       * TẠO VERSION MỚI.
       *
       * Áp dụng cho:
       * - File của chính Teacher.
       * - File Public của người khác.
       */
      if (
        duplicateInfo &&
        duplicateAction ===
          "new_version"
      ) {
        const {
          versionGroupId,
          vectorDocumentId,
          originalDocumentId,
          nextVersion,
        } = duplicateInfo;

        await connection.query(
          `
          INSERT INTO Documents
          (
            documentId,
            fileName,
            fileType,
            fileUrl,
            fileSizeBytes,
            contentHash,
            uploaderId,
            uploadedBy,
            uploadStatus,
            reviewStatus,
            subjectId,
            topicId,
            documentTypeId,
            levelId,
            tags,
            summary,
            versionGroupId,
            versionNo,
            vectorDocumentId,
            isDuplicate,
            originalDocumentId
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'success',
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            TRUE,
            ?
          )
          `,
          [
            documentId,
            fileName,
            fileType,
            fileUrl,
            fileSizeBytes,
            contentHash,
            uploaderId,
            uploadedBy,
            reviewStatus,

            metadata.subjectId ||
              duplicateInfo
                .originalDoc
                .subjectId ||
              null,

            metadata.topicId ||
              duplicateInfo
                .originalDoc
                .topicId ||
              null,

            metadata.documentTypeId ||
              duplicateInfo
                .originalDoc
                .documentTypeId ||
              null,

            metadata.levelId ||
              duplicateInfo
                .originalDoc
                .levelId ||
              null,

            metadata.tags ||
              duplicateInfo
                .originalDoc
                .tags ||
              null,

            metadata.summary ||
              duplicateInfo
                .originalDoc
                .summary ||
              null,

            versionGroupId,
            nextVersion,
            vectorDocumentId,
            originalDocumentId,
          ],
        );

        await insertDocumentVersion(
          connection,
          {
            documentId,
            versionGroupId,

            versionNo:
              nextVersion,

            contentHash,
            vectorDocumentId,

            actionType:
              "new_version",

            replacedDocumentId:
              null,

            createdBy:
              uploaderId,
          },
        );

        if (
          uploadedBy ===
          "student"
        ) {
          await insertStudentActivity(
            connection,
            {
              userId:
                uploaderId,

              activityType:
                "upload_document",

              documentId,

              subjectId:
                metadata.subjectId,

              topicId:
                metadata.topicId,

              metadata: {
                action:
                  "new_version",

                fileName,

                versionNo:
                  nextVersion,
              },
            },
          );
        }

        await safeNotifyTeacherUpload(
          connection,
          uploadedBy,
          documentId,
          fileName,
        );

        await connection.commit();

        cleanupFile(
          req.file.path,
        );

        return res.json({
          success: true,
          duplicate: true,
          needConfirm: false,
          versionCreated: true,

          duplicateType:
            duplicateInfo
              .duplicateScope,

          message:
            `Saved as Version ${nextVersion}.`,

          documentId,
          fileName,
          fileType,
          fileUrl,
          fileSizeBytes,
          contentHash,
          uploadedBy,
          reviewStatus,

          subjectId:
            metadata.subjectId ||
            duplicateInfo
              .originalDoc
              .subjectId ||
            null,

          topicId:
            metadata.topicId ||
            duplicateInfo
              .originalDoc
              .topicId ||
            null,

          documentTypeId:
            metadata.documentTypeId ||
            duplicateInfo
              .originalDoc
              .documentTypeId ||
            null,

          levelId:
            metadata.levelId ||
            duplicateInfo
              .originalDoc
              .levelId ||
            null,

          tags:
            metadata.tags ||
            duplicateInfo
              .originalDoc
              .tags ||
            null,

          summary:
            metadata.summary ||
            duplicateInfo
              .originalDoc
              .summary ||
            null,

          versionGroupId,

          versionNo:
            nextVersion,

          vectorDocumentId,
          isDuplicate: true,
          originalDocumentId,

          totalChunks: 0,
        });
      }

      const replaceTargetDocumentId =
        replaceDocumentId ||
        replaceInfo
          ?.originalDoc
          ?.documentId ||
        null;

      const shouldReplaceOld =
        duplicateAction ===
          "replace_old" &&
        Boolean(
          replaceTargetDocumentId,
        );

      const versionGroupId =
        shouldReplaceOld
          ? replaceInfo
              ?.versionGroupId ||
            replaceTargetDocumentId
          : documentId;

      const versionNo =
        shouldReplaceOld
          ? replaceInfo
              ?.nextVersion || 2
          : 1;

      const vectorDocumentId =
        documentId;

      const originalDocumentId =
        shouldReplaceOld
          ? replaceInfo
              ?.originalDocumentId ||
            replaceTargetDocumentId
          : null;

      const chunks =
        semanticChunk(text);

      if (
        !chunks ||
        chunks.length === 0
      ) {
        throw new Error(
          "Cannot create chunks from this document.",
        );
      }

      const totalChunks =
        await upsertDocumentVectors(
          {
            chunks,
            documentId,
            fileName,
            uploadedBy,
            uploaderId,
            metadata,
          },
        );

      if (shouldReplaceOld) {
        await connection.query(
          `
          UPDATE Documents
          SET
            isDeleted = TRUE,
            deletedAt = NOW(),
            replacedByDocumentId = ?
          WHERE documentId = ?
          `,
          [
            documentId,
            replaceTargetDocumentId,
          ],
        );

        await connection.query(
          `
          UPDATE DocumentVersions
          SET isCurrent = FALSE
          WHERE documentId = ?
             OR versionGroupId = ?
          `,
          [
            replaceTargetDocumentId,
            versionGroupId,
          ],
        );
      }

      await connection.query(
        `
        INSERT INTO Documents
        (
          documentId,
          fileName,
          fileType,
          fileUrl,
          fileSizeBytes,
          contentHash,
          uploaderId,
          uploadedBy,
          uploadStatus,
          reviewStatus,
          subjectId,
          topicId,
          documentTypeId,
          levelId,
          tags,
          summary,
          versionGroupId,
          versionNo,
          vectorDocumentId,
          isDuplicate,
          originalDocumentId
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'success',
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
        `,
        [
          documentId,
          fileName,
          fileType,
          fileUrl,
          fileSizeBytes,
          contentHash,
          uploaderId,
          uploadedBy,
          reviewStatus,
          metadata.subjectId,
          metadata.topicId,
          metadata.documentTypeId,
          metadata.levelId,
          metadata.tags,
          metadata.summary,
          versionGroupId,
          versionNo,
          vectorDocumentId,
          false,
          originalDocumentId,
        ],
      );

      await insertDocumentVersion(
        connection,
        {
          documentId,
          versionGroupId,
          versionNo,
          contentHash,
          vectorDocumentId,

          actionType:
            shouldReplaceOld
              ? "replace_old"
              : "original",

          replacedDocumentId:
            shouldReplaceOld
              ? replaceTargetDocumentId
              : null,

          createdBy:
            uploaderId,
        },
      );

      if (shouldReplaceOld) {
        await connection.query(
          `
          UPDATE ChatSessions
          SET documentId = ?
          WHERE documentId = ?
          `,
          [
            documentId,
            replaceTargetDocumentId,
          ],
        );

        await connection.query(
          `
          UPDATE ChatSessionDocuments
          SET documentId = ?
          WHERE documentId = ?
          `,
          [
            documentId,
            replaceTargetDocumentId,
          ],
        );

        try {
          await connection.query(
            `
            UPDATE MessageReports
            SET
              status = CASE
                WHEN status IN (
                  'pending',
                  'reviewing'
                )
                THEN 'resolved'
                ELSE status
              END,

              resolvedDocumentId = ?,

              teacherNote =
                COALESCE(
                  teacherNote,
                  'Source document was replaced with a corrected version.'
                ),

              reviewedAt = CASE
                WHEN status IN (
                  'pending',
                  'reviewing'
                )
                THEN NOW()
                ELSE reviewedAt
              END

            WHERE documentId = ?
            `,
            [
              documentId,
              replaceTargetDocumentId,
            ],
          );
        } catch (
          reportUpdateError
        ) {
          console.log(
            "Update message reports after replace failed:",
            reportUpdateError.message,
          );
        }
      }

      if (
        uploadedBy ===
        "student"
      ) {
        await insertStudentActivity(
          connection,
          {
            userId:
              uploaderId,

            activityType:
              "upload_document",

            documentId,

            subjectId:
              metadata.subjectId,

            topicId:
              metadata.topicId,

            metadata: {
              action:
                shouldReplaceOld
                  ? "replace_old"
                  : "original",

              fileName,
              versionNo,
            },
          },
        );
      }

      if (shouldReplaceOld) {
        await connection.query(
          `
          INSERT INTO Notifications
          (
            receiverId,
            documentId,
            feedbackId,
            title,
            message,
            type
          )
          VALUES (
            ?,
            ?,
            NULL,
            ?,
            ?,
            'document_replaced'
          )
          `,
          [
            uploaderId,
            documentId,

            "Document replaced",

            `File ${fileName} replaced the old document.`,
          ],
        );
      }

      await safeNotifyTeacherUpload(
        connection,
        uploadedBy,
        documentId,
        fileName,
      );

      await connection.commit();

      if (shouldReplaceOld) {
        await safeDeleteVectors(
          replaceTargetDocumentId,
        );
      }

      documents.push({
        documentId,
        fileName,
        fileUrl,
        fileSizeBytes,
        contentHash,
        uploadedBy,
        reviewStatus,
        ...metadata,
        versionGroupId,
        versionNo,
        vectorDocumentId,
        isDuplicate: false,
        originalDocumentId,

        createdAt:
          new Date().toISOString(),
      });

      cleanupFile(
        req.file.path,
      );

      return res.json({
        success: true,

        duplicate:
          Boolean(
            duplicateInfo,
          ),

        needConfirm: false,

        versionCreated:
          shouldReplaceOld,

        replacedOld:
          shouldReplaceOld,

        replacedDocumentId:
          shouldReplaceOld
            ? replaceTargetDocumentId
            : null,

        duplicateType:
          duplicateInfo
            ?.duplicateScope ||
          null,

        message:
          shouldReplaceOld
            ? `Replaced old file with "${fileName}" successfully.`
            : `Uploaded "${fileName}" successfully.`,

        documentId,
        fileName,
        fileType,
        fileUrl,
        fileSizeBytes,
        contentHash,
        uploadedBy,
        reviewStatus,
        ...metadata,
        versionGroupId,
        versionNo,
        vectorDocumentId,
        isDuplicate: false,
        originalDocumentId,
        totalChunks,
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (
          rollbackError
        ) {
          console.log(
            "Rollback failed:",
            rollbackError.message,
          );
        }
      }

      console.log(error);

      cleanupFile(
        req.file?.path,
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Upload failed",
          detail:
            error.message,
        });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },
);

export default router;