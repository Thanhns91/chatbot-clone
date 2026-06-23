import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * GET /notifications/:userId
 * Lấy danh sách thông báo của user
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const [notifications] = await pool.query(
      `
      SELECT
        n.notificationId,
        n.receiverId,
        n.documentId,
        n.title,
        n.message,
        n.type,
        n.isRead,
        n.createdAt,

        d.id AS documentDbId,
        d.documentId AS fileDocumentId,
        d.fileName,
        d.fileType,
        d.fileUrl,
        d.uploadedBy,
        d.reviewStatus,
        d.uploadDate,

        u.fullName AS uploaderName
      FROM Notifications n
      LEFT JOIN Documents d ON n.documentId = d.id
      LEFT JOIN Users u ON d.uploaderId = u.userId
      WHERE n.receiverId = ?
      ORDER BY n.createdAt DESC
      `,
      [userId]
    );

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({
      success: true,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Cannot load notifications",
      detail: error.message,
    });
  }
});

/**
 * GET /notifications/:userId/unread-count
 * Lấy số thông báo chưa đọc
 */
router.get("/:userId/unread-count", async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT COUNT(*) AS unreadCount
      FROM Notifications
      WHERE receiverId = ?
        AND isRead = FALSE
      `,
      [userId]
    );

    res.json({
      success: true,
      unreadCount: Number(rows[0].unreadCount || 0),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      detail: error.message,
    });
  }
});

/**
 * PUT /notifications/:notificationId/read
 * Đánh dấu 1 thông báo là đã đọc
 */
router.put("/:notificationId/read", async (req, res) => {
  try {
    const { notificationId } = req.params;

    await pool.query(
      `
      UPDATE Notifications
      SET isRead = TRUE
      WHERE notificationId = ?
      `,
      [notificationId]
    );

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      detail: error.message,
    });
  }
});

/**
 * PUT /notifications/user/:userId/read-all
 * Đánh dấu tất cả là đã đọc
 */
router.put("/user/:userId/read-all", async (req, res) => {
  try {
    const { userId } = req.params;

    await pool.query(
      `
      UPDATE Notifications
      SET isRead = TRUE
      WHERE receiverId = ?
      `,
      [userId]
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      detail: error.message,
    });
  }
});

export default router;