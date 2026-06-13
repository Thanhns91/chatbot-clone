import express from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import pool from "../db.js";

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const [existingUsers] = await pool.query(
      "SELECT userId FROM Users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });
    }

    const passwordHash = password;

    await pool.query(
      `INSERT INTO Users (fullName, email, passwordHash, role, status) VALUES (?, ?, ?, 'student', 'active')`,
      [fullName, email, passwordHash],
    );

    res.json({ success: true, message: "Register successful" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Register failed",
      detail: error.message,
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await pool.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email or password is incorrect" });
    }

    const user = users[0];

    if (user.status === "blocked") {
      return res
        .status(403)
        .json({ success: false, message: "Your account is blocked" });
    }

    const isMatch = password === user.passwordHash;

    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Email or password is incorrect" });
    }

    res.json({
      success: true,
      user: {
        userId: user.userId,
        fullName: user.fullName,
        name: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar_url: user.avatar_url || "",
        avatarUrl: user.avatar_url || "",
      },
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Login failed", detail: error.message });
  }
});

// GOOGLE LOGIN - lưu vào database
router.post("/google-login", async (req, res) => {
  try {
    const { email, fullName, uid } = req.body;

    if (!email || !fullName) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin" });
    }

    const [existing] = await pool.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);

    if (existing.length > 0) {
      const user = existing[0];
      if (user.status === "blocked") {
        return res
          .status(403)
          .json({ success: false, message: "Your account is blocked" });
      }
      return res.json({
        success: true,
        user: {
          userId: user.userId,
          fullName: user.fullName,
          name: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      });
    }

    // Tạo mới với role student
    await pool.query(
      `INSERT INTO Users (fullName, email, passwordHash, role, status) VALUES (?, ?, '', 'student', 'active')`,
      [fullName, email],
    );

    const [newUser] = await pool.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);

    res.json({
      success: true,
      user: {
        userId: newUser[0].userId,
        fullName: newUser[0].fullName,
        name: newUser[0].fullName,
        email: newUser[0].email,
        role: newUser[0].role,
        status: newUser[0].status,
      },
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server", detail: error.message });
  }
});

// ADMIN - TẠO TÀI KHOẢN GIÁO VIÊN
router.post("/admin/create-teacher", async (req, res) => {
  try {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu họ tên hoặc email" });
    }

    const [existing] = await pool.query(
      "SELECT userId FROM Users WHERE email = ?",
      [email],
    );

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email đã tồn tại" });
    }

    const defaultPassword = "12345";

    await pool.query(
      `INSERT INTO Users (fullName, email, passwordHash, role, status) VALUES (?, ?, ?, 'teacher', 'active')`,
      [fullName, email, defaultPassword],
    );

    await transporter.sendMail({
      from: `"Hệ thống AI Learning" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Tài khoản giáo viên của bạn",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
          <div style="background: #2563eb; padding: 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 20px;">AI Learning</h1>
          </div>
          <div style="padding: 24px;">
            <h2 style="font-size: 18px; color: #111;">Xin chào ${fullName}!</h2>
            <p style="color: #374151;">Tài khoản giáo viên của bạn đã được tạo thành công.</p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><b>Email:</b> ${email}</p>
              <p style="margin: 4px 0;"><b>Mật khẩu:</b> ${defaultPassword}</p>
            </div>
            <p style="color: #b91c1c; font-weight: bold;">⚠️ Vui lòng đổi mật khẩu ngay sau khi đăng nhập!</p>
          </div>
        </div>
      `,
    });

    res.json({
      success: true,
      message: `Tạo tài khoản và gửi mail đến ${email} thành công!`,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Tạo tài khoản thất bại",
      detail: error.message,
    });
  }
});

export default router;
