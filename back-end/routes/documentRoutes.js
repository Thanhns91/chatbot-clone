import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET student uploaded files
router.get("/student-files", async (req, res) => {
  try {
    const [docs] = await pool.query(`
      SELECT 
        d.documentId,
        d.fileName,
        d.fileType,
        d.fileUrl,
        d.contentHash,
        d.uploaderId,
        d.uploadedBy,
        d.uploadStatus,
        d.reviewStatus,
        d.uploadDate,
        u.fullName AS uploaderName
      FROM Documents d
      LEFT JOIN Users u ON d.uploaderId = u.userId
      WHERE d.uploadedBy = 'student'
      ORDER BY d.uploadDate DESC
    `);

    res.json({
      success: true,
      data: docs,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Cannot load student files",
      detail: error.message,
    });
  }
});

// VIEW document by Cloudinary fileUrl
router.get("/view/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT fileUrl
      FROM Documents
      WHERE documentId = ?
      `,
      [documentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const fileUrl = rows[0].fileUrl;

    if (!fileUrl) {
      return res.status(404).json({
        success: false,
        message: "File URL not found",
      });
    }

    return res.redirect(fileUrl);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Cannot view document",
      detail: error.message,
    });
  }
});

// DOWNLOAD document by Cloudinary fileUrl
router.get("/download/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT fileName, fileType, fileUrl
      FROM Documents
      WHERE documentId = ?
      `,
      [documentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const doc = rows[0];

    if (!doc.fileUrl) {
      return res.status(404).json({
        success: false,
        message: "File URL not found",
      });
    }

    const response = await fetch(doc.fileUrl);

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        message: "Cannot download file from Cloudinary",
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader(
      "Content-Type",
      doc.fileType || "application/octet-stream"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.fileName)}"`
    );

    return res.send(buffer);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Cannot download document",
      detail: error.message,
    });
  }
});

// GET upload history của teacher
router.get("/teacher-history", async (req, res) => {
  try {
    const { uploaderId } = req.query;

    let sql = `
      SELECT 
        d.documentId,
        d.fileName,
        d.fileType,
        d.fileUrl,
        d.contentHash,
        d.uploaderId,
        d.uploadedBy,
        d.uploadStatus,
        d.reviewStatus,
        d.uploadDate,
        u.fullName AS uploaderName
      FROM Documents d
      LEFT JOIN Users u ON d.uploaderId = u.userId
      WHERE d.uploadedBy = 'teacher'
    `;

    const params = [];

    if (uploaderId) {
      sql += ` AND d.uploaderId = ?`;
      params.push(uploaderId);
    }

    sql += ` ORDER BY d.uploadDate DESC`;

    const [docs] = await pool.query(sql, params);

    res.json({
      success: true,
      data: docs,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Cannot load teacher upload history",
      detail: error.message,
    });
  }
});

// GET tất cả documents
router.get("/teacher-stats", async (req, res) => {
  try {
    const [statsRows] = await pool.query(`
      SELECT
        COUNT(CASE WHEN uploadedBy = 'teacher' THEN 1 END) AS materials,
        COUNT(CASE WHEN uploadedBy = 'student' THEN 1 END) AS studentFiles,
        COUNT(CASE WHEN reviewStatus = 'approved' THEN 1 END) AS approved,
        COUNT(CASE WHEN reviewStatus = 'private' THEN 1 END) AS privateFiles,
        COUNT(CASE WHEN reviewStatus = 'pending' THEN 1 END) AS pending
      FROM Documents
    `);

    const [materialChart] = await pool.query(`
      SELECT 
        DATE_FORMAT(uploadDate, '%Y-%m-%d') AS date,
        COUNT(*) AS count
      FROM Documents
      WHERE uploadedBy = 'teacher'
      GROUP BY DATE_FORMAT(uploadDate, '%Y-%m-%d')
      ORDER BY date
    `);

    const [studentChart] = await pool.query(`
      SELECT 
        DATE_FORMAT(uploadDate, '%Y-%m-%d') AS date,
        COUNT(*) AS count
      FROM Documents
      WHERE uploadedBy = 'student'
      GROUP BY DATE_FORMAT(uploadDate, '%Y-%m-%d')
      ORDER BY date
    `);

    const [recentStudentFiles] = await pool.query(`
      SELECT 
        d.fileName,
        d.fileType,
        d.uploadDate,
        d.reviewStatus,
        u.fullName AS uploaderName
      FROM Documents d
      LEFT JOIN Users u ON d.uploaderId = u.userId
      WHERE d.uploadedBy = 'student'
      ORDER BY d.uploadDate DESC
      LIMIT 4
    `);

    res.json({
      success: true,
      stats: {
        materials: Number(statsRows[0].materials || 0),
        studentFiles: Number(statsRows[0].studentFiles || 0),
        approved: Number(statsRows[0].approved || 0),
        pending: Number(statsRows[0].pending || 0),
        privateFiles: Number(statsRows[0].privateFiles || 0),
      },
      charts: {
        materialChart,
        studentChart,
      },
      recentStudentFiles,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      detail: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const [docs] = await pool.query(
      `SELECT d.*, u.fullName as uploaderName 
       FROM Documents d 
       LEFT JOIN Users u ON d.uploaderId = u.userId
       ORDER BY d.uploadDate DESC`,
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

    await pool.query("DELETE FROM Documents WHERE documentId = ?", [
      documentId,
    ]);

    res.json({ success: true, message: "Xóa document thành công" });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

export default router;
