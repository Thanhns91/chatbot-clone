import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT
        userId,
        fullName,
        email,
        role,
        status,
        createdAt
      FROM Users
      ORDER BY createdAt DESC
    `);

    res.json(users);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Cannot get users",
    });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query(
      "UPDATE Users SET status = ? WHERE userId = ?",
      [status, id]
    );

    res.json({
      success: true,
      message: "User status updated",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Update status failed",
    });
  }
});

router.put("/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    await pool.query(
      "UPDATE Users SET role = ? WHERE userId = ?",
      [role, id]
    );

    res.json({
      success: true,
      message: "User role updated",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Update role failed",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      "SELECT role FROM Users WHERE userId = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (rows[0].role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete admin",
      });
    }

    await pool.query(
      "DELETE FROM Users WHERE userId = ?",
      [id]
    );

    res.json({
      success: true,
      message: "User deleted",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Delete user failed",
    });
  }
});

export default router;