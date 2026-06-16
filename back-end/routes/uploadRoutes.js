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

function getContentHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function uploadDocumentToCloudinary(filePath, documentId, fileName) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "ai-learning/documents",
    resource_type: "raw",
    public_id: documentId,
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
    const uploaderId = req.body.uploaderId || 1;
    const reviewStatus = uploadedBy === "teacher" ? "approved" : "private";

    const contentHash = getContentHash(req.file.path);

    const [existingDocs] = await pool.query(
      `
      SELECT 
        documentId,
        fileName,
        fileType,
        fileUrl,
        contentHash,
        uploaderId,
        uploadedBy,
        reviewStatus,
        uploadDate
      FROM Documents
      WHERE uploadStatus = 'success'
        AND (
          contentHash = ?
          OR (
            fileName = ?
            AND (
              uploaderId = ?
              OR (uploadedBy = 'teacher' AND reviewStatus = 'approved')
            )
          )
        )
      LIMIT 1
      `,
      [contentHash, fileName, uploaderId],
    );

    if (existingDocs.length > 0) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(409).json({
        success: false,
        duplicate: true,
        message: "File đã có sẵn trong thư viện.",
        document: existingDocs[0],
      });
    }

    const text = await extractText(req.file.path, fileName);

    if (!text || text.trim().length === 0) {
      throw new Error("Cannot extract text from this file.");
    }

    const chunks = semanticChunk(text);
    const documentId = uuidv4();

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
          fileName,
          uploadedBy,
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
        reviewStatus
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?)
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
      ],
    );

    documents.push({
      documentId,
      fileName,
      fileUrl,
      uploadedBy,
      createdAt: new Date().toISOString(),
    });

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      message: "Upload success",
      documentId,
      fileName,
      fileType,
      fileUrl,
      uploadedBy,
      totalChunks: chunks.length,
    });
  } catch (error) {
    console.log(error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: "Upload failed",
      detail: error.message,
    });
  }
});

export default router;