import crypto from "crypto";
import pool from "./db.js";

// Fallback only. Khi bảng SubscriptionPlans có gói Free active,
// hệ thống sẽ ưu tiên storageLimitBytes trong database.
export const FREE_STORAGE_LIMIT_BYTES = 150 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

const normalizePlan = (plan) => {
  if (!plan) return null;

  return {
    ...plan,
    storageLimitBytes: Number(plan.storageLimitBytes || 0),
    price: Number(plan.price || 0),
    durationDays: Number(plan.durationDays || 0),
  };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function calculateProration({ currentSubscription, targetPlan, now = new Date() }) {
  if (!currentSubscription) {
    return {
      type: "new_subscription",
      originalAmount: Number(targetPlan.price || 0),
      discountAmount: 0,
      finalAmount: Number(targetPlan.price || 0),
      remainingRatio: 1,
      oldRemainingRatio: 0,
      endDate: null,
    };
  }

  const currentPrice = Number(currentSubscription.price || 0);
  const targetPrice = Number(targetPlan.price || 0);
  const endMs = new Date(currentSubscription.endDate).getTime();
  const nowMs = now.getTime();

  if (!Number.isFinite(endMs) || endMs <= nowMs) {
    throw new Error("Current subscription is expired");
  }

  const remainingMs = endMs - nowMs;
  const currentDurationDays = Math.max(
    Number(currentSubscription.durationDays || 30),
    1,
  );
  const targetDurationDays = Math.max(Number(targetPlan.durationDays || 30), 1);

  // Mỗi gói được quy đổi theo chính durationDays của gói.
  // Với các gói 30 ngày: remainingRatio = số ngày còn lại / 30.
  const oldRemainingRatio = clamp(
    remainingMs / (currentDurationDays * DAY_MS),
    0,
    1,
  );
  const targetRemainingRatio = clamp(
    remainingMs / (targetDurationDays * DAY_MS),
    0,
    1,
  );

  const oldPlanCredit = currentPrice * oldRemainingRatio;
  const targetRemainingCost = targetPrice * targetRemainingRatio;
  const finalAmount = Math.max(targetRemainingCost - oldPlanCredit, 0);

  return {
    type: "upgrade",
    originalAmount: Math.round(targetRemainingCost),
    discountAmount: Math.round(oldPlanCredit),
    finalAmount: Math.round(finalAmount),
    remainingRatio: Number(targetRemainingRatio.toFixed(6)),
    oldRemainingRatio: Number(oldRemainingRatio.toFixed(6)),
    endDate: currentSubscription.endDate,
  };
}

export async function getFreePlan() {
  const [rows] = await pool.query(
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
    WHERE LOWER(planName) = 'free'
      AND status = 'active'
    ORDER BY planId ASC
    LIMIT 1
    `,
  );

  return normalizePlan(rows[0] || null);
}

export async function getActiveSubscription(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      us.subscriptionId,
      us.userId,
      us.planId,
      us.startDate,
      us.endDate,
      us.amountPaid,
      us.status AS subscriptionStatus,
      us.previousSubscriptionId,

      sp.planName,
      sp.description,
      sp.storageLimitBytes,
      sp.price,
      sp.durationDays,
      sp.status AS planStatus

    FROM UserSubscriptions us

    INNER JOIN SubscriptionPlans sp
      ON sp.planId = us.planId

    WHERE us.userId = ?
      AND us.status = 'active'
      AND us.startDate <= NOW()
      AND us.endDate > NOW()
      AND sp.status = 'active'

    ORDER BY
      us.startDate DESC,
      us.subscriptionId DESC

    LIMIT 1
    `,
    [userId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    storageLimitBytes: Number(row.storageLimitBytes || 0),
    price: Number(row.price || 0),
    durationDays: Number(row.durationDays || 0),
    amountPaid: Number(row.amountPaid || 0),
  };
}

export async function getUsedStorage(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      COALESCE(SUM(fileSizeBytes), 0) AS usedBytes,
      COUNT(*) AS documentCount

    FROM Documents

    WHERE uploaderId = ?
      AND isDeleted = FALSE
      AND uploadStatus = 'success'
    `,
    [userId],
  );

  return {
    usedBytes: Number(rows[0]?.usedBytes || 0),
    documentCount: Number(rows[0]?.documentCount || 0),
  };
}

export async function getUserStorageInfo(userId) {
  const [subscription, usage, freePlan] = await Promise.all([
    getActiveSubscription(userId),
    getUsedStorage(userId),
    getFreePlan(),
  ]);

  const fallbackFreePlan = freePlan || {
    planId: null,
    planName: "Free",
    storageLimitBytes: FREE_STORAGE_LIMIT_BYTES,
    price: 0,
    durationDays: 30,
  };

  const currentPlan = subscription || fallbackFreePlan;
  const limitBytes = Number(
    currentPlan.storageLimitBytes || FREE_STORAGE_LIMIT_BYTES,
  );

  const remainingBytes = Math.max(limitBytes - usage.usedBytes, 0);

  const percentage =
    limitBytes > 0
      ? Number(
          Math.min((usage.usedBytes / limitBytes) * 100, 100).toFixed(2),
        )
      : 0;

  return {
    userId: Number(userId),
    usedBytes: usage.usedBytes,
    documentCount: usage.documentCount,
    limitBytes,
    remainingBytes,
    percentage,

    plan: {
      planId: currentPlan.planId ?? null,
      planName: currentPlan.planName || "Free",
      price: Number(currentPlan.price || 0),
      storageLimitBytes: limitBytes,
      durationDays: Number(currentPlan.durationDays || 30),
    },

    subscription: subscription
      ? {
          subscriptionId: subscription.subscriptionId,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          amountPaid: Number(subscription.amountPaid || 0),
          status: subscription.subscriptionStatus,
        }
      : null,
  };
}

export async function checkUploadQuota({
  userId,
  incomingBytes,
  replaceDocumentId = null,
}) {
  const storage = await getUserStorageInfo(userId);

  let replacedBytes = 0;

  if (replaceDocumentId) {
    const [rows] = await pool.query(
      `
      SELECT
        uploaderId,
        fileSizeBytes
      FROM Documents
      WHERE documentId = ?
        AND isDeleted = FALSE
      LIMIT 1
      `,
      [replaceDocumentId],
    );

    const oldDocument = rows[0];

    if (
      oldDocument &&
      Number(oldDocument.uploaderId) === Number(userId)
    ) {
      replacedBytes = Number(oldDocument.fileSizeBytes || 0);
    }
  }

  const effectiveUsedBytes = Math.max(storage.usedBytes - replacedBytes, 0);
  const projectedBytes = effectiveUsedBytes + Number(incomingBytes || 0);

  return {
    ...storage,
    incomingBytes: Number(incomingBytes || 0),
    replacedBytes,
    effectiveUsedBytes,
    projectedBytes,
    allowed: projectedBytes <= storage.limitBytes,
  };
}

export async function getSubscriptionPlan(planId) {
  const [rows] = await pool.query(
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
    WHERE planId = ?
    LIMIT 1
    `,
    [planId],
  );

  return normalizePlan(rows[0] || null);
}

export async function calculateUpgradePreview(userId, targetPlanId) {
  const [targetPlan, currentSubscription, freePlan] = await Promise.all([
    getSubscriptionPlan(targetPlanId),
    getActiveSubscription(userId),
    getFreePlan(),
  ]);

  if (!targetPlan || targetPlan.status !== "active") {
    throw new Error("Subscription plan not found or inactive");
  }

  const currentPrice = Number(currentSubscription?.price || 0);

  if (Number(targetPlan.price || 0) <= currentPrice) {
    throw new Error("Target plan must have a higher price than current plan");
  }

  const proration = calculateProration({
    currentSubscription,
    targetPlan,
  });

  const currentPlan = currentSubscription
    ? {
        planId: currentSubscription.planId,
        planName: currentSubscription.planName,
        price: Number(currentSubscription.price || 0),
        storageLimitBytes: Number(currentSubscription.storageLimitBytes || 0),
      }
    : {
        planId: freePlan?.planId ?? null,
        planName: freePlan?.planName || "Free",
        price: Number(freePlan?.price || 0),
        storageLimitBytes: Number(
          freePlan?.storageLimitBytes || FREE_STORAGE_LIMIT_BYTES,
        ),
      };

  return {
    type: proration.type,
    currentPlan,
    targetPlan,
    originalAmount: proration.originalAmount,
    discountAmount: proration.discountAmount,
    finalAmount: proration.finalAmount,
    remainingRatio: proration.remainingRatio,
    oldRemainingRatio: proration.oldRemainingRatio,
    startDate: currentSubscription?.startDate || null,
    endDate: proration.endDate,
  };
}

/**
 * Thanh toán DEMO cho project học tập.
 * Hàm này KHÔNG kết nối ngân hàng/VNPay/MoMo.
 * Khi transaction DB thành công, Payment được đánh dấu paid ngay và gói được kích hoạt.
 */
export async function purchaseSubscriptionDemo({ userId, targetPlanId }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Dọn những subscription đã hết hạn nhưng status vẫn còn active.
    await connection.query(
      `
      UPDATE UserSubscriptions
      SET status = 'expired'
      WHERE userId = ?
        AND status = 'active'
        AND endDate <= NOW()
      `,
      [userId],
    );

    const [users] = await connection.query(
      `
      SELECT userId, role, status
      FROM Users
      WHERE userId = ?
      LIMIT 1
      FOR UPDATE
      `,
      [userId],
    );

    const user = users[0];

    if (!user) {
      throw new Error("User not found");
    }

    if (user.role !== "student") {
      throw new Error("Only students can purchase storage plans");
    }

    if (user.status !== "active") {
      throw new Error("User account is not active");
    }

    const [planRows] = await connection.query(
      `
      SELECT
        planId,
        planName,
        description,
        storageLimitBytes,
        price,
        durationDays,
        status
      FROM SubscriptionPlans
      WHERE planId = ?
        AND status = 'active'
      LIMIT 1
      `,
      [targetPlanId],
    );

    const targetPlan = normalizePlan(planRows[0] || null);

    if (!targetPlan) {
      throw new Error("Subscription plan not found or inactive");
    }

    const [currentRows] = await connection.query(
      `
      SELECT
        us.subscriptionId,
        us.userId,
        us.planId,
        us.startDate,
        us.endDate,
        us.amountPaid,
        us.status AS subscriptionStatus,
        us.previousSubscriptionId,
        sp.planName,
        sp.storageLimitBytes,
        sp.price,
        sp.durationDays
      FROM UserSubscriptions us
      INNER JOIN SubscriptionPlans sp
        ON sp.planId = us.planId
      WHERE us.userId = ?
        AND us.status = 'active'
        AND us.startDate <= NOW()
        AND us.endDate > NOW()
      ORDER BY us.startDate DESC, us.subscriptionId DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId],
    );

    const currentSubscription = currentRows[0]
      ? {
          ...currentRows[0],
          price: Number(currentRows[0].price || 0),
          durationDays: Number(currentRows[0].durationDays || 30),
        }
      : null;

    const currentPrice = Number(currentSubscription?.price || 0);

    if (targetPlan.price <= currentPrice) {
      throw new Error("Target plan must have a higher price than current plan");
    }

    const now = new Date();
    const proration = calculateProration({
      currentSubscription,
      targetPlan,
      now,
    });

    let endDate;
    let previousSubscriptionId = null;

    if (currentSubscription) {
      endDate = currentSubscription.endDate;
      previousSubscriptionId = currentSubscription.subscriptionId;

      await connection.query(
        `
        UPDATE UserSubscriptions
        SET status = 'upgraded'
        WHERE subscriptionId = ?
        `,
        [currentSubscription.subscriptionId],
      );
    } else {
      const durationDays = Math.max(Number(targetPlan.durationDays || 30), 1);
      endDate = new Date(now.getTime() + durationDays * DAY_MS);
    }

    const [subscriptionResult] = await connection.query(
      `
      INSERT INTO UserSubscriptions
      (
        userId,
        planId,
        startDate,
        endDate,
        amountPaid,
        status,
        previousSubscriptionId
      )
      VALUES (?, ?, ?, ?, ?, 'active', ?)
      `,
      [
        userId,
        targetPlan.planId,
        now,
        endDate,
        proration.finalAmount,
        previousSubscriptionId,
      ],
    );

    const subscriptionId = Number(subscriptionResult.insertId);
    const transactionCode = `DEMO-${Date.now()}-${crypto.randomUUID()}`;

    const [paymentResult] = await connection.query(
      `
      INSERT INTO Payments
      (
        userId,
        subscriptionId,
        paymentType,
        originalAmount,
        discountAmount,
        finalAmount,
        paymentMethod,
        status,
        transactionCode,
        paidAt
      )
      VALUES (?, ?, ?, ?, ?, ?, 'demo', 'paid', ?, NOW())
      `,
      [
        userId,
        subscriptionId,
        proration.type,
        proration.originalAmount,
        proration.discountAmount,
        proration.finalAmount,
        transactionCode,
      ],
    );

    await connection.commit();

    const storage = await getUserStorageInfo(userId);

    return {
      payment: {
        paymentId: Number(paymentResult.insertId),
        userId: Number(userId),
        subscriptionId,
        paymentType: proration.type,
        originalAmount: proration.originalAmount,
        discountAmount: proration.discountAmount,
        finalAmount: proration.finalAmount,
        paymentMethod: "demo",
        status: "paid",
        transactionCode,
        paidAt: new Date().toISOString(),
      },
      subscription: {
        subscriptionId,
        userId: Number(userId),
        planId: targetPlan.planId,
        planName: targetPlan.planName,
        startDate: now,
        endDate,
        amountPaid: proration.finalAmount,
        status: "active",
        previousSubscriptionId,
      },
      storage,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getPaymentHistory(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      p.paymentId,
      p.userId,
      p.subscriptionId,
      p.paymentType,
      p.originalAmount,
      p.discountAmount,
      p.finalAmount,
      p.paymentMethod,
      p.status,
      p.transactionCode,
      p.paidAt,
      p.createdAt,
      us.planId,
      sp.planName
    FROM Payments p
    LEFT JOIN UserSubscriptions us
      ON us.subscriptionId = p.subscriptionId
    LEFT JOIN SubscriptionPlans sp
      ON sp.planId = us.planId
    WHERE p.userId = ?
    ORDER BY p.createdAt DESC, p.paymentId DESC
    `,
    [userId],
  );

  return rows.map((row) => ({
    ...row,
    originalAmount: Number(row.originalAmount || 0),
    discountAmount: Number(row.discountAmount || 0),
    finalAmount: Number(row.finalAmount || 0),
  }));
}
