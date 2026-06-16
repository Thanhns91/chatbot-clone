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
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
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
  const safeName = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w-]+/g, "-")
    .slice(0, 80);

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
    [contentHash]
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
    [versionGroupId]
  );

  return {
    originalDoc,
    versionGroupId,
    vectorDocumentId,
    originalDocumentId,
    nextVersion: Number(versionRows[0]?.nextVersion || 2),
  };
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const uploadedBy = req.body.uploadedBy || "student";
    const uploaderId = Number(req.body.uploaderId) || 1;
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
        fileName
      );

      await pool.query(
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
        ]
      );

      documents.push({
        documentId,
        fileName,
        fileUrl,
        contentHash,
        uploadedBy,
        reviewStatus,
        versionGroupId,
        versionNo: nextVersion,
        vectorDocumentId,
        isDuplicate: true,
        createdAt: new Date().toISOString(),
      });

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

    const chunks = semanticChunk(text);

    if (!chunks || chunks.length === 0) {
      throw new Error("Cannot create chunks from this document.");
    }

    const fileUrl = await uploadDocumentToCloudinary(
      req.file.path,
      documentId,
      fileName
    );

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
        },
      });
    }

    await qdrant.upsert(COLLECTION_NAME, {
      points,
    });

    await pool.query(
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, NULL, ?, 1, ?, FALSE, NULL)
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
        documentId,
        documentId,
      ]
    );

    documents.push({
      documentId,
      fileName,
      fileUrl,
      contentHash,
      uploadedBy,
      reviewStatus,
      versionGroupId: documentId,
      versionNo: 1,
      vectorDocumentId: documentId,
      isDuplicate: false,
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
      versionGroupId: documentId,
      versionNo: 1,
      vectorDocumentId: documentId,
      isDuplicate: false,
      originalDocumentId: null,
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