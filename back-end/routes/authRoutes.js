import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";

const router = express.Router();


router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const [existingUsers] = await pool.query(
      "SELECT * FROM Users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO Users 
       (fullName, email, passwordHash, role, status)
       VALUES (?, ?, ?, 'student', 'active')`,
      [fullName, email, passwordHash]
    );

    res.json({
      success: true,
      message: "Register successful",
    });
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

    const [users] = await pool.query(
      "SELECT * FROM Users WHERE email = ?",
      [email]
    );

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

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Email or password is incorrect",
      });
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
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Login failed",
      detail: error.message,
    });
  }
});

export default router;