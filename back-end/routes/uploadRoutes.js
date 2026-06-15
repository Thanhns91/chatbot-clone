import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { qdrant, COLLECTION_NAME } from "../qdrant.js";
import { semanticChunk } from "../chunking.js";
import { embedText } from "../huggingface.js";
import cloudinary from "../cloudinary.js";

const router = express.Router();

export const documents = [];

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExtensions = [".pdf", ".doc", ".docx"];

const isAllowedFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return allowedExtensions.includes(ext);
};

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

  fileFilter: (req, file, cb) => {
    if (!isAllowedFile(file)) {
      return cb(
        new Error("Chỉ cho phép upload file PDF, DOC, DOCX. Không hỗ trợ Excel.")
      );
    }

    cb(null, true);
  },
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
  }

  if (ext === "doc") {
    throw new Error("File .doc chưa hỗ trợ đọc nội dung. Hãy đổi sang .docx.");
  }

  throw new Error("Unsupported file type");
}

function createContentHash(text) {
  const normalizedText = text.replace(/\s+/g, " ").trim().toLowerCase();

  return crypto
    .createHash("sha256")
    .update(normalizedText, "utf8")
    .digest("hex");
}

async function uploadToCloudinary(filePath, fileName) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  const publicId = `${Date.now()}-${uuidv4()}-${path.parse(fileName).name}`;

  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "raw",
    folder: "chatbot-documents",
    public_id: publicId,
    use_filename: true,
    unique_filename: true,
    format: ext,
  });

  return result.secure_url;
}

router.post("/", (req, res) => {
  upload.single("file")(req, res, async (multerError) => {
    if (multerError) {
      return res.status(400).json({
        success: false,
        error: "Upload failed",
        detail: multerError.message,
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      const fileName = req.file.originalname;
      const ext = path.extname(fileName).toLowerCase();

      if (!allowedExtensions.includes(ext)) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          success: false,
          error: "Invalid file type",
          detail: "Chỉ cho phép upload file PDF, DOC, DOCX. Không hỗ trợ Excel.",
        });
      }

      const documentId = uuidv4();
      const fileType = req.file.mimetype;
      const uploadedBy = req.body.uploadedBy || "student";
      const uploaderId = Number(req.body.uploaderId) || 1;

      const reviewStatus = uploadedBy === "teacher" ? "approved" : "private";

      const text = await extractText(req.file.path, fileName);

      if (!text || !text.trim()) {
        throw new Error("Không đọc được nội dung file.");
      }

      const contentHash = createContentHash(text);

      console.log("UPLOAD FILE:", fileName);
      console.log("CONTENT HASH:", contentHash);

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
        LIMIT 1
        `,
        [fileName, contentHash]
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
            uploadedBy,
            text: chunks[i],
            chunkIndex: i,
          },
        });
      }

      await qdrant.upsert(COLLECTION_NAME, {
        points,
      });

      const fileUrl = await uploadToCloudinary(req.file.path, fileName);

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
});

export default router;