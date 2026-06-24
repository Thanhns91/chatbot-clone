import dotenv from "dotenv";

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM =
  process.env.MAIL_FROM || "AI Learning <onboarding@resend.dev>";

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function requireMailConfig() {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY in Railway Variables");
  }
}

export async function sendTeacherAccountEmail({ to, fullName, password }) {
  requireMailConfig();

  const safeFullName = escapeHtml(fullName);
  const safeEmail = escapeHtml(to);
  const safePassword = escapeHtml(password);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
      <div style="background: #2563eb; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">AI Learning</h1>
      </div>

      <div style="padding: 24px;">
        <h2 style="font-size: 18px; color: #111;">Xin chào ${safeFullName}!</h2>

        <p style="color: #374151;">
          Tài khoản giáo viên của bạn đã được tạo thành công.
        </p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #374151;">
            <b>Email:</b> ${safeEmail}
          </p>

          <p style="margin: 4px 0; color: #374151;">
            <b>Mật khẩu:</b> ${safePassword}
          </p>
        </div>

        <p style="color: #b91c1c; font-weight: bold;">
          Vui lòng đổi mật khẩu ngay sau khi đăng nhập.
        </p>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      subject: "Tài khoản giáo viên của bạn",
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Send email failed with status ${response.status}`,
    );
  }

  return data;
}