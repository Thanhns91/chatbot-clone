import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

const commonOptions = {
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  timezone: process.env.DB_TIMEZONE || "+00:00",
};

const pool = mysql.createPool(
  databaseUrl
    ? {
        uri: databaseUrl,
        ...commonOptions,
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || process.env.MYSQLUSER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || "ai_learning_chatbot",
        ...commonOptions,
      },
);

export default pool;
