import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET tất cả documents
router.get("/", async (req, res) => {
  try {
    const [docs] = await pool.query(
      `SELECT d.*, u.fullName as uploaderName 
       FROM Documents d 
       LEFT JOIN Users u ON d.uploaderId = u.userId
       ORDER BY d.uploadDate DESC`
    );
    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

// DELETE document
router.delete("/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    await pool.query(
      "DELETE FROM Documents WHERE documentId = ?",
      [documentId]
    );

    res.json({ success: true, message: "Xóa document thành công" });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

export default router;