import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/sessions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const [sessions] = await pool.query(
      `
      SELECT 
        cs.sessionId AS id,
        cs.sessionId,
        cs.userId,
        cs.documentId,
        cs.title,
        cs.createdAt,
        cs.updatedAt,
        d.fileName,
        (
          SELECT cm.message
          FROM ChatMessages cm
          WHERE cm.sessionId = cs.sessionId
          ORDER BY cm.createdAt DESC
          LIMIT 1
        ) AS preview,
        (
          SELECT COUNT(*)
          FROM ChatMessages cm
          WHERE cm.sessionId = cs.sessionId
        ) AS messageCount
      FROM ChatSessions cs
      LEFT JOIN Documents d ON cs.documentId = d.documentId
      WHERE cs.userId = ?
      ORDER BY cs.updatedAt DESC, cs.createdAt DESC
      `,
      [userId],
    );

    const formatted = sessions.map((s) => ({
      ...s,
      id: String(s.id),
      title: s.title || "New Chat",
      preview: s.preview || s.fileName || "",
      messageCount: s.messageCount || 0,
      date: "Today",
      starred: false,
    }));

    res.json(formatted);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot load chat sessions",
      detail: error.message,
    });
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const { userId, documentId, title } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO ChatSessions (userId, documentId, title)
      VALUES (?, ?, ?)
      `,
      [userId, documentId || null, title || "New Chat"],
    );

    res.json({
      success: true,
      sessionId: result.insertId,
      id: String(result.insertId),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot create chat session",
      detail: error.message,
    });
  }
});

router.put("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { documentId, title } = req.body;

    if (documentId !== undefined && title !== undefined) {
      await pool.query(
        `
        UPDATE ChatSessions
        SET documentId = ?, title = ?
        WHERE sessionId = ?
        `,
        [documentId || null, title || "New Chat", sessionId],
      );
    } else if (documentId !== undefined) {
      await pool.query(
        `
        UPDATE ChatSessions
        SET documentId = ?
        WHERE sessionId = ?
        `,
        [documentId || null, sessionId],
      );
    } else if (title !== undefined) {
      await pool.query(
        `
        UPDATE ChatSessions
        SET title = ?
        WHERE sessionId = ?
        `,
        [title || "New Chat", sessionId],
      );
    }

    res.json({
      success: true,
      message: "Session updated",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot update session",
      detail: error.message,
    });
  }
});

router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await pool.query(
      `
      DELETE FROM ChatSessions
      WHERE sessionId = ?
      `,
      [sessionId],
    );

    res.json({
      success: true,
      message: "Session deleted",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot delete session",
      detail: error.message,
    });
  }
});

router.get("/messages/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [messages] = await pool.query(
      `
      SELECT
        messageId,
        sessionId,
        sender,
        message,
        COALESCE(isApproved, FALSE) AS isApproved,
        approvedAt,
        createdAt
      FROM ChatMessages
      WHERE sessionId = ?
      ORDER BY createdAt ASC
      `,
      [sessionId],
    );

    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot load chat messages",
      detail: error.message,
    });
  }
});

router.post("/messages", async (req, res) => {
  try {
    const { sessionId, sender, message } = req.body;

    if (!sessionId || !sender || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing sessionId, sender or message",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO ChatMessages (sessionId, sender, message)
      VALUES (?, ?, ?)
      `,
      [sessionId, sender, message],
    );

    await pool.query(
      `
      UPDATE ChatSessions
      SET updatedAt = NOW()
      WHERE sessionId = ?
      `,
      [sessionId],
    );

    res.json({
      success: true,
      messageId: result.insertId,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot save message",
      detail: error.message,
    });
  }
});


router.put("/messages/:messageId/approved", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { isApproved } = req.body;

    const approvedValue =
      isApproved === true ||
      isApproved === "true" ||
      isApproved === 1 ||
      isApproved === "1";

    const [result] = await pool.query(
      `
      UPDATE ChatMessages
      SET
        isApproved = ?,
        approvedAt = CASE WHEN ? = TRUE THEN NOW() ELSE NULL END
      WHERE messageId = ?
        AND sender = 'ai'
      `,
      [approvedValue, approvedValue, messageId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "AI message not found",
      });
    }

    res.json({
      success: true,
      message: "Approved status updated",
      messageId,
      isApproved: approvedValue,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot update approved status",
      detail: error.message,
    });
  }
});

export default router;