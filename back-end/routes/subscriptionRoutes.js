import express from "express";
import pool from "../db.js";

import {
  getActiveSubscription,
  getUserStorageInfo,
  calculateUpgradePreview,
  scheduleSubscriptionCancellation,
  resumeSubscription,
  createPendingVnpayPayment,
  finalizeVnpayPayment,
  getPaymentByTransactionCode,
  getUserPaymentHistory,
} from "../subscriptionService.js";

import {
  buildVnpayPaymentUrl,
  getClientIp,
  getVnpayConfig,
  verifyVnpaySignature,
} from "../vnpay.js";

const router = express.Router();

const getSingleQueryValue = (value) =>
  Array.isArray(value) ? value[0] : value;

const getFrontendReturnUrl = () => {
  const value =
    process.env.VNPAY_CLIENT_RETURN_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:5173";

  return String(value).trim();
};

const redirectPaymentResult = (res, { status, txnRef = "", responseCode = "" }) => {
  try {
    const url = new URL(getFrontendReturnUrl());
    url.searchParams.set("payment", status);

    if (txnRef) {
      url.searchParams.set("txnRef", txnRef);
    }

    if (responseCode) {
      url.searchParams.set("vnp_ResponseCode", responseCode);
    }

    return res.redirect(url.toString());
  } catch {
    return res.status(500).send("Invalid VNPAY_CLIENT_RETURN_URL / CLIENT_URL");
  }
};

/**
 * GET /subscriptions/vnpay/config-check
 *
 * Chỉ trả URL public để kiểm tra cấu hình. Không bao giờ trả HashSecret.
 */
router.get("/vnpay/config-check", (req, res) => {
  try {
    const config = getVnpayConfig();

    return res.json({
      success: true,
      data: {
        paymentUrl: config.paymentUrl,
        returnUrl: config.returnUrl,
        frontendReturnUrl: getFrontendReturnUrl(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Invalid VNPAY configuration",
    });
  }
});

/**
 * GET /subscriptions/plans
 */
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

/**
 * GET /subscriptions/user/:userId
 */
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

/**
 * GET /subscriptions/storage/:userId
 */
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

/**
 * POST /subscriptions/cancel
 *
 * Đặt hủy ở cuối chu kỳ. Gói vẫn còn hiệu lực tới endDate.
 */
router.post("/cancel", async (req, res) => {
  try {
    const userId = Number(req.body.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const result = await scheduleSubscriptionCancellation(userId);

    return res.json({
      success: true,
      message:
        "Gói đã được đặt hủy. Bạn vẫn sử dụng gói hiện tại đến ngày hết hạn.",
      data: result,
    });
  } catch (error) {
    console.log("Cancel subscription failed:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Cannot cancel subscription",
    });
  }
});

/**
 * POST /subscriptions/resume
 *
 * Hủy yêu cầu cancel-at-period-end nếu user đổi ý trước ngày hết hạn.
 */
router.post("/resume", async (req, res) => {
  try {
    const userId = Number(req.body.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const result = await resumeSubscription(userId);

    return res.json({
      success: true,
      message: "Đã tiếp tục gói hiện tại.",
      data: result,
    });
  } catch (error) {
    console.log("Resume subscription failed:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Cannot resume subscription",
    });
  }
});

/**
 * POST /subscriptions/upgrade-preview
 */
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

    const user = users[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can purchase storage plans",
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
 * POST /subscriptions/vnpay/create-payment
 *
 * Tạo Payments(status=pending) rồi trả URL để browser redirect sang VNPAY Sandbox.
 */
router.post("/vnpay/create-payment", async (req, res) => {
  try {
    // Fail sớm nếu Railway chưa có cấu hình VNPAY.
    getVnpayConfig();

    const userId = Number(req.body.userId);
    const targetPlanId = Number(req.body.targetPlanId);
    const locale = req.body.locale === "en" ? "en" : "vn";
    const bankCode = String(req.body.bankCode || "").trim();

    if (!userId || !targetPlanId) {
      return res.status(400).json({
        success: false,
        message: "userId and targetPlanId are required",
      });
    }

    const payment = await createPendingVnpayPayment(userId, targetPlanId);

    const paymentUrl = buildVnpayPaymentUrl({
      txnRef: payment.transactionCode,
      amount: payment.finalAmount,
      orderInfo: `Thanh toan goi ${payment.targetPlan.planName} cho user ${userId}`,
      ipAddr: getClientIp(req),
      locale,
      bankCode,
    });

    return res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        transactionCode: payment.transactionCode,
        paymentType: payment.type,
        finalAmount: payment.finalAmount,
        targetPlan: payment.targetPlan,
        paymentUrl,
      },
    });
  } catch (error) {
    console.log("Create VNPAY payment failed:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Cannot create VNPAY payment",
    });
  }
});

/**
 * GET /subscriptions/vnpay/ipn
 *
 * URL server-to-server. Đây là nơi cập nhật payment/subscription chính thức.
 */
router.get("/vnpay/ipn", async (req, res) => {
  try {
    if (!verifyVnpaySignature(req.query)) {
      return res.status(200).json({
        RspCode: "97",
        Message: "Invalid Signature",
      });
    }

    const transactionCode = String(
      getSingleQueryValue(req.query.vnp_TxnRef) || "",
    );
    const amountRaw = Number(getSingleQueryValue(req.query.vnp_Amount) || 0);
    const responseCode = String(
      getSingleQueryValue(req.query.vnp_ResponseCode) || "",
    );
    const transactionStatus = String(
      getSingleQueryValue(req.query.vnp_TransactionStatus) || "",
    );
    const gatewayTransactionNo = String(
      getSingleQueryValue(req.query.vnp_TransactionNo) || "",
    );

    if (!transactionCode || !Number.isFinite(amountRaw)) {
      return res.status(200).json({
        RspCode: "99",
        Message: "Invalid request",
      });
    }

    const result = await finalizeVnpayPayment({
      transactionCode,
      gatewayAmountVnd: amountRaw / 100,
      responseCode,
      transactionStatus,
      gatewayTransactionNo: gatewayTransactionNo || null,
    });

    if (result.result === "not_found") {
      return res.status(200).json({
        RspCode: "01",
        Message: "Order not found",
      });
    }

    if (result.result === "invalid_amount") {
      return res.status(200).json({
        RspCode: "04",
        Message: "Invalid amount",
      });
    }

    if (result.result === "already_confirmed") {
      return res.status(200).json({
        RspCode: "02",
        Message: "Order already confirmed",
      });
    }

    return res.status(200).json({
      RspCode: "00",
      Message: "Confirm Success",
    });
  } catch (error) {
    console.log("VNPAY IPN failed:", error);

    return res.status(200).json({
      RspCode: "99",
      Message: "Unknown error",
    });
  }
});

/**
 * GET /subscriptions/vnpay/return
 *
 * IPN vẫn là luồng xác nhận chính. Tuy nhiên với Sandbox/demo, nếu IPN về chậm
 * hoặc chưa được VNPAY gọi tới, Return URL sẽ xác thực chữ ký + số tiền rồi
 * finalize luôn để user không bị treo ở trạng thái pending sau khi đã trả tiền.
 * finalizeVnpayPayment() có transaction + row lock nên gọi lặp từ IPN/Return
 * vẫn an toàn: giao dịch đã xác nhận sẽ trả already_confirmed.
 */
router.get("/vnpay/return", async (req, res) => {
  try {
    const transactionCode = String(
      getSingleQueryValue(req.query.vnp_TxnRef) || "",
    );
    const responseCode = String(
      getSingleQueryValue(req.query.vnp_ResponseCode) || "",
    );
    const transactionStatus = String(
      getSingleQueryValue(req.query.vnp_TransactionStatus) || "",
    );
    const gatewayTransactionNo = String(
      getSingleQueryValue(req.query.vnp_TransactionNo) || "",
    );
    const amountRaw = Number(
      getSingleQueryValue(req.query.vnp_Amount) || 0,
    );

    if (!verifyVnpaySignature(req.query)) {
      return redirectPaymentResult(res, {
        status: "invalid",
        txnRef: transactionCode,
        responseCode,
      });
    }

    if (!transactionCode || !Number.isFinite(amountRaw) || amountRaw <= 0) {
      return redirectPaymentResult(res, {
        status: "invalid",
        txnRef: transactionCode,
        responseCode,
      });
    }

    const result = await finalizeVnpayPayment({
      transactionCode,
      gatewayAmountVnd: amountRaw / 100,
      responseCode,
      transactionStatus,
      gatewayTransactionNo: gatewayTransactionNo || null,
    });

    let status = "error";

    if (result.result === "confirmed_paid") {
      status = "success";
    } else if (result.result === "confirmed_failed") {
      status = "failed";
    } else if (result.result === "not_found") {
      status = "not-found";
    } else if (result.result === "invalid_amount") {
      status = "invalid";
    } else if (result.result === "already_confirmed") {
      status = result.paymentStatus === "paid" ? "success" : "failed";
    }

    return redirectPaymentResult(res, {
      status,
      txnRef: transactionCode,
      responseCode,
    });
  } catch (error) {
    console.log("VNPAY return failed:", error);

    return redirectPaymentResult(res, {
      status: "error",
      txnRef: String(getSingleQueryValue(req.query.vnp_TxnRef) || ""),
      responseCode: String(
        getSingleQueryValue(req.query.vnp_ResponseCode) || "",
      ),
    });
  }
});
/**
 * GET /subscriptions/admin/revenue-stats
 *
 * Dashboard doanh thu Admin.
 * Chỉ tính giao dịch:
 * - status = 'paid'
 * - paidAt IS NOT NULL
 *
 * Doanh thu thực tế lấy từ Payments.finalAmount.
 */
router.get("/admin/revenue-stats", async (req, res) => {
  try {
    // =========================
    // TỔNG QUAN DOANH THU
    // =========================
    const [summaryRows] = await pool.query(
      `
      SELECT
        ROUND(COALESCE(SUM(finalAmount), 0)) AS totalRevenue,

        ROUND(
          COALESCE(
            SUM(
              CASE
                WHEN DATE(paidAt) = CURDATE()
                THEN finalAmount
                ELSE 0
              END
            ),
            0
          )
        ) AS todayRevenue,

        ROUND(
          COALESCE(
            SUM(
              CASE
                WHEN YEAR(paidAt) = YEAR(CURDATE())
                 AND MONTH(paidAt) = MONTH(CURDATE())
                THEN finalAmount
                ELSE 0
              END
            ),
            0
          )
        ) AS monthRevenue,

        COUNT(*) AS paidPayments,

        ROUND(
          COALESCE(
            AVG(finalAmount),
            0
          )
        ) AS averageOrderValue,

        SUM(
          CASE
            WHEN paymentType = 'new_subscription'
            THEN 1
            ELSE 0
          END
        ) AS newSubscriptions,

        SUM(
          CASE
            WHEN paymentType = 'upgrade'
            THEN 1
            ELSE 0
          END
        ) AS upgrades

      FROM Payments

      WHERE status = 'paid'
        AND paidAt IS NOT NULL
      `,
    );

    // =========================
    // DOANH THU 30 NGÀY
    // =========================
    const [revenueChartRows] = await pool.query(
      `
      SELECT
        DATE(paidAt) AS date,
        ROUND(COALESCE(SUM(finalAmount), 0)) AS revenue,
        COUNT(*) AS payments

      FROM Payments

      WHERE status = 'paid'
        AND paidAt IS NOT NULL
        AND paidAt >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)

      GROUP BY DATE(paidAt)

      ORDER BY DATE(paidAt) ASC
      `,
    );

    // =========================
    // DOANH THU THEO GÓI
    // =========================
    const [planRevenueRows] = await pool.query(
      `
      SELECT
        COALESCE(
          targetPlan.planId,
          subscriptionPlan.planId
        ) AS planId,

        COALESCE(
          targetPlan.planName,
          subscriptionPlan.planName,
          'Unknown'
        ) AS planName,

        ROUND(
          COALESCE(
            SUM(p.finalAmount),
            0
          )
        ) AS revenue,

        COUNT(*) AS payments

      FROM Payments p

      LEFT JOIN SubscriptionPlans targetPlan
        ON targetPlan.planId = p.targetPlanId

      LEFT JOIN UserSubscriptions us
        ON us.subscriptionId = p.subscriptionId

      LEFT JOIN SubscriptionPlans subscriptionPlan
        ON subscriptionPlan.planId = us.planId

      WHERE p.status = 'paid'
        AND p.paidAt IS NOT NULL

      GROUP BY
        COALESCE(
          targetPlan.planId,
          subscriptionPlan.planId
        ),
        COALESCE(
          targetPlan.planName,
          subscriptionPlan.planName,
          'Unknown'
        )

      ORDER BY revenue DESC, planName ASC
      `,
    );

    // =========================
    // 8 THANH TOÁN GẦN NHẤT
    // =========================
    const [recentPaymentRows] = await pool.query(
      `
      SELECT
        p.paymentId,
        p.userId,

        u.fullName,
        u.email,

        p.paymentType,
        p.finalAmount,
        p.paymentMethod,
        p.transactionCode,
        p.paidAt,

        COALESCE(
          targetPlan.planName,
          subscriptionPlan.planName,
          'Unknown'
        ) AS planName

      FROM Payments p

      INNER JOIN Users u
        ON u.userId = p.userId

      LEFT JOIN SubscriptionPlans targetPlan
        ON targetPlan.planId = p.targetPlanId

      LEFT JOIN UserSubscriptions us
        ON us.subscriptionId = p.subscriptionId

      LEFT JOIN SubscriptionPlans subscriptionPlan
        ON subscriptionPlan.planId = us.planId

      WHERE p.status = 'paid'
        AND p.paidAt IS NOT NULL

      ORDER BY
        p.paidAt DESC,
        p.paymentId DESC

      LIMIT 8
      `,
    );

    const summary = summaryRows[0] || {};

    return res.json({
      success: true,

      data: {
        summary: {
          totalRevenue: Number(
            summary.totalRevenue || 0,
          ),

          todayRevenue: Number(
            summary.todayRevenue || 0,
          ),

          monthRevenue: Number(
            summary.monthRevenue || 0,
          ),

          paidPayments: Number(
            summary.paidPayments || 0,
          ),

          averageOrderValue: Number(
            summary.averageOrderValue || 0,
          ),

          newSubscriptions: Number(
            summary.newSubscriptions || 0,
          ),

          upgrades: Number(
            summary.upgrades || 0,
          ),
        },

        revenueChart: revenueChartRows.map(
          (row) => ({
            date: row.date,

            revenue: Number(
              row.revenue || 0,
            ),

            payments: Number(
              row.payments || 0,
            ),
          }),
        ),

        planRevenue: planRevenueRows.map(
          (row) => ({
            planId:
              row.planId == null
                ? null
                : Number(row.planId),

            planName:
              row.planName || "Unknown",

            revenue: Number(
              row.revenue || 0,
            ),

            payments: Number(
              row.payments || 0,
            ),
          }),
        ),

        recentPayments: recentPaymentRows.map(
          (row) => ({
            ...row,

            paymentId: Number(
              row.paymentId,
            ),

            userId: Number(
              row.userId,
            ),

            finalAmount: Number(
              row.finalAmount || 0,
            ),
          }),
        ),
      },
    });
  } catch (error) {
    console.log(
      "Load admin revenue stats failed:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Cannot load revenue statistics",
      detail: error.message,
    });
  }
});
router.get("/payment-status/:transactionCode", async (req, res) => {
  try {
    const transactionCode = String(req.params.transactionCode || "").trim();

    if (!transactionCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid transactionCode",
      });
    }

    const payment = await getPaymentByTransactionCode(transactionCode);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.log("Load payment status failed:", error);

    return res.status(500).json({
      success: false,
      message: "Cannot load payment status",
      detail: error.message,
    });
  }
});

/**
 * GET /subscriptions/payments/:userId
 */
router.get("/payments/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const payments = await getUserPaymentHistory(userId);

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
