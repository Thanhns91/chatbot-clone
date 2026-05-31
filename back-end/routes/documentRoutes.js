import express from "express";
import { documents } from "./uploadRoutes.js";

const router = express.Router();

router.get("/", (req, res) => {
  const teacherDocs = documents.filter(
    (doc) => doc.uploadedBy === "teacher"
  );

  res.json(teacherDocs);
});

export default router;