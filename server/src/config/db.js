// src/config/db.js
import "dotenv/config";
import mysql from "mysql2/promise";

export const pool = await mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "grade_assist_mini",
  waitForConnections: true,
  connectionLimit: 10,
});
