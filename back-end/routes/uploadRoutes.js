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

async function uploadToCloudinary(filePath, fileName) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  const nameOnly = path.parse(fileName).name.replace(/[^\w-]+/g, "-");
  const publicId = `${Date.now()}-${uuidv4()}-${nameOnly}`;

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

    
      if (existingDocs.length > 0) {
        const originalDoc = existingDocs[0];

        const versionGroupId =
          originalDoc.versionGroupId || originalDoc.documentId;

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

        const versionNo = Number(versionRows[0]?.nextVersion || 2);

        const fileUrl = await uploadToCloudinary(req.file.path, fileName);

        await pool.query(
          `
          INSERT INTO Documents
          (
            documentId,
            fileName,
            fileType,
            fileUrl,
            uploaderId,
            uploadedBy,
            uploadStatus,
            reviewStatus,
            errorMessage,
            contentHash,
            versionGroupId,
            versionNo,
            vectorDocumentId,
            isDuplicate,
            originalDocumentId
          )
          VALUES (?, ?, ?, ?, ?, ?, 'success', ?, NULL, ?, ?, ?, ?, TRUE, ?)
          `,
          [
            documentId,
            fileName,
            fileType,
            fileUrl,
            uploaderId,
            uploadedBy,
            reviewStatus,
            contentHash,
            versionGroupId,
            versionNo,
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
          versionNo,
          isDuplicate: true,
          vectorDocumentId,
          createdAt: new Date().toISOString(),
        });

        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.json({
          success: true,
          duplicate: true,
          versionCreated: true,
          duplicateType: "content",
          message: `File already exists. Saved as Version ${versionNo}.`,
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
          isDuplicate: true,
          originalDocumentId,
          totalChunks: 0,
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

      const fileUrl = await uploadToCloudinary(req.file.path, fileName);

      await pool.query(
        `
        INSERT INTO Documents
        (
          documentId,
          fileName,
          fileType,
          fileUrl,
          uploaderId,
          uploadedBy,
          uploadStatus,
          reviewStatus,
          errorMessage,
          contentHash,
          versionGroupId,
          versionNo,
          vectorDocumentId,
          isDuplicate,
          originalDocumentId
        )
        VALUES (?, ?, ?, ?, ?, ?, 'success', ?, NULL, ?, ?, 1, ?, FALSE, NULL)
        `,
        [
          documentId,
          fileName,
          fileType,
          fileUrl,
          uploaderId,
          uploadedBy,
          reviewStatus,
          contentHash,
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
        versionNo: 1,
        isDuplicate: false,
        vectorDocumentId: documentId,
        createdAt: new Date().toISOString(),
      });

      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.json({
        success: true,
        duplicate: false,
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

      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        success: false,
        error: "Upload failed",
        detail: error.message,
      });
    }
  });
});

export default router;