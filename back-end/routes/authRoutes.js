import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { sendTeacherAccountEmail } from "../serverMail.js";

const router = express.Router();

const normalizeUser = (user) => ({
  userId: user.userId,
  fullName: user.fullName,
  name: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  avatar_url: user.avatar_url || "",
  avatarUrl: user.avatar_url || "",
});

const normalizeEmail = (email = "") => {
  return String(email || "").trim().toLowerCase();
};

const isValidEmail = (email = "") => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(
    String(email || "").trim(),
  );
};

const normalizeName = (name = "") => {
  return String(name || "").trim().replace(/\s+/g, " ");
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

  // Hỗ trợ tài khoản cũ đang lưu plain text như 12345
  return inputPassword === storedPassword;
};

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const fullName = normalizeName(req.body.fullName);
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const [existingUsers] = await pool.query(
      "SELECT userId FROM Users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO Users (fullName, email, passwordHash, role, status)
      VALUES (?, ?, ?, 'student', 'active')
      `,
      [fullName, email, passwordHash],
    );

    return res.json({
      success: true,
      message: "Register successful",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Register failed",
      detail: error.message,
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Email or password is incorrect",
      });
    }

    const [users] = await pool.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Email or password is incorrect",
      });
    }

    const user = users[0];

    if (user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked",
      });
    }

    const isMatch = await checkPassword(password, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Email or password is incorrect",
      });
    }

    return res.json({
      success: true,
      user: normalizeUser(user),
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
      detail: error.message,
    });
  }
});

// GOOGLE LOGIN
router.post("/google-login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const fullName = normalizeName(req.body.fullName);

    if (!email || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ",
      });
    }

    const [existing] = await pool.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);

    if (existing.length > 0) {
      const user = existing[0];

      if (user.status === "blocked") {
        return res.status(403).json({
          success: false,
          message: "Your account is blocked",
        });
      }

      return res.json({
        success: true,
        user: normalizeUser(user),
      });
    }

    await pool.query(
      `
      INSERT INTO Users (fullName, email, passwordHash, role, status)
      VALUES (?, ?, '', 'student', 'active')
      `,
      [fullName, email],
    );

    const [newUser] = await pool.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);

    return res.json({
      success: true,
      user: normalizeUser(newUser[0]),
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      detail: error.message,
    });
  }
});

// ADMIN - TẠO TÀI KHOẢN GIÁO VIÊN
router.post("/admin/create-teacher", async (req, res) => {
  try {
    const fullName = normalizeName(req.body.fullName);
    const email = normalizeEmail(req.body.email);

    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "Thiếu họ tên hoặc email",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Email không hợp lệ",
      });
    }

    const [existing] = await pool.query(
      "SELECT userId FROM Users WHERE email = ?",
      [email],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email đã tồn tại",
      });
    }

    const defaultPassword = "12345";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await pool.query(
      `
      INSERT INTO Users (fullName, email, passwordHash, role, status)
      VALUES (?, ?, ?, 'teacher', 'active')
      `,
      [fullName, email, passwordHash],
    );

    try {
      await sendTeacherAccountEmail({
        to: email,
        fullName,
        password: defaultPassword,
      });
    } catch (mailError) {
      console.log("Send teacher email failed:", mailError.message);

      return res.json({
        success: true,
        mailSent: false,
        message: "Tạo tài khoản giáo viên thành công nhưng gửi email thất bại.",
        teacher: {
          fullName,
          email,
          defaultPassword,
        },
      });
    }

    return res.json({
      success: true,
      mailSent: true,
      message: `Tạo tài khoản và gửi mail đến ${email} thành công!`,
      teacher: {
        fullName,
        email,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Tạo tài khoản thất bại",
      detail: error.message,
    });
  }
});

export default router;