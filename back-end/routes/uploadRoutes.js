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

    if (decoded.includes("�")) {
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
  const normalizedText = normalizeTextForHash(text);

  return crypto
    .createHash("sha256")
    .update(normalizedText, "utf8")
    .digest("hex");
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
    return pdfData.text;
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
      AND contentHash = ?
    ORDER BY isDuplicate ASC, versionNo ASC, uploadDate ASC
    LIMIT 1
    `,
    [contentHash],
  );

  if (existingDocs.length === 0) {
    return null;
  }

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

async function notifyStudentsAboutTeacherUpload(documentId, fileName) {
  if (!documentId) return;

  const [students] = await pool.query(
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
    "New teacher material uploaded",
    `Teacher uploaded a new file: ${fileName}`,
    "student_upload",
  ]);

  await pool.query(
    `
    INSERT INTO Notifications
    (
      receiverId,
      documentId,
      title,
      message,
      type
    )
    VALUES ?
    `,
    [values],
  );
}

async function safeNotifyTeacherUpload(uploadedBy, documentId, fileName) {
  if (uploadedBy !== "teacher") return;

  try {
    await notifyStudentsAboutTeacherUpload(documentId, fileName);
  } catch (notifyError) {
    console.log("Create notification failed:", notifyError.message);
  }
}

router.post("/", upload.single("file"), async (req, res) => {
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
    const allowVersion =
      req.body.allowVersion === "true" || req.body.allowVersion === true;

    const documentId = uuidv4();

    const text = await extractText(req.file.path, fileName);

    if (!text || text.trim().length === 0) {
      throw new Error("Cannot extract text from this file.");
    }

    const contentHash = createContentHash(text);
    const duplicateInfo = await getDuplicateInfo(contentHash);

    if (duplicateInfo) {
      const {
        originalDoc,
        versionGroupId,
        vectorDocumentId,
        originalDocumentId,
        nextVersion,
      } = duplicateInfo;

      if (!allowVersion) {
        cleanupFile(req.file.path);

        return res.json({
          success: true,
          duplicate: true,
          needConfirm: true,
          versionCreated: false,
          duplicateType: "content",
          message: `File content already exists. Do you want to save it as Version ${nextVersion}?`,
          currentFileName: fileName,
          existingFileName: originalDoc.fileName,
          nextVersion,
          versionGroupId,
          vectorDocumentId,
          originalDocumentId,
        });
      }

      const fileUrl = await uploadDocumentToCloudinary(
        req.file.path,
        documentId,
        fileName,
      );

      const [insertResult] = await pool.query(
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
          versionGroupId,
          versionNo,
          vectorDocumentId,
          isDuplicate,
          originalDocumentId
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, NULL, ?, ?, ?, TRUE, ?)
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
          versionGroupId,
          nextVersion,
          vectorDocumentId,
          originalDocumentId,
        ],
      );

      

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
        versionGroupId,
        versionNo: nextVersion,
        vectorDocumentId,
        isDuplicate: true,
        originalDocumentId,
        totalChunks: 0,
      });
    }

    const versionGroupId = documentId;
    const versionNo = 1;
    const vectorDocumentId = documentId;
    const isDuplicate = false;
    const originalDocumentId = null;

    const chunks = semanticChunk(text);

    if (!chunks || chunks.length === 0) {
      throw new Error("Cannot create chunks from this document.");
    }

    const fileUrl = await uploadDocumentToCloudinary(
      req.file.path,
      documentId,
      fileName,
    );

    const points = [];

    for (let i = 0; i < chunks.length; i++) {
      const vector = await embedText(chunks[i]);

      points.push({
        id: uuidv4(),
        vector,
        payload: {
          documentId,
          vectorDocumentId,
          fileName,
          uploadedBy,
          uploaderId,
          text: chunks[i],
          chunkIndex: i,
        },
      });
    }

    await qdrant.upsert(COLLECTION_NAME, {
      points,
    });

    const [insertResult] = await pool.query(
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
        versionGroupId,
        versionNo,
        vectorDocumentId,
        isDuplicate,
        originalDocumentId
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?, ?)
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
        versionGroupId,
        versionNo,
        vectorDocumentId,
        isDuplicate,
        originalDocumentId,
      ],
    );

    

    await safeNotifyTeacherUpload(uploadedBy, documentId, fileName);

    documents.push({
      documentId,
      fileName,
      fileUrl,
      contentHash,
      uploadedBy,
      reviewStatus,
      versionGroupId,
      versionNo,
      vectorDocumentId,
      isDuplicate,
      originalDocumentId,
      createdAt: new Date().toISOString(),
    });

    cleanupFile(req.file.path);

    return res.json({
      success: true,
      duplicate: false,
      needConfirm: false,
      versionCreated: false,
      message: `Uploaded "${fileName}" successfully.`,
      documentId,
      fileName,
      fileType,
      fileUrl,
      contentHash,
      uploadedBy,
      reviewStatus,
      versionGroupId,
      versionNo,
      vectorDocumentId,
      isDuplicate,
      originalDocumentId,
      totalChunks: chunks.length,
    });
  } catch (error) {
    console.log(error);

    cleanupFile(req.file?.path);

    return res.status(500).json({
      success: false,
      error: "Upload failed",
      detail: error.message,
    });
  }
});

export default router;