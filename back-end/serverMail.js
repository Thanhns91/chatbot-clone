import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

app.post("/api/auth/admin/create-teacher", async (req, res) => {
  try {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "Thiếu họ tên hoặc email",
      });
    }

    const [existing] = await pool.query(
      "SELECT userId FROM Users WHERE email = ?",
      [email],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email đã tồn tại trong hệ thống",
      });
    }

    const defaultPassword = "12345";

    await pool.query(
      `INSERT INTO Users (fullName, email, passwordHash, role, status)
       VALUES (?, ?, ?, 'teacher', 'active')`,
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
              <p style="margin: 4px 0; color: #374151;"><b>Email:</b> ${email}</p>
              <p style="margin: 4px 0; color: #374151;"><b>Mật khẩu:</b> ${defaultPassword}</p>
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

app.listen(3000, () => {
  console.log("Server chạy tại http://localhost:3000");
});
