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
import subscriptionRoutes from "./routes/subscriptionRoutes.js";

dotenv.config();

const app = express();

const parseOrigins = (value = "") =>
  String(value)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  process.env.CLIENT_URL,
  process.env.PUBLIC_API_URL,
  ...parseOrigins(process.env.CORS_ORIGINS),
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman, curl, server-to-server calls, and same-origin requests.
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/swagger.json", (req, res) => {
  res.json(swaggerSpec);
});

app.get("/", (req, res) => {
  res.send("Backend Hugging Face RAG running");
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is running",
    environment: process.env.NODE_ENV || "development",
  });
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
app.use("/subscriptions", subscriptionRoutes);

try {
  const connection = await pool.getConnection();
  console.log("MySQL Connected");
  connection.release();
} catch (error) {
  console.log("MySQL Error");
  console.log(error.message);
}

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, async () => {
  try {
    await createCollection();
    console.log("Qdrant collection ready");
  } catch (error) {
    console.log("Qdrant init failed:", error.message);
  }

  console.log(`Server running on port ${PORT}`);
  console.log(`Local API: http://localhost:${PORT}`);
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});
