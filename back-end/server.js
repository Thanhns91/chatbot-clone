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
import feedbackRoutes from "./routes/feedbackRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL,
  process.env.PUBLIC_API_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/swagger.json", (req, res) => {
  res.json(swaggerSpec);
});

app.get("/", (req, res) => {
  res.send("Backend Hugging Face RAG running");
});

app.use("/upload", uploadRoutes);
app.use("/chat", chatRoutes);
app.use("/documents", documentRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/chat-history", chatHistoryRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/notifications", notificationRoutes);
app.use("/reports", reportRoutes);
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