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
      }
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

router.post("/:id/avatar", avatarUpload.single("avatar"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No avatar uploaded",
      });
    }

    const cloudinaryResult = await uploadAvatarToCloudinary(req.file.buffer);

    await pool.query(
      `
      UPDATE Users
      SET avatar_url = ?
      WHERE userId = ?
      `,
      [cloudinaryResult.secure_url, id]
    );

    const [rows] = await pool.query(
      `
      SELECT 
        userId,
        fullName,
        fullName AS name,
        email,
        role,
        status,
        avatar_url,
        avatar_url AS avatarUrl,
        createdAt
      FROM Users
      WHERE userId = ?
      `,
      [id]
    );

    res.json({
      success: true,
      message: "Avatar updated successfully",
      avatar_url: cloudinaryResult.secure_url,
      avatarUrl: cloudinaryResult.secure_url,
      user: rows[0],
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Upload avatar failed",
      detail: error.message,
    });
  }
});

// DELETE user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT role FROM Users WHERE userId = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (rows[0].role === "admin") {
      return res
        .status(400)
        .json({ success: false, message: "Cannot delete admin" });
    }

    await pool.query("DELETE FROM Users WHERE userId = ?", [id]);
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Delete user failed" });
  }
});

export default router;
