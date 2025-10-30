// src/config/jwt.js
import "dotenv/config";

export const JWT_SECRET  = process.env.JWT_SECRET || "dev-secret-change-me";
export const COOKIE_NAME = process.env.COOKIE_NAME || "ga_auth";

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  secure: false,
  path: "/",
  // 12h cookie; server also encodes 12h JWT
  maxAge: 12 * 60 * 60 * 1000,
};
