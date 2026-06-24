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
import { qdrant, COLLECTION_NAME } from "../qdrant.js";
import { semanticChunk } from "../chunking.js";
import { embedText } from "../huggingface.js";

const router = express.Router();

export const documents = [];

const upload = multer({
  dest: "uploads/",
});

function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.log("Cleanup file failed:", error.message);
  }
}

function fixFileNameEncoding(fileName = "") {
  try {
    const decoded = Buffer.from(fileName, "latin1").toString("utf8");

    if (decoded.includes(" ")) return fileName;

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
  const normalizedText = normalizeTextForHash(text);

  return crypto
    .createHash("sha256")
    .update(normalizedText, "utf8")
    .digest("hex");
}

function parseNullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}


async function uploadDocumentToCloudinary(filePath, documentId, fileName) {
  const safeName =
    fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w-]+/g, "-")
      .slice(0, 80) || "document";

  const result = await cloudinary.uploader.upload(filePath, {
    folder: "ai-learning/documents",
    resource_type: "raw",
    public_id: `${documentId}-${safeName}`,
    use_filename: false,
    unique_filename: false,
    overwrite: true,
    filename_override: fileName,
  });

  return result.secure_url;
}

async function extractText(filePath, originalName) {
  const ext = originalName.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    const fileBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: fileBuffer });
    const pdfData = await parser.getText();

    const rawText = pdfData.text || "";
    const formFeedPages = rawText.split(/\f+/).filter(Boolean);

    if (formFeedPages.length > 1) {
      return formFeedPages
        .map((pageText, index) => `\n\nPAGE ${index + 1}\n${pageText}`)
        .join("\n\n");
    }

    return `\n\nPAGE 1\n${rawText}`;
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({
      path: filePath,
    });

    return result.value;
  }

  if (ext === "xlsx" || ext === "xls") {
    const workbook = xlsx.readFile(filePath);
    let text = "";

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];

      const rows = xlsx.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      text += `\nSheet: ${sheetName}\n`;

      rows.forEach((row) => {
        text += row.join(" | ") + "\n";
      });
    });

    return text;
  }

  throw new Error("Unsupported file type");
}

async function getUploaderInfo(uploaderId) {
  const [userRows] = await pool.query(
    `
    SELECT userId, fullName, role, status
    FROM Users
    WHERE userId = ?
    LIMIT 1
    `,
    [uploaderId],
  );

  return userRows[0] || null;
}

async function getDuplicateInfo(contentHash) {
  const [existingDocs] = await pool.query(
    `
    SELECT
      documentId,
      fileName,
      fileType,
      fileUrl,
      contentHash,
      versionGroupId,
      versionNo,
      vectorDocumentId,
      originalDocumentId,
      uploaderId,
      uploadedBy,
      reviewStatus,
      uploadDate
    FROM Documents
    WHERE uploadStatus = 'success'
      AND isDeleted = FALSE
      AND contentHash = ?
    ORDER BY isDuplicate ASC, versionNo ASC, uploadDate ASC
    LIMIT 1
    `,
    [contentHash],
  );

  if (existingDocs.length === 0) return null;

  const originalDoc = existingDocs[0];

  const versionGroupId = originalDoc.versionGroupId || originalDoc.documentId;
  const vectorDocumentId =
    originalDoc.vectorDocumentId || originalDoc.documentId;
  const originalDocumentId =
    originalDoc.originalDocumentId || originalDoc.documentId;

  const [versionRows] = await pool.query(
    `
    SELECT COALESCE(MAX(versionNo), 0) + 1 AS nextVersion
    FROM Documents
    WHERE versionGroupId = ?
    `,
    [versionGroupId],
  );

  return {
    originalDoc,
    versionGroupId,
    vectorDocumentId,
    originalDocumentId,
    nextVersion: Number(versionRows[0]?.nextVersion || 2),
  };
}


function normalizeForMeta(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMetadataCandidate(text, values = []) {
  const haystack = normalizeForMeta(text);

  return values.reduce((score, value) => {
    const keyword = normalizeForMeta(value);
    if (!keyword) return score;

    if (haystack.includes(keyword)) return score + Math.max(3, keyword.length);

    return score;
  }, 0);
}

function getFirstTextSummary(text = "", fileName = "") {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/PAGE\s+\d+/gi, "")
    .trim();

  if (!cleaned) return `Auto metadata for ${fileName}`;

  return cleaned.length > 240 ? `${cleaned.slice(0, 240).trim()}...` : cleaned;
}

function buildAutoTags({ subject, topic, documentType, level, fileName }) {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase();
  const tags = [
    subject?.subjectCode,
    subject?.subjectName,
    topic?.topicName,
    documentType?.typeName,
    level?.levelName,
    ext,
  ]
    .filter(Boolean)
    .map((item) => String(item).trim())
    .filter(Boolean);

  return [...new Set(tags)].slice(0, 8).join(", ");
}

function pickBestSubject(subjects, fileName, text) {
  if (!subjects.length) return null;

  const source = `${fileName}\n${String(text || "").slice(0, 5000)}`;

  const scored = subjects
    .map((subject) => ({
      subject,
      score: scoreMetadataCandidate(source, [
        subject.subjectCode,
        subject.subjectName,
        subject.description,
      ]),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].subject : subjects[0];
}

function pickBestTopic(topics, subjectId, fileName, text) {
  const subjectTopics = topics.filter(
    (topic) => String(topic.subjectId) === String(subjectId),
  );

  if (!subjectTopics.length) return null;

  const source = `${fileName}\n${String(text || "").slice(0, 5000)}`;

  const scored = subjectTopics
    .map((topic) => ({
      topic,
      score: scoreMetadataCandidate(source, [topic.topicName, topic.description]),
    }))
    .sort((a, b) => b.score - a.score);

  const uncategorized = subjectTopics.find((topic) =>
    normalizeForMeta(topic.topicName).includes("uncategorized"),
  );

  return scored[0]?.score > 0 ? scored[0].topic : uncategorized || subjectTopics[0];
}

function pickBestDocumentType(documentTypes, fileName, uploadedBy) {
  if (!documentTypes.length) return null;

  const name = normalizeForMeta(fileName);

  const typeHints = [
    { keys: ["assignment", "bai tap", "homework", "exercise", "submission"], name: "Assignment" },
    { keys: ["slide", "ppt", "pptx", "presentation"], name: "Slide" },
    { keys: ["case", "case study"], name: "Case Study" },
    { keys: ["research", "paper", "journal"], name: "Research Paper" },
    { keys: ["reference", "tham khao", "ref"], name: "Reference" },
    { keys: ["lecture", "lesson", "bai giang", "material"], name: "Lecture" },
  ];

  const matchedHint = typeHints.find((hint) => hint.keys.some((key) => name.includes(key)));

  const wantedName = matchedHint?.name || (uploadedBy === "student" ? "Assignment" : "Lecture");

  return (
    documentTypes.find(
      (type) => normalizeForMeta(type.typeName) === normalizeForMeta(wantedName),
    ) || documentTypes[0]
  );
}

function pickBestLevel(documentLevels, text) {
  if (!documentLevels.length) return null;

  const content = normalizeForMeta(text);
  const advancedWords = ["advanced", "nang cao", "architecture", "evaluation", "optimization", "research"];
  const beginnerWords = ["basic", "intro", "introduction", "co ban", "overview", "tong quan"];

  let wantedName = "Intermediate";

  if (advancedWords.some((word) => content.includes(normalizeForMeta(word)))) {
    wantedName = "Advanced";
  } else if (beginnerWords.some((word) => content.includes(normalizeForMeta(word)))) {
    wantedName = "Beginner";
  }

  return (
    documentLevels.find(
      (level) => normalizeForMeta(level.levelName) === normalizeForMeta(wantedName),
    ) || documentLevels[0]
  );
}

async function autoFillMetadata(metadata, { text, fileName, uploadedBy }) {
  const [subjects] = await pool.query(`
    SELECT subjectId, subjectCode, subjectName, description
    FROM Subjects
    ORDER BY subjectCode, subjectName
  `);

  const [topics] = await pool.query(`
    SELECT topicId, subjectId, topicName, description
    FROM Topics
    ORDER BY topicName
  `);

  const [documentTypes] = await pool.query(`
    SELECT documentTypeId, typeName, description
    FROM DocumentTypes
    ORDER BY typeName
  `);

  const [documentLevels] = await pool.query(`
    SELECT levelId, levelName, description
    FROM DocumentLevels
    ORDER BY levelId
  `);

  const selectedSubject = metadata.subjectId
    ? subjects.find((subject) => String(subject.subjectId) === String(metadata.subjectId))
    : pickBestSubject(subjects, fileName, text);

  const subjectId = metadata.subjectId || selectedSubject?.subjectId || null;

  const selectedTopic = metadata.topicId
    ? topics.find((topic) => String(topic.topicId) === String(metadata.topicId))
    : pickBestTopic(topics, subjectId, fileName, text);

  const selectedType = metadata.documentTypeId
    ? documentTypes.find(
        (type) => String(type.documentTypeId) === String(metadata.documentTypeId),
      )
    : pickBestDocumentType(documentTypes, fileName, uploadedBy);

  const selectedLevel = metadata.levelId
    ? documentLevels.find((level) => String(level.levelId) === String(metadata.levelId))
    : pickBestLevel(documentLevels, text);

  return {
    subjectId,
    topicId: metadata.topicId || selectedTopic?.topicId || null,
    documentTypeId: metadata.documentTypeId || selectedType?.documentTypeId || null,
    levelId: metadata.levelId || selectedLevel?.levelId || null,
    tags:
      metadata.tags ||
      buildAutoTags({
        subject: selectedSubject,
        topic: selectedTopic,
        documentType: selectedType,
        level: selectedLevel,
        fileName,
      }),
    summary: metadata.summary || getFirstTextSummary(text, fileName),
  };
}

async function validateMetadata({ subjectId, topicId, documentTypeId, levelId }) {
  if (subjectId) {
    const [rows] = await pool.query(
      "SELECT subjectId FROM Subjects WHERE subjectId = ? LIMIT 1",
      [subjectId],
    );
    if (rows.length === 0) throw new Error("Invalid subjectId");
  }

  if (topicId) {
    const [rows] = await pool.query(
      `
      SELECT topicId
      FROM Topics
      WHERE topicId = ?
        AND (? IS NULL OR subjectId = ?)
      LIMIT 1
      `,
      [topicId, subjectId, subjectId],
    );
    if (rows.length === 0) throw new Error("Invalid topicId");
  }

  if (documentTypeId) {
    const [rows] = await pool.query(
      "SELECT documentTypeId FROM DocumentTypes WHERE documentTypeId = ? LIMIT 1",
      [documentTypeId],
    );
    if (rows.length === 0) throw new Error("Invalid documentTypeId");
  }

  if (levelId) {
    const [rows] = await pool.query(
      "SELECT levelId FROM DocumentLevels WHERE levelId = ? LIMIT 1",
      [levelId],
    );
    if (rows.length === 0) throw new Error("Invalid levelId");
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
    VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)
    `,
    [
      documentId,
      versionGroupId,
      versionNo,
      contentHash,
      vectorDocumentId,
      actionType,
      replacedDocumentId || null,
      createdBy || null,
    ],
  );
}

async function insertStudentActivity(
  connection,
  { userId, activityType, documentId, subjectId, topicId, metadata },
) {
  if (!userId || !activityType) return;

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
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

async function notifyStudentsAboutTeacherUpload(connection, documentId, fileName) {
  if (!documentId) return;

  const [students] = await connection.query(
    `
    SELECT userId
    FROM Users
    WHERE role = 'student'
      AND status = 'active'
    `,
  );

  if (students.length === 0) return;

  const values = students.map((student) => [
    student.userId,
    documentId,
    null,
    "New teacher material uploaded",
    `Teacher uploaded a new file: ${fileName}`,
    "student_upload",
  ]);

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

async function safeNotifyTeacherUpload(connection, uploadedBy, documentId, fileName) {
  if (uploadedBy !== "teacher") return;

  try {
    await notifyStudentsAboutTeacherUpload(connection, documentId, fileName);
  } catch (notifyError) {
    console.log("Create notification failed:", notifyError.message);
  }
}

async function safeDeleteVectors(documentId) {
  if (!documentId) return;

  try {
    await qdrant.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        should: [
          {
            key: "documentId",
            match: {
              value: documentId,
            },
          },
          {
            key: "vectorDocumentId",
            match: {
              value: documentId,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.log("Delete Qdrant vectors failed:", error.message);
  }
}

async function upsertDocumentVectors({ chunks, documentId, fileName, uploadedBy, uploaderId, metadata }) {
  const points = [];

  for (let i = 0; i < chunks.length; i++) {
    const vector = await embedText(chunks[i]);

    points.push({
      id: uuidv4(),
      vector,
      payload: {
        documentId,
        vectorDocumentId: documentId,
        fileName,
        uploadedBy,
        uploaderId,
        text: chunks[i],
        chunkIndex: i,
        subjectId: metadata.subjectId || null,
        topicId: metadata.topicId || null,
        documentTypeId: metadata.documentTypeId || null,
        levelId: metadata.levelId || null,
      },
    });
  }

  await qdrant.upsert(COLLECTION_NAME, {
    points,
  });

  return points.length;
}

router.post("/", upload.single("file"), async (req, res) => {
  let connection;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const fileName = fixFileNameEncoding(req.file.originalname);
    const fileType = req.file.mimetype;
    const uploaderId = Number(req.body.uploaderId);

    if (!uploaderId) {
      cleanupFile(req.file.path);

      return res.status(400).json({
        success: false,
        error: "Missing uploaderId",
      });
    }

    const uploader = await getUploaderInfo(uploaderId);

    if (!uploader) {
      cleanupFile(req.file.path);

      return res.status(404).json({
        success: false,
        error: "Uploader not found",
      });
    }

    if (uploader.status === "blocked") {
      cleanupFile(req.file.path);

      return res.status(403).json({
        success: false,
        error: "Your account is blocked",
      });
    }

    if (uploader.role === "admin") {
      cleanupFile(req.file.path);

      return res.status(403).json({
        success: false,
        error: "Admin is not allowed to upload documents",
      });
    }

    const uploadedBy = uploader.role;
    const reviewStatus = uploadedBy === "teacher" ? "approved" : "private";

    let metadata = {
      subjectId: parseNullableNumber(req.body.subjectId),
      topicId: parseNullableNumber(req.body.topicId),
      documentTypeId: parseNullableNumber(req.body.documentTypeId),
      levelId: parseNullableNumber(req.body.levelId),
      tags: req.body.tags || null,
      summary: req.body.summary || null,
    };

    const allowVersion =
      req.body.allowVersion === "true" || req.body.allowVersion === true;

    const duplicateAction =
      req.body.duplicateAction || (allowVersion ? "new_version" : "");

    const replaceDocumentId = req.body.replaceDocumentId || null;

    const documentId = uuidv4();

    const text = await extractText(req.file.path, fileName);

    if (!text || text.trim().length === 0) {
      throw new Error("Cannot extract text from this file.");
    }

    metadata = await autoFillMetadata(metadata, {
      text,
      fileName,
      uploadedBy,
    });

    await validateMetadata(metadata);

    const contentHash = createContentHash(text);
    const duplicateInfo = await getDuplicateInfo(contentHash);

    if (duplicateInfo && !duplicateAction) {
      cleanupFile(req.file.path);

      return res.json({
        success: true,
        duplicate: true,
        needConfirm: true,
        versionCreated: false,
        duplicateType: "content",
        message: "File content already exists. Choose how you want to continue.",
        actions: [
          {
            key: "new_version",
            label: `Save as Version ${duplicateInfo.nextVersion}`,
          },
          {
            key: "replace_old",
            label: "Replace old file",
          },
        ],
        currentFileName: fileName,
        existingDocumentId: duplicateInfo.originalDoc.documentId,
        existingFileName: duplicateInfo.originalDoc.fileName,
        nextVersion: duplicateInfo.nextVersion,
        versionGroupId: duplicateInfo.versionGroupId,
        vectorDocumentId: duplicateInfo.vectorDocumentId,
        originalDocumentId: duplicateInfo.originalDocumentId,
      });
    }

    const fileUrl = await uploadDocumentToCloudinary(
      req.file.path,
      documentId,
      fileName,
    );

    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (duplicateInfo && duplicateAction === "new_version") {
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
          contentHash,
          uploaderId,
          uploadedBy,
          uploadStatus,
          reviewStatus,
          errorMessage,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
        `,
        [
          documentId,
          fileName,
          fileType,
          fileUrl,
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
          nextVersion,
          vectorDocumentId,
          originalDocumentId,
        ],
      );

      await insertDocumentVersion(connection, {
        documentId,
        versionGroupId,
        versionNo: nextVersion,
        contentHash,
        vectorDocumentId,
        actionType: "new_version",
        replacedDocumentId: null,
        createdBy: uploaderId,
      });


      if (uploadedBy === "student") {
        await insertStudentActivity(connection, {
          userId: uploaderId,
          activityType: "upload_document",
          documentId,
          subjectId: metadata.subjectId,
          topicId: metadata.topicId,
          metadata: {
            action: "new_version",
            fileName,
            versionNo: nextVersion,
          },
        });
      }

      await safeNotifyTeacherUpload(connection, uploadedBy, documentId, fileName);

      await connection.commit();

      cleanupFile(req.file.path);

      return res.json({
        success: true,
        duplicate: true,
        needConfirm: false,
        versionCreated: true,
        duplicateType: "content",
        message: `Saved as Version ${nextVersion}.`,
        documentId,
        fileName,
        fileType,
        fileUrl,
        contentHash,
        uploadedBy,
        reviewStatus,
        ...metadata,
        versionGroupId,
        versionNo: nextVersion,
        vectorDocumentId,
        isDuplicate: true,
        originalDocumentId,
        totalChunks: 0,
      });
    }

    const replaceTargetDocumentId =
      replaceDocumentId || duplicateInfo?.originalDoc?.documentId || null;

    const shouldReplaceOld = duplicateAction === "replace_old" && replaceTargetDocumentId;

    const versionGroupId = shouldReplaceOld
      ? duplicateInfo?.versionGroupId || replaceTargetDocumentId
      : documentId;

    const versionNo = shouldReplaceOld ? duplicateInfo?.nextVersion || 2 : 1;
    const vectorDocumentId = documentId;
    const originalDocumentId = shouldReplaceOld
      ? duplicateInfo?.originalDocumentId || replaceTargetDocumentId
      : null;

    const chunks = semanticChunk(text);

    if (!chunks || chunks.length === 0) {
      throw new Error("Cannot create chunks from this document.");
    }

    const totalChunks = await upsertDocumentVectors({
      chunks,
      documentId,
      fileName,
      uploadedBy,
      uploaderId,
      metadata,
    });

    if (shouldReplaceOld) {
      await connection.query(
        `
        UPDATE Documents
        SET isDeleted = TRUE,
            deletedAt = NOW(),
            replacedByDocumentId = ?
        WHERE documentId = ?
        `,
        [documentId, replaceTargetDocumentId],
      );

      await connection.query(
        `
        UPDATE DocumentVersions
        SET isCurrent = FALSE
        WHERE documentId = ?
           OR versionGroupId = ?
        `,
        [replaceTargetDocumentId, versionGroupId],
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        documentId,
        fileName,
        fileType,
        fileUrl,
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

    await insertDocumentVersion(connection, {
      documentId,
      versionGroupId,
      versionNo,
      contentHash,
      vectorDocumentId,
      actionType: shouldReplaceOld ? "replace_old" : "original",
      replacedDocumentId: shouldReplaceOld ? replaceTargetDocumentId : null,
      createdBy: uploaderId,
    });


    if (uploadedBy === "student") {
      await insertStudentActivity(connection, {
        userId: uploaderId,
        activityType: "upload_document",
        documentId,
        subjectId: metadata.subjectId,
        topicId: metadata.topicId,
        metadata: {
          action: shouldReplaceOld ? "replace_old" : "original",
          fileName,
          versionNo,
        },
      });
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
        VALUES (?, ?, NULL, ?, ?, 'document_replaced')
        `,
        [
          uploaderId,
          documentId,
          "Document replaced",
          `File ${fileName} replaced the old document.`,
        ],
      );
    }

    await safeNotifyTeacherUpload(connection, uploadedBy, documentId, fileName);

    await connection.commit();

    if (shouldReplaceOld) {
      await safeDeleteVectors(replaceTargetDocumentId);
    }

    documents.push({
      documentId,
      fileName,
      fileUrl,
      contentHash,
      uploadedBy,
      reviewStatus,
      ...metadata,
      versionGroupId,
      versionNo,
      vectorDocumentId,
      isDuplicate: false,
      originalDocumentId,
      createdAt: new Date().toISOString(),
    });

    cleanupFile(req.file.path);

    return res.json({
      success: true,
      duplicate: Boolean(duplicateInfo),
      needConfirm: false,
      versionCreated: shouldReplaceOld || false,
      replacedOld: shouldReplaceOld,
      duplicateType: duplicateInfo ? "content" : null,
      message: shouldReplaceOld
        ? `Replaced old file with "${fileName}" successfully.`
        : `Uploaded "${fileName}" successfully.`,
      documentId,
      fileName,
      fileType,
      fileUrl,
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
      } catch (rollbackError) {
        console.log("Rollback failed:", rollbackError.message);
      }
    }

    console.log(error);
    cleanupFile(req.file?.path);

    return res.status(500).json({
      success: false,
      error: "Upload failed",
      detail: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

export default router;