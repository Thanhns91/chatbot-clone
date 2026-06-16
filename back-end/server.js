import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";

import pool from "./db.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { createCollection } from "./qdrant.js";
import documentRoutes from "./routes/documentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatHistoryRoutes from "./routes/chatHistoryRoutes.js";
import swaggerSpec from "./swagger.js";


dotenv.config();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/swagger.json", (req, res) => {
  res.json(swaggerSpec);
});

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  try {
    await createCollection();
    console.log("Qdrant collection ready");
  } catch (error) {
    console.log("Qdrant init failed:", error.message);
  }

  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger docs: /api-docs`);
});
