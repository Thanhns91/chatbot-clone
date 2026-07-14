import express from "express";
import pool from "../db.js";
import { qdrant, COLLECTION_NAME } from "../qdrant.js";

const router = express.Router();

const documentSelect = `
  SELECT
    d.id,
    d.documentId,
    d.fileName,
    d.fileType,
    d.fileUrl,
    COALESCE(d.fileSizeBytes, 0) AS fileSizeBytes,
    d.contentHash,
    d.uploaderId,
    d.uploadedBy,
    d.uploadStatus,
    d.reviewStatus,
    d.errorMessage,
    d.subjectId,
    d.topicId,
    d.documentTypeId,
    d.levelId,
    d.tags,
    d.summary,
    d.versionGroupId,
    d.versionNo,
    d.vectorDocumentId,
    d.isDuplicate,
    d.originalDocumentId,
    d.isDeleted,
    d.deletedAt,
    d.replacedByDocumentId,
    d.uploadDate,
    d.updatedAt,
    u.fullName AS uploaderName,
    u.email AS uploaderEmail,
    u.role AS uploaderRole,
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
    ) AS chatUseCount,
    CASE
      WHEN d.reviewStatus = 'approved' THEN 'Public'
      WHEN d.reviewStatus = 'private' THEN 'Private'
      ELSE d.reviewStatus
    END AS visibilityStatus
  FROM Documents d
  LEFT JOIN Users u ON d.uploaderId = u.userId
  LEFT JOIN Subjects s ON d.subjectId = s.subjectId
  LEFT JOIN Topics t ON d.topicId = t.topicId
  LEFT JOIN DocumentTypes dt ON d.documentTypeId = dt.documentTypeId
  LEFT JOIN DocumentLevels dl ON d.levelId = dl.levelId
`;

function parseNullableNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

async function safeDeleteVectors(documentId) {
  if (!documentId) return;

  try {
    await qdrant.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        should: [
          {
            key: "documentId",
            match: {
              value: documentId,
            },
          },
          {
            key: "vectorDocumentId",
            match: {
              value: documentId,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.log("Delete Qdrant vectors failed:", error.message);
  }
}

// ===== METADATA APIs =====
router.get("/metadata", async (req, res) => {
  try {
    const [subjects] = await pool.query(`
      SELECT subjectId, subjectCode, subjectName, description, createdBy, createdAt, updatedAt
      FROM Subjects
      ORDER BY subjectCode, subjectName
    `);

    const [topics] = await pool.query(`
      SELECT
        t.topicId,
        t.subjectId,
        t.topicName,
        t.description,
        t.createdBy,
        t.createdAt,
        t.updatedAt,
        s.subjectCode,
        s.subjectName
      FROM Topics t
      INNER JOIN Subjects s ON t.subjectId = s.subjectId
      ORDER BY s.subjectCode, t.topicName
    `);

    const [documentTypes] = await pool.query(`
      SELECT documentTypeId, typeName, description, createdBy, createdAt
      FROM DocumentTypes
      ORDER BY typeName
    `);

    const [documentLevels] = await pool.query(`
      SELECT levelId, levelName, description, createdBy, createdAt
      FROM DocumentLevels
      ORDER BY levelId
    `);

    res.json({
      success: true,
      subjects,
      topics,
      documentTypes,
      documentLevels,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot load metadata",
      detail: error.message,
    });
  }
});

router.get("/subjects", async (req, res) => {
  try {
    const [subjects] = await pool.query(`
      SELECT subjectId, subjectCode, subjectName, description, createdBy, createdAt, updatedAt
      FROM Subjects
      ORDER BY subjectCode, subjectName
    `);

    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.post("/subjects", async (req, res) => {
  try {
    const { subjectCode, subjectName, description, createdBy } = req.body;

    if (!subjectName) {
      return res.status(400).json({
        success: false,
        message: "Missing subjectName",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO Subjects (subjectCode, subjectName, description, createdBy)
      VALUES (?, ?, ?, ?)
      `,
      [subjectCode || null, subjectName, description || null, createdBy || null],
    );

    await pool.query(
      `
      INSERT IGNORE INTO Topics (subjectId, topicName, description, createdBy)
      VALUES (?, 'Uncategorized', 'Chủ đề chưa phân loại', ?)
      `,
      [result.insertId, createdBy || null],
    );

    res.json({
      success: true,
      subjectId: result.insertId,
      message: "Subject created",
    });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.put("/subjects/:subjectId", async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { subjectCode, subjectName, description } = req.body;

    if (!subjectName) {
      return res.status(400).json({
        success: false,
        message: "Missing subjectName",
      });
    }

    await pool.query(
      `
      UPDATE Subjects
      SET subjectCode = ?, subjectName = ?, description = ?
      WHERE subjectId = ?
      `,
      [subjectCode || null, subjectName, description || null, subjectId],
    );

    res.json({ success: true, message: "Subject updated" });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.get("/topics", async (req, res) => {
  try {
    const { subjectId } = req.query;

    let sql = `
      SELECT
        t.topicId,
        t.subjectId,
        t.topicName,
        t.description,
        t.createdBy,
        t.createdAt,
        t.updatedAt,
        s.subjectCode,
        s.subjectName
      FROM Topics t
      INNER JOIN Subjects s ON t.subjectId = s.subjectId
      WHERE 1 = 1
    `;
    const params = [];

    if (subjectId) {
      sql += ` AND t.subjectId = ?`;
      params.push(subjectId);
    }

    sql += ` ORDER BY s.subjectCode, t.topicName`;

    const [topics] = await pool.query(sql, params);

    res.json({ success: true, data: topics });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.post("/topics", async (req, res) => {
  try {
    const { subjectId, topicName, description, createdBy } = req.body;

    if (!subjectId || !topicName) {
      return res.status(400).json({
        success: false,
        message: "Missing subjectId or topicName",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO Topics (subjectId, topicName, description, createdBy)
      VALUES (?, ?, ?, ?)
      `,
      [subjectId, topicName, description || null, createdBy || null],
    );

    res.json({
      success: true,
      topicId: result.insertId,
      message: "Topic created",
    });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.put("/topics/:topicId", async (req, res) => {
  try {
    const { topicId } = req.params;
    const { subjectId, topicName, description } = req.body;

    if (!subjectId || !topicName) {
      return res.status(400).json({
        success: false,
        message: "Missing subjectId or topicName",
      });
    }

    await pool.query(
      `
      UPDATE Topics
      SET subjectId = ?, topicName = ?, description = ?
      WHERE topicId = ?
      `,
      [subjectId, topicName, description || null, topicId],
    );

    res.json({ success: true, message: "Topic updated" });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.get("/document-types", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT documentTypeId, typeName, description, createdBy, createdAt
      FROM DocumentTypes
      ORDER BY typeName
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.post("/document-types", async (req, res) => {
  try {
    const { typeName, description, createdBy } = req.body;

    if (!typeName) {
      return res.status(400).json({ success: false, message: "Missing typeName" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO DocumentTypes (typeName, description, createdBy)
      VALUES (?, ?, ?)
      `,
      [typeName, description || null, createdBy || null],
    );

    res.json({ success: true, documentTypeId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.get("/document-levels", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT levelId, levelName, description, createdBy, createdAt
      FROM DocumentLevels
      ORDER BY levelId
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.post("/document-levels", async (req, res) => {
  try {
    const { levelName, description, createdBy } = req.body;

    if (!levelName) {
      return res.status(400).json({ success: false, message: "Missing levelName" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO DocumentLevels (levelName, description, createdBy)
      VALUES (?, ?, ?)
      `,
      [levelName, description || null, createdBy || null],
    );

    res.json({ success: true, levelId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

// ===== DOCUMENT APIs =====
router.get("/library", async (req, res) => {
  try {
    const { userId, role, subjectId, topicId } = req.query;

    let sql = `
      ${documentSelect}
      WHERE d.uploadStatus = 'success'
        AND d.isDeleted = FALSE
    `;

    const params = [];

    if (role === "student") {
      // Student thấy tài liệu teacher + tài liệu chính mình upload,
      // kể cả file của chính mình đang private.
      sql += `
        AND (
          d.uploadedBy = 'teacher'
          OR d.uploaderId = ?
        )
      `;
      params.push(userId || 0);
    } else if (role === "teacher" || role === "admin") {
      // Teacher/Admin chỉ thấy file student đã public = approved.
      // File student private sẽ bị ẩn.
      sql += `
        AND (
          d.uploadedBy = 'teacher'
          OR (d.uploadedBy = 'student' AND d.reviewStatus = 'approved')
        )
      `;
    }

    if (subjectId) {
      sql += ` AND d.subjectId = ?`;
      params.push(subjectId);
    }

    if (topicId) {
      sql += ` AND d.topicId = ?`;
      params.push(topicId);
    }

    sql += ` ORDER BY s.subjectCode, t.topicName, d.uploadDate DESC`;

    const [docs] = await pool.query(sql, params);

    res.json({ success: true, data: docs });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot load library documents",
      detail: error.message,
    });
  }
});

router.get("/student-files", async (req, res) => {
  try {
    const [docs] = await pool.query(`
      ${documentSelect}
      WHERE d.uploadedBy = 'student'
        AND d.uploadStatus = 'success'
        AND d.reviewStatus = 'approved'
        AND d.isDeleted = FALSE
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

router.get("/view/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT fileUrl
      FROM Documents
      WHERE documentId = ?
        AND isDeleted = FALSE
      `,
      [documentId],
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

router.get("/download/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT fileName, fileType, fileUrl
      FROM Documents
      WHERE documentId = ?
        AND isDeleted = FALSE
      `,
      [documentId],
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

    res.setHeader("Content-Type", doc.fileType || "application/octet-stream");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
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

router.get("/teacher-history", async (req, res) => {
  try {
    const { uploaderId } = req.query;

    let sql = `
      ${documentSelect}
      WHERE d.uploadedBy = 'teacher'
        AND d.isDeleted = FALSE
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

router.get("/teacher-stats", async (req, res) => {
  try {
    const [statsRows] = await pool.query(`
      SELECT
        COUNT(CASE WHEN d.uploadedBy = 'teacher' AND d.isDeleted = FALSE THEN 1 END) AS materials,
        COUNT(CASE WHEN d.uploadedBy = 'student' AND d.reviewStatus = 'approved' AND d.isDeleted = FALSE AND u.role = 'student' THEN 1 END) AS studentFiles,
        COUNT(CASE WHEN d.reviewStatus = 'approved' AND d.isDeleted = FALSE THEN 1 END) AS approved,
        COUNT(CASE WHEN d.reviewStatus = 'private' AND d.isDeleted = FALSE THEN 1 END) AS privateFiles,
        COUNT(CASE WHEN d.reviewStatus = 'pending' AND d.isDeleted = FALSE THEN 1 END) AS pending,
        COALESCE(SUM(CASE WHEN d.isDeleted = FALSE THEN d.fileSizeBytes ELSE 0 END), 0) AS totalStorageBytes
      FROM Documents d
      LEFT JOIN Users u ON d.uploaderId = u.userId
    `);

    const [chatRows] = await pool.query(`
      SELECT
        COUNT(DISTINCT cs.sessionId) AS totalChatSessions,
        COUNT(CASE WHEN cm.sender = 'user' THEN 1 END) AS totalQuestions
      FROM ChatSessions cs
      LEFT JOIN ChatMessages cm ON cs.sessionId = cm.sessionId
    `);

    const [materialChart] = await pool.query(`
      SELECT 
        DATE_FORMAT(uploadDate, '%Y-%m-%d') AS date,
        COUNT(*) AS count
      FROM Documents
      WHERE uploadedBy = 'teacher'
        AND isDeleted = FALSE
      GROUP BY DATE_FORMAT(uploadDate, '%Y-%m-%d')
      ORDER BY date
    `);

    const [studentChart] = await pool.query(`
      SELECT 
        DATE_FORMAT(d.uploadDate, '%Y-%m-%d') AS date,
        COUNT(*) AS count
      FROM Documents d
      INNER JOIN Users u ON d.uploaderId = u.userId
      WHERE d.uploadedBy = 'student'
        AND d.uploadStatus = 'success'
        AND d.reviewStatus = 'approved'
        AND d.isDeleted = FALSE
        AND u.role = 'student'
      GROUP BY DATE_FORMAT(d.uploadDate, '%Y-%m-%d')
      ORDER BY date
    `);

    const [recentStudentFiles] = await pool.query(`
      ${documentSelect}
      WHERE d.uploadedBy = 'student'
        AND d.uploadStatus = 'success'
        AND d.reviewStatus = 'approved'
        AND d.isDeleted = FALSE
        AND u.role = 'student'
      ORDER BY d.uploadDate DESC
      LIMIT 4
    `);

    const [topicSummary] = await pool.query(`
      SELECT
        COALESCE(s.subjectCode, 'No Subject') AS subjectCode,
        COALESCE(s.subjectName, 'No Subject') AS subjectName,
        COALESCE(t.topicName, 'Uncategorized') AS topicName,
        COUNT(*) AS count
      FROM Documents d
      LEFT JOIN Subjects s ON d.subjectId = s.subjectId
      LEFT JOIN Topics t ON d.topicId = t.topicId
      WHERE d.isDeleted = FALSE
        AND (d.uploadedBy <> 'student' OR d.reviewStatus = 'approved')
      GROUP BY s.subjectCode, s.subjectName, t.topicName
      ORDER BY count DESC
      LIMIT 5
    `);

    const stats = {
      materials: Number(statsRows[0].materials || 0),
      studentFiles: Number(statsRows[0].studentFiles || 0),
      approved: Number(statsRows[0].approved || 0),
      pending: Number(statsRows[0].pending || 0),
      privateFiles: Number(statsRows[0].privateFiles || 0),
      totalStorageBytes: Number(statsRows[0].totalStorageBytes || 0),
      totalChatSessions: Number(chatRows[0].totalChatSessions || 0),
      totalQuestions: Number(chatRows[0].totalQuestions || 0),
    };

    res.json({
      success: true,
      stats,
      summary: {
        text: `Dashboard hiện có ${stats.materials} tài liệu giáo viên, ${stats.studentFiles} file học sinh public, ${stats.totalChatSessions} phiên chat và ${stats.totalQuestions} câu hỏi.`,
        topicSummary,
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

router.get("/:documentId/detail", async (req, res) => {
  try {
    const { documentId } = req.params;

    const [rows] = await pool.query(
      `
      ${documentSelect}
      WHERE d.documentId = ?
        AND d.isDeleted = FALSE
      LIMIT 1
      `,
      [documentId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const doc = rows[0];

    res.json({
      success: true,
      data: doc,
      summary: `${doc.fileName} là tài liệu ${doc.visibilityStatus?.toLowerCase() || doc.reviewStatus} của ${doc.uploaderName || "unknown"} và đã được dùng trong ${Number(doc.chatUseCount || 0)} phiên chat.`,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot load document detail",
      detail: error.message,
    });
  }
});

router.put("/:documentId/metadata", async (req, res) => {
  try {
    const { documentId } = req.params;
    const {
      subjectId,
      topicId,
      documentTypeId,
      levelId,
      tags,
      summary,
      reviewStatus,
    } = req.body;

    await pool.query(
      `
      UPDATE Documents
      SET
        subjectId = ?,
        topicId = ?,
        documentTypeId = ?,
        levelId = ?,
        tags = ?,
        summary = ?,
        reviewStatus = COALESCE(?, reviewStatus)
      WHERE documentId = ?
      `,
      [
        parseNullableNumber(subjectId),
        parseNullableNumber(topicId),
        parseNullableNumber(documentTypeId),
        parseNullableNumber(levelId),
        tags || null,
        summary || null,
        reviewStatus || null,
        documentId,
      ],
    );

    res.json({ success: true, message: "Document metadata updated" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, detail: error.message });
  }
});


router.put("/:documentId/publish", async (req, res) => {
  try {
    const { documentId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT documentId, fileName, uploaderId, uploadedBy, reviewStatus
      FROM Documents
      WHERE documentId = ?
        AND isDeleted = FALSE
      LIMIT 1
      `,
      [documentId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const doc = rows[0];

    if (doc.uploadedBy !== "student") {
      return res.status(400).json({
        success: false,
        message: "Only student documents can be published by this action",
      });
    }

    if (Number(doc.uploaderId) !== Number(userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only publish your own document",
      });
    }

    await pool.query(
      `
      UPDATE Documents
      SET reviewStatus = 'approved'
      WHERE documentId = ?
      `,
      [documentId],
    );

    try {
      const [receivers] = await pool.query(
        `
        SELECT userId
        FROM Users
        WHERE role IN ('teacher', 'admin')
          AND status = 'active'
        `,
      );

      if (receivers.length > 0) {
        await pool.query(
          `
          INSERT INTO Notifications
          (receiverId, documentId, feedbackId, title, message, type)
          VALUES ?
          `,
          [
            receivers.map((receiver) => [
              receiver.userId,
              documentId,
              null,
              "Student file published",
              `Student made a file public: ${doc.fileName}`,
              "document_approved",
            ]),
          ],
        );
      }
    } catch (notifyError) {
      console.log("Create publish notification failed:", notifyError.message);
    }

    res.json({
      success: true,
      message: "File is now public",
      documentId,
      reviewStatus: "approved",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Cannot publish document",
      detail: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { role } = req.query;

    let sql = `
      ${documentSelect}
      WHERE d.isDeleted = FALSE
    `;

    const params = [];

    if (role !== "admin") {
      sql += `
        AND (
          d.uploadedBy <> 'student'
          OR d.reviewStatus = 'approved'
        )
      `;
    }

    sql += ` ORDER BY d.uploadDate DESC`;

    const [docs] = await pool.query(sql, params);

    res.json({ success: true, data: docs });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, detail: error.message });
  }
});

router.delete("/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    await pool.query(
      `
      UPDATE Documents
      SET isDeleted = TRUE,
          deletedAt = NOW()
      WHERE documentId = ?
      `,
      [documentId],
    );

    await safeDeleteVectors(documentId);

    res.json({ success: true, message: "Xóa document thành công" });
  } catch (error) {
    res.status(500).json({ success: false, detail: error.message });
  }
});

export default router;