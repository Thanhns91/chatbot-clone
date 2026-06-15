import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import xlsx from "xlsx";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { qdrant, COLLECTION_NAME } from "../qdrant.js";
import { semanticChunk } from "../chunking.js";
import { embedText } from "../huggingface.js";

const router = express.Router();

export const documents = [];

// Tạo thư mục uploads nếu chưa có
const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Lưu file với tên an toàn
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeFileName = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, safeFileName);
  },
});

const upload = multer({
  storage,
});

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
    

    return text;
  }

  throw new Error("Unsupported file type");
}

function createContentHash(text) {
  const normalizedText = text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return crypto
    .createHash("sha256")
    .update(normalizedText, "utf8")
    .digest("hex");
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const documentId = uuidv4();

    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const savedFileName = req.file.filename;
    const fileUrl = `/uploads/${savedFileName}`;

    const uploadedBy = req.body.uploadedBy || "student";
    const uploaderId = Number(req.body.uploaderId) || 1;

    const reviewStatus = uploadedBy === "teacher" ? "approved" : "private";

    // Đọc nội dung file trước để check trùng nội dung
    const text = await extractText(req.file.path, fileName);

    if (!text || !text.trim()) {
      throw new Error("Không đọc được nội dung file.");
    }

    const contentHash = createContentHash(text);

    // Check trùng theo tên file hoặc nội dung file
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
          fileName = ?
          OR contentHash = ?
        )
        AND (
          uploaderId = ?
          OR (uploadedBy = 'teacher' AND reviewStatus = 'approved')
        )
      LIMIT 1
      `,
      [fileName, contentHash, uploaderId]
    );

    if (existingDocs.length > 0) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      const isSameContent = existingDocs[0].contentHash === contentHash;

      return res.status(409).json({
        success: false,
        duplicate: true,
        duplicateType: isSameContent ? "content" : "filename",
        message: isSameContent
          ? "File có nội dung trùng với tài liệu đã có trong thư viện."
          : "File đã có sẵn trong thư viện.",
        document: existingDocs[0],
      });
    }

    const chunks = semanticChunk(text);

    if (!chunks || chunks.length === 0) {
      throw new Error("Không tạo được chunk từ tài liệu.");
    }

    const points = [];

    for (let i = 0; i < chunks.length; i++) {
      const vector = await embedText(chunks[i]);

      points.push({
        id: uuidv4(),
        vector,
        payload: {
          documentId,
          fileName,
          fileUrl,
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
      ]
    );

    documents.push({
      documentId,
      fileName,
      fileUrl,
      contentHash,
      uploadedBy,
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Upload success",
      documentId,
      fileName,
      fileType,
      fileUrl,
      contentHash,
      uploadedBy,
      reviewStatus,
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