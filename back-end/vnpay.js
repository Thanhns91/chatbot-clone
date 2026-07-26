import crypto from "crypto";

const DEFAULT_PAYMENT_URL =
  "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const pad2 = (value) => String(value).padStart(2, "0");

export function formatVnpayDate(date = new Date()) {
  // Việt Nam không dùng DST, nên dịch +07:00 rồi đọc theo UTC để kết quả ổn định
  // dù server Railway đang chạy ở timezone nào.
  const vnDate = new Date(date.getTime() + VN_OFFSET_MS);

  return [
    vnDate.getUTCFullYear(),
    pad2(vnDate.getUTCMonth() + 1),
    pad2(vnDate.getUTCDate()),
    pad2(vnDate.getUTCHours()),
    pad2(vnDate.getUTCMinutes()),
    pad2(vnDate.getUTCSeconds()),
  ].join("");
}

function encodeVnpay(value) {
  return encodeURIComponent(String(value)).replace(/%20/g, "+");
}

export function buildVnpaySignData(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${encodeVnpay(key)}=${encodeVnpay(value)}`)
    .join("&");
}

function signVnpayParams(params, secretKey) {
  const signData = buildVnpaySignData(params);

  return crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf8"))
    .digest("hex");
}

export function getVnpayConfig() {
  const tmnCode = String(process.env.VNPAY_TMN_CODE || "").trim();
  const hashSecret = String(process.env.VNPAY_HASH_SECRET || "").trim();
  const paymentUrl = String(
    process.env.VNPAY_PAYMENT_URL || DEFAULT_PAYMENT_URL,
  ).trim();
  const returnUrl = String(process.env.VNPAY_RETURN_URL || "").trim();

  if (!tmnCode) {
    throw new Error("Missing VNPAY_TMN_CODE");
  }

  if (!hashSecret) {
    throw new Error("Missing VNPAY_HASH_SECRET");
  }

  if (!returnUrl) {
    throw new Error("Missing VNPAY_RETURN_URL");
  }

  return {
    tmnCode,
    hashSecret,
    paymentUrl,
    returnUrl,
  };
}

export function buildVnpayPaymentUrl({
  txnRef,
  amount,
  orderInfo,
  ipAddr,
  locale = "vn",
  bankCode = "",
}) {
  const { tmnCode, hashSecret, paymentUrl, returnUrl } = getVnpayConfig();

  const amountVnd = Math.round(Number(amount || 0));

  if (!txnRef) {
    throw new Error("Missing VNPAY transaction reference");
  }

  if (!Number.isFinite(amountVnd) || amountVnd <= 0) {
    throw new Error("Invalid VNPAY amount");
  }

  const now = new Date();
  const expireAt = new Date(now.getTime() + 15 * 60 * 1000);

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: amountVnd * 100,
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: locale === "en" ? "en" : "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_CreateDate: formatVnpayDate(now),
    vnp_ExpireDate: formatVnpayDate(expireAt),
  };

  if (bankCode) {
    params.vnp_BankCode = String(bankCode).trim();
  }

  const secureHash = signVnpayParams(params, hashSecret);
  const query = buildVnpaySignData({
    ...params,
    vnp_SecureHash: secureHash,
  });

  return `${paymentUrl}?${query}`;
}

export function verifyVnpaySignature(query = {}) {
  const { hashSecret } = getVnpayConfig();
  const secureHash = String(query.vnp_SecureHash || "").toLowerCase();

  if (!secureHash) return false;

  const params = {};

  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith("vnp_")) continue;
    if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") continue;

    params[key] = Array.isArray(value) ? value[0] : value;
  }

  const expectedHash = signVnpayParams(params, hashSecret).toLowerCase();

  const actualBuffer = Buffer.from(secureHash, "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");

  if (actualBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  let ip = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || "").split(",")[0].trim();

  if (!ip) {
    ip = req.socket?.remoteAddress || req.ip || "127.0.0.1";
  }

  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  if (ip === "::1") {
    ip = "127.0.0.1";
  }

  return ip;
}
