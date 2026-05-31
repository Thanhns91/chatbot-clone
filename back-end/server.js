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

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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


