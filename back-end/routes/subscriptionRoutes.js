import express from "express";
import pool from "../db.js";

import {
  getActiveSubscription,
  getUserStorageInfo,
  calculateUpgradePreview,
  purchaseSubscriptionDemo,
  getPaymentHistory,
} from "../subscriptionService.js";

const router = express.Router();

router.get("/plans", async (req, res) => {
  try {
    const [plans] = await pool.query(
      `
      SELECT
        planId,
        planName,
        description,
        storageLimitBytes,
        price,
        durationDays,
        status,
        createdAt,
        updatedAt
      FROM SubscriptionPlans
      WHERE status = 'active'
      ORDER BY price ASC, planId ASC
      `,
    );

    return res.json({
      success: true,
      data: plans.map((plan) => ({
        ...plan,
        storageLimitBytes: Number(plan.storageLimitBytes || 0),
        price: Number(plan.price || 0),
        durationDays: Number(plan.durationDays || 0),
      })),
    });
  } catch (error) {
    console.log("Load subscription plans failed:", error);

    return res.status(500).json({
      success: false,
      message: "Cannot load subscription plans",
      detail: error.message,
    });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const subscription = await getActiveSubscription(userId);

    return res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    console.log("Load user subscription failed:", error);

    return res.status(500).json({
      success: false,
      message: "Cannot load user subscription",
      detail: error.message,
    });
  }
});

router.get("/storage/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const [users] = await pool.query(
      `
      SELECT userId
      FROM Users
      WHERE userId = ?
      LIMIT 1
      `,
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const storage = await getUserStorageInfo(userId);

    return res.json({
      success: true,
      data: storage,
    });
  } catch (error) {
    console.log("Load storage failed:", error);

    return res.status(500).json({
      success: false,
      message: "Cannot load storage information",
      detail: error.message,
    });
  }
});

router.post("/upgrade-preview", async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const targetPlanId = Number(req.body.targetPlanId);

    if (!userId || !targetPlanId) {
      return res.status(400).json({
        success: false,
        message: "userId and targetPlanId are required",
      });
    }

    const [users] = await pool.query(
      `
      SELECT userId, role, status
      FROM Users
      WHERE userId = ?
      LIMIT 1
      `,
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (users[0].role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can upgrade storage plans",
      });
    }

    const preview = await calculateUpgradePreview(userId, targetPlanId);

    return res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.log("Calculate upgrade preview failed:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Cannot calculate upgrade price",
    });
  }
});

/**
 * POST /subscriptions/purchase-demo
 *
 * Đây là thanh toán mô phỏng phục vụ project.
 * Không gọi cổng ngân hàng/VNPay/MoMo.
 */
router.post("/purchase-demo", async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const targetPlanId = Number(req.body.targetPlanId);

    if (!userId || !targetPlanId) {
      return res.status(400).json({
        success: false,
        message: "userId and targetPlanId are required",
      });
    }

    const result = await purchaseSubscriptionDemo({
      userId,
      targetPlanId,
    });

    return res.json({
      success: true,
      message: "Payment completed and subscription activated",
      data: result,
    });
  } catch (error) {
    console.log("Purchase subscription failed:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Cannot complete payment",
    });
  }
});

router.get("/payments/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const [users] = await pool.query(
      `SELECT userId FROM Users WHERE userId = ? LIMIT 1`,
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const payments = await getPaymentHistory(userId);

    return res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.log("Load payment history failed:", error);

    return res.status(500).json({
      success: false,
      message: "Cannot load payment history",
      detail: error.message,
    });
  }
});

export default router;
