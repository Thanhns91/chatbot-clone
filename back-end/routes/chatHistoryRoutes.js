import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/sessions/:userId", async (req, res) => {
  const { userId } = req.params;

  const [sessions] = await pool.query(
    `
    SELECT sessionId, userId, documentId, title, createdAt
    FROM ChatSessions
    WHERE userId = ?
    ORDER BY createdAt DESC
    `,
    [userId]
  );

  res.json(sessions);
});

router.post("/sessions", async (req, res) => {
  const { userId, documentId, title } = req.body;

  const [result] = await pool.query(
    `
    INSERT INTO ChatSessions (userId, documentId, title)
    VALUES (?, ?, ?)
    `,
    [userId, documentId || null, title || "New Chat"]
  );

  res.json({
    success: true,
    sessionId: result.insertId,
  });
});

router.get("/messages/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  const [messages] = await pool.query(
    `
    SELECT messageId, sessionId, sender, message, createdAt
    FROM ChatMessages
    WHERE sessionId = ?
    ORDER BY createdAt ASC
    `,
    [sessionId]
  );

  res.json(messages);
});

router.post("/messages", async (req, res) => {
  const { sessionId, sender, message } = req.body;

  await pool.query(
    `
    INSERT INTO ChatMessages (sessionId, sender, message)
    VALUES (?, ?, ?)
    `,
    [sessionId, sender, message]
  );

  res.json({
    success: true,
  });
});

export default router;