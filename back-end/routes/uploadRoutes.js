import express from "express";
import multer from "multer";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { v4 as uuidv4 } from "uuid";

import { qdrant, COLLECTION_NAME } from "../qdrant.js";
import { semanticChunk } from "../chunking.js";
import { embedText } from "../huggingface.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const fileBuffer = fs.readFileSync(req.file.path);

    const parser = new PDFParse({
      data: fileBuffer,
    });

    const pdfData = await parser.getText();
    const text = pdfData.text;

    const chunks = semanticChunk(text);
    const documentId = uuidv4();

    const points = [];

    for (let i = 0; i < chunks.length; i++) {
      const vector = await embedText(chunks[i]);

      points.push({
        id: uuidv4(),
        vector,
        payload: {
          documentId,
          fileName: req.file.originalname,
          text: chunks[i],
          chunkIndex: i,
        },
      });
    }

    await qdrant.upsert(COLLECTION_NAME, {
      points,
    });

    fs.unlinkSync(req.file.path);

    res.json({
      message: "Upload success",
      documentId,
      totalChunks: chunks.length,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Upload failed",
      detail: error.message,
    });
  }
});

export default router;