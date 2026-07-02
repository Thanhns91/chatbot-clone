import express from "express";
import pool from "../db.js";
import multer from "multer";
import cloudinary from "../cloudinary.js";
import { Readable } from "stream";
import bcrypt from "bcryptjs";

const router = express.Router();

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

const normalizeName = (value = "") => {
  return String(value || "").trim().replace(/\s+/g, " ");
};

const normalizeEmail = (value = "") => {
  return String(value || "").trim().toLowerCase();
};

const isValidEmail = (value = "") => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());
};

const isBcryptHash = (value = "") => {
  return (
    value.startsWith("$2a$") ||
    value.startsWith("$2b$") ||
    value.startsWith("$2y$")
  );
};

const checkPassword = async (inputPassword, storedPassword) => {
  if (!storedPassword) return false;

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return inputPassword === storedPassword;
};

const formatProfileRow = (row) => ({
  userId: row.userId,
  fullName: row.fullName,
  name: row.fullName,
  email: row.email,
  role: row.role,
  status: row.status,
  avatar_url: row.avatar_url || "",
  avatarUrl: row.avatar_url || "",
  createdAt: row.createdAt,


  teacherProfileId: row.teacherProfileId || null,
  department: row.department || "",
  specialization: row.specialization || "",
  bio: row.bio || "",

  studentProfileId: row.studentProfileId || null,
  studentCode: row.studentCode || "",
  major: row.major || "",
  className: row.className || "",
});

async function ensureProfileForRole(connectionOrPool, userId, role) {
  if (!userId || !role) return;

  if (role === "teacher") {
    await connectionOrPool.query(
      `
      INSERT IGNORE INTO TeacherProfiles (userId)
      VALUES (?)
      `,
      [userId],
    );
  }

  if (role === "student") {
    await connectionOrPool.query(
      `
      INSERT IGNORE INTO StudentProfiles (userId)
      VALUES (?)
      `,
      [userId],
    );
  }

}

async function getProfileById(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      u.userId,
      u.fullName,
      u.email,
      u.role,
      u.status,
      u.avatar_url,
      u.createdAt,


      tp.teacherProfileId,
      tp.department,
      tp.specialization,
      tp.bio,

      sp.studentProfileId,
      sp.studentCode,
      sp.major,
      sp.className
    FROM Users u
    LEFT JOIN TeacherProfiles tp ON u.userId = tp.userId
    LEFT JOIN StudentProfiles sp ON u.userId = sp.userId
    WHERE u.userId = ?
    LIMIT 1
    `,
    [userId],
  );

  return rows[0] ? formatProfileRow(rows[0]) : null;
}

function bytesToMB(bytes = 0) {
  return Number((Number(bytes || 0) / 1024 / 1024).toFixed(2));
}

router.get("/stats", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM Users WHERE role = 'student') AS members,
        (SELECT COUNT(*) FROM Users WHERE role = 'teacher') AS teachers,
        (SELECT COUNT(*) FROM Users WHERE status = 'active') AS activeUsers,
        (SELECT COUNT(*) FROM Users WHERE status = 'blocked') AS blockedUsers,

        (SELECT COUNT(*) FROM Documents WHERE isDeleted = FALSE) AS documents,
        (SELECT COUNT(*) FROM Documents WHERE isDeleted = FALSE AND reviewStatus = 'approved') AS publicDocuments,
        (SELECT COUNT(*) FROM Documents WHERE isDeleted = FALSE AND reviewStatus = 'private') AS privateDocuments,
        (SELECT COALESCE(SUM(fileSizeBytes), 0) FROM Documents WHERE isDeleted = FALSE) AS totalStorageBytes,

        (SELECT COUNT(*) FROM ChatSessions) AS totalChatSessions,
        (SELECT COUNT(*) FROM ChatMessages WHERE sender = 'user') AS totalQuestions
    `);

    const [memberChart] = await pool.query(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM Users
      WHERE role = 'student'
        AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date
    `);

    const [teacherChart] = await pool.query(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM Users
      WHERE role = 'teacher'
        AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date
    `);

    const [documentChart] = await pool.query(`
      SELECT DATE(uploadDate) as date, COUNT(*) as count
      FROM Documents
      WHERE uploadDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND isDeleted = FALSE
      GROUP BY DATE(uploadDate)
      ORDER BY date
    `);

    const stats = {
      members: Number(rows[0].members || 0),
      teachers: Number(rows[0].teachers || 0),
      activeUsers: Number(rows[0].activeUsers || 0),
      blockedUsers: Number(rows[0].blockedUsers || 0),
      documents: Number(rows[0].documents || 0),
      publicDocuments: Number(rows[0].publicDocuments || 0),
      privateDocuments: Number(rows[0].privateDocuments || 0),
      totalStorageBytes: Number(rows[0].totalStorageBytes || 0),
      totalStorageMB: bytesToMB(rows[0].totalStorageBytes || 0),
      totalChatSessions: Number(rows[0].totalChatSessions || 0),
      totalQuestions: Number(rows[0].totalQuestions || 0),
    };

    res.json({
      success: true,
      stats,
      summary: {
        text: `Hệ thống có ${stats.members} học sinh, ${stats.teachers} giáo viên, ${stats.documents} tài liệu, ${stats.publicDocuments} tài liệu public và ${stats.totalChatSessions} phiên chat.`,
      },
      charts: { memberChart, teacherChart, documentChart },
    });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT
        u.userId,
        u.fullName,
        u.email,
        u.role,
        u.status,
        u.createdAt,

        COUNT(d.documentId) AS totalDocuments,
        COALESCE(SUM(d.fileSizeBytes), 0) AS totalStorageBytes,
        SUM(CASE WHEN d.reviewStatus = 'approved' THEN 1 ELSE 0 END) AS publicDocuments,
        SUM(CASE WHEN d.reviewStatus = 'private' THEN 1 ELSE 0 END) AS privateDocuments,
        SUM(CASE WHEN d.uploadStatus = 'success' THEN 1 ELSE 0 END) AS uploadedDocuments,

        MAX(d.uploadDate) AS lastUploadAt
      FROM Users u
      LEFT JOIN Documents d
        ON d.uploaderId = u.userId
        AND d.isDeleted = FALSE
      WHERE u.role <> 'admin'
      GROUP BY
        u.userId,
        u.fullName,
        u.email,
        u.role,
        u.status,
        u.createdAt
      ORDER BY u.createdAt DESC
    `);

    res.json(
      users.map((user) => ({
        ...user,
        totalDocuments: Number(user.totalDocuments || 0),
        totalStorageBytes: Number(user.totalStorageBytes || 0),
        totalStorageMB: bytesToMB(user.totalStorageBytes || 0),
        publicDocuments: Number(user.publicDocuments || 0),
        privateDocuments: Number(user.privateDocuments || 0),
        uploadedDocuments: Number(user.uploadedDocuments || 0),
      })),
    );
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot get users",
      detail: error.message,
    });
  }
});

router.get("/:id/overview", async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await getProfileById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        COUNT(d.documentId) AS totalDocuments,
        COALESCE(SUM(d.fileSizeBytes), 0) AS totalStorageBytes,
        SUM(CASE WHEN d.reviewStatus = 'approved' THEN 1 ELSE 0 END) AS publicDocuments,
        SUM(CASE WHEN d.reviewStatus = 'private' THEN 1 ELSE 0 END) AS privateDocuments,
        SUM(CASE WHEN d.uploadStatus = 'success' THEN 1 ELSE 0 END) AS uploadedDocuments
      FROM Documents d
      WHERE d.uploaderId = ?
        AND d.isDeleted = FALSE
      `,
      [id],
    );

    const [chatRows] = await pool.query(
      `
      SELECT
        COUNT(DISTINCT cs.sessionId) AS totalChatSessions,
        COUNT(CASE WHEN cm.sender = 'user' THEN 1 END) AS totalQuestions
      FROM ChatSessions cs
      LEFT JOIN ChatMessages cm ON cm.sessionId = cs.sessionId
      WHERE cs.userId = ?
      `,
      [id],
    );

    const overview = {
      ...profile,
      totalDocuments: Number(rows[0].totalDocuments || 0),
      totalStorageBytes: Number(rows[0].totalStorageBytes || 0),
      totalStorageMB: bytesToMB(rows[0].totalStorageBytes || 0),
      publicDocuments: Number(rows[0].publicDocuments || 0),
      privateDocuments: Number(rows[0].privateDocuments || 0),
      uploadedDocuments: Number(rows[0].uploadedDocuments || 0),
      totalChatSessions: Number(chatRows[0].totalChatSessions || 0),
      totalQuestions: Number(chatRows[0].totalQuestions || 0),
    };

    res.json({
      success: true,
      data: overview,
      summary: `${overview.fullName} đã upload ${overview.totalDocuments} tài liệu, trong đó có ${overview.publicDocuments} public và ${overview.privateDocuments} private.`,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.get("/:id/documents", async (req, res) => {
  try {
    const { id } = req.params;

    const [docs] = await pool.query(
      `
      SELECT
        d.documentId,
        d.fileName,
        d.fileType,
        d.fileUrl,
        COALESCE(d.fileSizeBytes, 0) AS fileSizeBytes,
        d.uploadedBy,
        d.reviewStatus,
        d.uploadStatus,
        d.uploadDate,
        d.tags,
        d.summary,

        s.subjectCode,
        s.subjectName,
        t.topicName,
        dt.typeName AS documentTypeName,
        dl.levelName,

        (
          COALESCE((
            SELECT COUNT(DISTINCT cs.sessionId)
            FROM ChatSessions cs
            WHERE cs.documentId = d.documentId
          ), 0)
          +
          COALESCE((
            SELECT COUNT(DISTINCT csd.sessionId)
            FROM ChatSessionDocuments csd
            WHERE csd.documentId = d.documentId
          ), 0)
        ) AS chatUseCount
      FROM Documents d
      LEFT JOIN Subjects s ON d.subjectId = s.subjectId
      LEFT JOIN Topics t ON d.topicId = t.topicId
      LEFT JOIN DocumentTypes dt ON d.documentTypeId = dt.documentTypeId
      LEFT JOIN DocumentLevels dl ON d.levelId = dl.levelId
      WHERE d.uploaderId = ?
        AND d.isDeleted = FALSE
      ORDER BY d.uploadDate DESC
      `,
      [id],
    );

    res.json({ success: true, data: docs });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, detail: error.message });
  }
});

// UPDATE status
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "blocked", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

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
  let connection;

  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["admin", "teacher", "student"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query("UPDATE Users SET role = ? WHERE userId = ?", [
      role,
      id,
    ]);

    await ensureProfileForRole(connection, id, role);

    await connection.commit();

    res.json({ success: true, message: "User role updated" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.log(error);
    res.status(500).json({ success: false, message: "Update role failed" });
  } finally {
    if (connection) connection.release();
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
      [cloudinaryResult.secure_url, id],
    );

    const user = await getProfileById(id);

    res.json({
      success: true,
      message: "Avatar updated successfully",
      avatar_url: cloudinaryResult.secure_url,
      avatarUrl: cloudinaryResult.secure_url,
      user,
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

// GET profile by user id
router.get("/:id/profile", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await getProfileById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await ensureProfileForRole(pool, id, user.role);

    const updatedUser = await getProfileById(id);

    res.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Cannot load profile",
      detail: error.message,
    });
  }
});

// UPDATE profile: Users + role-specific profile table
router.put("/:id/profile", async (req, res) => {
  let connection;

  try {
    const { id } = req.params;
    const fullName = normalizeName(req.body.fullName);
    const email = normalizeEmail(req.body.email);

    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "Full name and email are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Email is invalid",
      });
    }

    const [users] = await pool.query(
      `
      SELECT userId, role
      FROM Users
      WHERE userId = ?
      LIMIT 1
      `,
      [id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const role = users[0].role;

    const [existingEmail] = await pool.query(
      `
      SELECT userId
      FROM Users
      WHERE email = ?
        AND userId <> ?
      `,
      [email, id],
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE Users
      SET fullName = ?, email = ?
      WHERE userId = ?
      `,
      [fullName, email, id],
    );

    await ensureProfileForRole(connection, id, role);

    if (role === "teacher") {
      await connection.query(
        `
        UPDATE TeacherProfiles
        SET department = ?,
            specialization = ?,
            bio = ?
        WHERE userId = ?
        `,
        [
          req.body.department || null,
          req.body.specialization || null,
          req.body.bio || null,
          id,
        ],
      );
    } else if (role === "student") {
      await connection.query(
        `
        UPDATE StudentProfiles
        SET studentCode = ?,
            major = ?,
            className = ?
        WHERE userId = ?
        `,
        [
          req.body.studentCode || null,
          req.body.major || null,
          req.body.className || null,
          id,
        ],
      );
    }
    }

    await connection.commit();

    const updatedUser = await getProfileById(id);

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.log(error);

    res.status(500).json({
      success: false,
      message: "Update profile failed",
      detail: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

// CHANGE password
router.put("/:id/password", async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT userId, passwordHash
      FROM Users
      WHERE userId = ?
      `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = rows[0];
    const isMatch = await checkPassword(currentPassword, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE Users
      SET passwordHash = ?
      WHERE userId = ?
      `,
      [passwordHash, id],
    );

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Change password failed",
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
