import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { createCollection } from "./qdrant.js";
import documentRoutes from "./routes/documentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatHistoryRoutes from "./routes/chatHistoryRoutes.js";

import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// Cho phép mở file trong thư mục uploads bằng link
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/upload", uploadRoutes);
app.use("/chat", chatRoutes);
app.use("/documents", documentRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/chat-history", chatHistoryRoutes);

app.get("/", (req, res) => {
  res.send("Backend Hugging Face RAG running");
});

try {
  const connection = await pool.getConnection();
  console.log("MySQL Connected");
  connection.release();
} catch (error) {
  console.log("MySQL Error");
  console.log(error);
}

app.listen(3000, async () => {
  await createCollection();
  console.log("Server running at http://localhost:3000");
});