import crypto from "crypto";
import pool from "./db.js";

// User chưa có gói trả phí -> mặc định 150 MB.
export const FREE_STORAGE_LIMIT_BYTES = 150 * 1024 * 1024;

function normalizePlan(plan) {
  if (!plan) return null;

  return {
    ...plan,
    storageLimitBytes: Number(plan.storageLimitBytes || 0),
    price: Number(plan.price || 0),
    durationDays: Number(plan.durationDays || 0),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function calculateDaysBetween(startValue, endValue) {
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return Math.max(Math.ceil((end - start) / DAY_MS), 0);
}

function calculateRemainingDays(endValue) {
  return calculateDaysBetween(Date.now(), endValue);
}

function calculatePreviewFromRows(currentSubscription, targetPlan) {
  const normalizedTarget = normalizePlan(targetPlan);

  if (!normalizedTarget) {
    throw new Error("Subscription plan not found");
  }

  if (normalizedTarget.status !== "active") {
    throw new Error("Subscription plan is inactive");
  }

  if (Number(normalizedTarget.price || 0) <= 0) {
    throw new Error("Free plan cannot be purchased");
  }

  if (!currentSubscription) {
    return {
      type: "new_subscription",
      currentPlan: {
        planId: null,
        planName: "Free",
        price: 0,
        storageLimitBytes: FREE_STORAGE_LIMIT_BYTES,
      },
      targetPlan: normalizedTarget,
      originalAmount: normalizedTarget.price,
      discountAmount: 0,
      finalAmount: normalizedTarget.price,
      totalDays: normalizedTarget.durationDays,
      remainingDays: normalizedTarget.durationDays,
      remainingRatio: 1,
      startDate: null,
      endDate: null,
    };
  }

  const currentPrice = Number(currentSubscription.price || 0);

  if (normalizedTarget.price <= currentPrice) {
    throw new Error("Target plan must have a higher price than current plan");
  }

  // Dùng durationDays của plan làm chu kỳ tính giá, không dùng khoảng
  // startDate -> endDate. Điều này quan trọng khi user upgrade nhiều lần:
  // subscription mới bắt đầu giữa chu kỳ nhưng giá/ngày vẫn phải dựa trên
  // giá niêm yết của plan / durationDays (ví dụ 30 ngày).
  const currentPlanDays = Math.max(
    Number(currentSubscription.durationDays || 30),
    1,
  );
  const targetPlanDays = Math.max(Number(normalizedTarget.durationDays || 30), 1);
  const remainingDays = Math.min(
    calculateRemainingDays(currentSubscription.endDate),
    currentPlanDays,
  );

  if (remainingDays <= 0) {
    throw new Error("Current subscription period is invalid or expired");
  }

  // Ví dụ Basic 50k/30 -> Pro 100k/30, còn 20 ngày:
  // credit Basic = 50k / 30 * 20
  // chi phí Pro = 100k / 30 * 20
  // user chỉ trả phần chênh lệch.
  const remainingRatio = remainingDays / currentPlanDays;
  const oldPlanCredit = (currentPrice / currentPlanDays) * remainingDays;
  const targetRemainingCost =
    (normalizedTarget.price / targetPlanDays) * remainingDays;
  const finalAmount = Math.max(targetRemainingCost - oldPlanCredit, 0);

  return {
    type: "upgrade",
    currentPlan: {
      planId: currentSubscription.planId,
      planName: currentSubscription.planName,
      price: currentPrice,
      storageLimitBytes: Number(currentSubscription.storageLimitBytes || 0),
    },
    targetPlan: normalizedTarget,
    originalAmount: Math.round(targetRemainingCost),
    discountAmount: Math.round(oldPlanCredit),
    finalAmount: Math.round(finalAmount),
    totalDays: currentPlanDays,
    targetDurationDays: targetPlanDays,
    remainingDays,
    remainingRatio: Number(remainingRatio.toFixed(6)),
    startDate: currentSubscription.startDate,
    endDate: currentSubscription.endDate,
  };
}


async function expireEndedSubscriptions(userId) {
  await pool.query(
    `
    UPDATE UserSubscriptions
    SET status = 'expired'
    WHERE userId = ?
      AND status = 'active'
      AND endDate <= NOW()
    `,
    [userId],
  );
}

async function getLatestExpiredSubscription(userId) {
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
      us.cancelAtPeriodEnd,
      us.cancelledAt,
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
      AND us.status = 'expired'
      AND sp.status = 'active'
      AND sp.price > 0
    ORDER BY us.endDate DESC, us.subscriptionId DESC
    LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

export async function getActiveSubscription(userId) {
  await expireEndedSubscriptions(userId);

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
      us.cancelAtPeriodEnd,
      us.cancelledAt,
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
      AND sp.status = 'active'
      AND us.startDate <= NOW()
      AND us.endDate > NOW()

    ORDER BY
      us.startDate DESC,
      us.subscriptionId DESC

    LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
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
  const subscription = await getActiveSubscription(userId);
  const renewalOffer = subscription
    ? null
    : await getLatestExpiredSubscription(userId);
  const usage = await getUsedStorage(userId);

  const limitBytes = subscription
    ? Number(subscription.storageLimitBytes || 0)
    : FREE_STORAGE_LIMIT_BYTES;

  const remainingBytes = Math.max(limitBytes - usage.usedBytes, 0);

  const percentage =
    limitBytes > 0
      ? Number(Math.min((usage.usedBytes / limitBytes) * 100, 100).toFixed(2))
      : 0;

  return {
    userId: Number(userId),
    usedBytes: usage.usedBytes,
    documentCount: usage.documentCount,
    limitBytes,
    remainingBytes,
    percentage,
    plan: subscription
      ? {
          planId: subscription.planId,
          planName: subscription.planName,
          price: Number(subscription.price || 0),
          durationDays: Number(subscription.durationDays || 0),
        }
      : {
          planId: null,
          planName: "Free",
          price: 0,
          durationDays: null,
        },
    subscription: subscription
      ? {
          subscriptionId: subscription.subscriptionId,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          amountPaid: Number(subscription.amountPaid || 0),
          status: subscription.subscriptionStatus,
          cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
          cancelledAt: subscription.cancelledAt || null,
          remainingDays: calculateRemainingDays(subscription.endDate),
        }
      : null,
    renewalOffer: renewalOffer
      ? {
          subscriptionId: renewalOffer.subscriptionId,
          planId: renewalOffer.planId,
          planName: renewalOffer.planName,
          price: Number(renewalOffer.price || 0),
          storageLimitBytes: Number(renewalOffer.storageLimitBytes || 0),
          durationDays: Number(renewalOffer.durationDays || 30),
          expiredAt: renewalOffer.endDate,
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
      SELECT uploaderId, fileSizeBytes
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
  const targetPlan = await getSubscriptionPlan(targetPlanId);
  const currentSubscription = await getActiveSubscription(userId);

  return calculatePreviewFromRows(currentSubscription, targetPlan);
}

function createTransactionCode(userId) {
  const randomPart = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `PAY${Date.now()}U${Number(userId)}${randomPart}`;
}

async function getLockedActiveSubscription(connection, userId) {
  const [rows] = await connection.query(
    `
    SELECT
      us.subscriptionId,
      us.userId,
      us.planId,
      us.startDate,
      us.endDate,
      us.amountPaid,
      us.status AS subscriptionStatus,
      us.cancelAtPeriodEnd,
      us.cancelledAt,
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
      AND sp.status = 'active'
      AND us.startDate <= NOW()
      AND us.endDate > NOW()
    ORDER BY us.startDate DESC, us.subscriptionId DESC
    LIMIT 1
    FOR UPDATE
    `,
    [userId],
  );

  return rows[0] || null;
}

export async function scheduleSubscriptionCancellation(userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const subscription = await getLockedActiveSubscription(connection, userId);

    if (!subscription) {
      throw new Error("No active paid subscription found");
    }

    if (subscription.cancelAtPeriodEnd) {
      await connection.commit();
      return {
        changed: false,
        subscriptionId: subscription.subscriptionId,
        endDate: subscription.endDate,
        remainingDays: calculateRemainingDays(subscription.endDate),
        cancelAtPeriodEnd: true,
      };
    }

    await connection.query(
      `
      UPDATE UserSubscriptions
      SET
        cancelAtPeriodEnd = TRUE,
        cancelledAt = NOW()
      WHERE subscriptionId = ?
      `,
      [subscription.subscriptionId],
    );

    await connection.commit();

    return {
      changed: true,
      subscriptionId: subscription.subscriptionId,
      endDate: subscription.endDate,
      remainingDays: calculateRemainingDays(subscription.endDate),
      cancelAtPeriodEnd: true,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function resumeSubscription(userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const subscription = await getLockedActiveSubscription(connection, userId);

    if (!subscription) {
      throw new Error("No active paid subscription found");
    }

    if (!subscription.cancelAtPeriodEnd) {
      await connection.commit();
      return {
        changed: false,
        subscriptionId: subscription.subscriptionId,
        endDate: subscription.endDate,
        remainingDays: calculateRemainingDays(subscription.endDate),
        cancelAtPeriodEnd: false,
      };
    }

    await connection.query(
      `
      UPDATE UserSubscriptions
      SET
        cancelAtPeriodEnd = FALSE,
        cancelledAt = NULL
      WHERE subscriptionId = ?
      `,
      [subscription.subscriptionId],
    );

    await connection.commit();

    return {
      changed: true,
      subscriptionId: subscription.subscriptionId,
      endDate: subscription.endDate,
      remainingDays: calculateRemainingDays(subscription.endDate),
      cancelAtPeriodEnd: false,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createPendingVnpayPayment(userId, targetPlanId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

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
      LIMIT 1
      FOR UPDATE
      `,
      [targetPlanId],
    );

    const targetPlan = normalizePlan(planRows[0] || null);

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

    const currentSubscription = await getLockedActiveSubscription(
      connection,
      userId,
    );

    const preview = calculatePreviewFromRows(currentSubscription, targetPlan);

    if (preview.finalAmount <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }

    // Một user chỉ nên có một yêu cầu VNPAY pending tại một thời điểm.
    await connection.query(
      `
      UPDATE Payments
      SET status = 'cancelled'
      WHERE userId = ?
        AND paymentMethod = 'vnpay'
        AND status = 'pending'
      `,
      [userId],
    );

    const transactionCode = createTransactionCode(userId);
    const sourceSubscriptionId = currentSubscription?.subscriptionId || null;

    const [result] = await connection.query(
      `
      INSERT INTO Payments (
        userId,
        subscriptionId,
        targetPlanId,
        sourceSubscriptionId,
        paymentType,
        originalAmount,
        discountAmount,
        finalAmount,
        paymentMethod,
        status,
        transactionCode
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'vnpay', 'pending', ?)
      `,
      [
        userId,
        targetPlan.planId,
        sourceSubscriptionId,
        preview.type,
        preview.originalAmount,
        preview.discountAmount,
        preview.finalAmount,
        transactionCode,
      ],
    );

    await connection.commit();

    return {
      paymentId: result.insertId,
      transactionCode,
      targetPlan,
      sourceSubscriptionId,
      ...preview,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getPaymentByTransactionCode(transactionCode) {
  const [rows] = await pool.query(
    `
    SELECT
      p.paymentId,
      p.userId,
      p.subscriptionId,
      p.targetPlanId,
      p.sourceSubscriptionId,
      p.paymentType,
      p.originalAmount,
      p.discountAmount,
      p.finalAmount,
      p.paymentMethod,
      p.status,
      p.transactionCode,
      p.gatewayTransactionNo,
      p.gatewayResponseCode,
      p.paidAt,
      p.createdAt,
      sp.planName,
      sp.storageLimitBytes,
      sp.price AS planPrice
    FROM Payments p
    LEFT JOIN SubscriptionPlans sp
      ON sp.planId = p.targetPlanId
    WHERE p.transactionCode = ?
    LIMIT 1
    `,
    [transactionCode],
  );

  if (!rows[0]) return null;

  return {
    ...rows[0],
    originalAmount: Number(rows[0].originalAmount || 0),
    discountAmount: Number(rows[0].discountAmount || 0),
    finalAmount: Number(rows[0].finalAmount || 0),
    storageLimitBytes: Number(rows[0].storageLimitBytes || 0),
    planPrice: Number(rows[0].planPrice || 0),
  };
}

export async function finalizeVnpayPayment({
  transactionCode,
  gatewayAmountVnd,
  responseCode,
  transactionStatus,
  gatewayTransactionNo = null,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [paymentRows] = await connection.query(
      `
      SELECT
        p.*,
        sp.planName,
        sp.storageLimitBytes,
        sp.price AS planPrice,
        sp.durationDays,
        sp.status AS planStatus
      FROM Payments p
      LEFT JOIN SubscriptionPlans sp
        ON sp.planId = p.targetPlanId
      WHERE p.transactionCode = ?
      LIMIT 1
      FOR UPDATE
      `,
      [transactionCode],
    );

    const payment = paymentRows[0];

    if (!payment) {
      await connection.rollback();
      return { result: "not_found" };
    }

    const expectedAmount = Math.round(Number(payment.finalAmount || 0));
    const receivedAmount = Math.round(Number(gatewayAmountVnd || 0));

    if (expectedAmount !== receivedAmount) {
      await connection.rollback();
      return { result: "invalid_amount" };
    }

    if (payment.status !== "pending") {
      await connection.rollback();
      return {
        result: "already_confirmed",
        paymentStatus: payment.status,
      };
    }

    const gatewaySuccess =
      String(responseCode) === "00" && String(transactionStatus) === "00";

    if (!gatewaySuccess) {
      await connection.query(
        `
        UPDATE Payments
        SET
          status = 'failed',
          gatewayTransactionNo = ?,
          gatewayResponseCode = ?
        WHERE paymentId = ?
        `,
        [gatewayTransactionNo, String(responseCode || ""), payment.paymentId],
      );

      await connection.commit();

      return {
        result: "confirmed_failed",
        paymentId: payment.paymentId,
      };
    }

    if (!payment.targetPlanId || payment.planStatus !== "active") {
      throw new Error("Target subscription plan is unavailable");
    }

    let newEndDate = null;
    let previousSubscriptionId = null;

    if (payment.paymentType === "upgrade") {
      if (!payment.sourceSubscriptionId) {
        throw new Error("Source subscription is missing");
      }

      const [sourceRows] = await connection.query(
        `
        SELECT subscriptionId, userId, endDate, status
        FROM UserSubscriptions
        WHERE subscriptionId = ?
        LIMIT 1
        FOR UPDATE
        `,
        [payment.sourceSubscriptionId],
      );

      const sourceSubscription = sourceRows[0];

      if (
        !sourceSubscription ||
        Number(sourceSubscription.userId) !== Number(payment.userId) ||
        sourceSubscription.status !== "active"
      ) {
        throw new Error("Source subscription is no longer active");
      }

      previousSubscriptionId = sourceSubscription.subscriptionId;
      newEndDate = sourceSubscription.endDate;

      await connection.query(
        `
        UPDATE UserSubscriptions
        SET status = 'upgraded'
        WHERE subscriptionId = ?
        `,
        [sourceSubscription.subscriptionId],
      );
    } else {
      const [activeRows] = await connection.query(
        `
        SELECT subscriptionId
        FROM UserSubscriptions
        WHERE userId = ?
          AND status = 'active'
          AND startDate <= NOW()
          AND endDate > NOW()
        LIMIT 1
        FOR UPDATE
        `,
        [payment.userId],
      );

      if (activeRows.length > 0) {
        throw new Error("User already has an active subscription");
      }
    }

    let subscriptionResult;

    if (payment.paymentType === "upgrade") {
      [subscriptionResult] = await connection.query(
        `
        INSERT INTO UserSubscriptions (
          userId,
          planId,
          startDate,
          endDate,
          amountPaid,
          status,
          previousSubscriptionId
        )
        VALUES (?, ?, NOW(), ?, ?, 'active', ?)
        `,
        [
          payment.userId,
          payment.targetPlanId,
          newEndDate,
          expectedAmount,
          previousSubscriptionId,
        ],
      );
    } else {
      [subscriptionResult] = await connection.query(
        `
        INSERT INTO UserSubscriptions (
          userId,
          planId,
          startDate,
          endDate,
          amountPaid,
          status,
          previousSubscriptionId
        )
        VALUES (
          ?,
          ?,
          NOW(),
          DATE_ADD(NOW(), INTERVAL ? DAY),
          ?,
          'active',
          NULL
        )
        `,
        [
          payment.userId,
          payment.targetPlanId,
          Number(payment.durationDays || 30),
          expectedAmount,
        ],
      );
    }

    const subscriptionId = subscriptionResult.insertId;

    await connection.query(
      `
      UPDATE Payments
      SET
        subscriptionId = ?,
        status = 'paid',
        gatewayTransactionNo = ?,
        gatewayResponseCode = ?,
        paidAt = NOW()
      WHERE paymentId = ?
      `,
      [
        subscriptionId,
        gatewayTransactionNo,
        String(responseCode || ""),
        payment.paymentId,
      ],
    );

    await connection.commit();

    return {
      result: "confirmed_paid",
      paymentId: payment.paymentId,
      subscriptionId,
      userId: payment.userId,
      planId: payment.targetPlanId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getUserPaymentHistory(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      p.paymentId,
      p.userId,
      p.subscriptionId,
      p.targetPlanId,
      p.sourceSubscriptionId,
      p.paymentType,
      p.originalAmount,
      p.discountAmount,
      p.finalAmount,
      p.paymentMethod,
      p.status,
      p.transactionCode,
      p.gatewayTransactionNo,
      p.gatewayResponseCode,
      p.paidAt,
      p.createdAt,
      sp.planName
    FROM Payments p
    LEFT JOIN SubscriptionPlans sp
      ON sp.planId = p.targetPlanId
    WHERE p.userId = ?
    ORDER BY p.createdAt DESC, p.paymentId DESC
    LIMIT 50
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
