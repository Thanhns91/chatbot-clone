import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import uploadRoutes from "./routes/uploadRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { createCollection } from "./qdrant.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/upload", uploadRoutes);
app.use("/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("Backend Hugging Face RAG running");
});

app.listen(3000, async () => {
  await createCollection();

  console.log("Server running at http://localhost:3000");
});