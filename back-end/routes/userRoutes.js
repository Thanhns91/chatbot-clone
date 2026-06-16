import express from "express";
import pool from "../db.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
const router = express.Router();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  },
});

const uploadAvatarToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ai-learning/avatars",
        resource_type: "image",
        transformation: [
          {
            width: 400,
            height: 400,
            crop: "fill",
            gravity: "face",
          },
          {
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    Readable.from(buffer).pipe(stream);
  });
};

router.get("/stats", async (req, res) => {
  try {
    const [members] = await pool.query(
      "SELECT COUNT(*) as count FROM Users WHERE role = 'student'",
    );
    const [teachers] = await pool.query(
      "SELECT COUNT(*) as count FROM Users WHERE role = 'teacher'",
    );
    const [documents] = await pool.query(
      "SELECT COUNT(*) as count FROM Documents",
    );

    const [memberChart] = await pool.query(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM Users WHERE role = 'student'
      AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(createdAt) ORDER BY date
    `);

    const [teacherChart] = await pool.query(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM Users WHERE role = 'teacher'
      AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(createdAt) ORDER BY date
    `);

    const [documentChart] = await pool.query(`
      SELECT DATE(uploadDate) as date, COUNT(*) as count
      FROM Documents
      WHERE uploadDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(uploadDate) ORDER BY date
    `);

    res.json({
      success: true,
      stats: {
        members: members[0].count,
        teachers: teachers[0].count,
        documents: documents[0].count,
      },
      charts: { memberChart, teacherChart, documentChart },
    });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

// GET all users
router.get("/", async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT userId, fullName, email, role, status, createdAt
      FROM Users ORDER BY createdAt DESC
    `);
    res.json(users);
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Cannot get users" });
  }
});

// UPDATE status
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query("UPDATE Users SET status = ? WHERE userId = ?", [
      status,
      id,
    ]);
    res.json({ success: true, message: "User status updated" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Update status failed" });
  }
});

// UPDATE role
router.put("/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    await pool.query("UPDATE Users SET role = ? WHERE userId = ?", [role, id]);
    res.json({ success: true, message: "User role updated" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Update role failed" });
  }
});

router.post("/admin/create-teacher", async (req, res) => {
  const { fullName, email } = req.body;

  try {
    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tên hoặc email",
      });
    }

    const [existing] = await pool.query(
      "SELECT userId FROM Users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email này đã tồn tại",
      });
    }

    await pool.query(
      `INSERT INTO Users (fullName, email, passwordHash, role, status)
       VALUES (?, ?, ?, 'teacher', 'active')`,
      [fullName, email, ""]
    );

    return res.json({
      success: true,
      message: "Tạo teacher thành công",
    });
  } catch (err) {
    console.error("Create teacher error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// DELETE user
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `DELETE FROM ChatMessages
       WHERE sessionId IN (
         SELECT sessionId FROM ChatSessions WHERE userId = ?
       )`,
      [id]
    );

    await conn.query("DELETE FROM ChatSessions WHERE userId = ?", [id]);

    await conn.query("DELETE FROM Documents WHERE uploaderId = ?", [id]);

    const [result] = await conn.query(
      "DELETE FROM Users WHERE userId = ?",
      [id]
    );

    await conn.commit();

    if (result.affectedRows === 0) {
      return res.json({
        success: false,
        message: "User không tồn tại",
      });
    }

    res.json({
      success: true,
      message: "Xóa user thành công",
    });
  } catch (err) {
    await conn.rollback();
    console.error("Delete user error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    conn.release();
  }
});

export default router;
