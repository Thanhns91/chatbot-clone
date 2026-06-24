import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

// Ép Node ưu tiên IPv4 để tránh lỗi ENETUNREACH IPv6 trên Railway
dns.setDefaultResultOrder("ipv4first");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // port 587 dùng STARTTLS
  family: 4, // ép dùng IPv4

  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },

  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,

  tls: {
    rejectUnauthorized: true,
  },
});

export async function sendTeacherAccountEmail({ to, fullName, password }) {
  return transporter.sendMail({
    from: `"Hệ thống AI Learning" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Tài khoản giáo viên của bạn",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
        <div style="background: #2563eb; padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">AI Learning</h1>
        </div>

        <div style="padding: 24px;">
          <h2 style="font-size: 18px; color: #111;">Xin chào ${fullName}!</h2>

          <p style="color: #374151;">
            Tài khoản giáo viên của bạn đã được tạo thành công.
          </p>

          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0; color: #374151;">
              <b>Email:</b> ${to}
            </p>

            <p style="margin: 4px 0; color: #374151;">
              <b>Mật khẩu:</b> ${password}
            </p>
          </div>

          <p style="color: #b91c1c; font-weight: bold;">
            Vui lòng đổi mật khẩu ngay sau khi đăng nhập.
          </p>
        </div>
      </div>
    `,
  });
}