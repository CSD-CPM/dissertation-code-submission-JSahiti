// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { pool } from "../config/db.js";
import { COOKIE_NAME, cookieOptions, JWT_SECRET } from "../config/jwt.js";

const normEmail = (e) => String(e || "").trim().toLowerCase();
const RESET_TTL_MIN = Number(process.env.RESET_TOKEN_TTL_MIN || 60);

/* ───────────── Mailtrap / SMTP helper (demo-ready) ───────────── */
let _transporter = null;
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null; // SMTP disabled
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 2525,
    secure: false, // Mailtrap/587/2525 use STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transporter;
}
function resetEmailHtml(url) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
    <h2 style="margin:0 0 10px">Reset your Grade Assist password</h2>
    <p>Click the button below to set a new password. This link expires in ${RESET_TTL_MIN} minutes.</p>
    <p style="margin:16px 0">
      <a href="${url}" style="display:inline-block;background:#6b4e2e;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px">Reset password</a>
    </p>
    <p>If the button doesn’t work, paste this link in your browser:</p>
    <p><a href="${url}">${url}</a></p>
  </div>`;
}

/* POST /auth/register */
export const register = async (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};
  const e = normEmail(email);

  if (!firstName || !lastName || !e || !password || password.length < 6) {
    return res.status(400).json({ ok: false, message: "Invalid input" });
  }

  const conn = await pool.getConnection();
  try {
    const [dupes] = await conn.query("SELECT id FROM users WHERE email = ? LIMIT 1", [e]);
    if (dupes.length) {
      return res.status(409).json({ ok: false, message: "Email already in use" });
    }

    const hash = await bcrypt.hash(password, 10);
    const [ins] = await conn.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
      [firstName, lastName, e, hash]
    );
    const id = ins.insertId;

    // No auto-login; FE redirects to login
    res.json({ ok: true, user: { id, firstName, lastName, email: e } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Registration failed" });
  } finally {
    conn.release();
  }
};

/* POST /auth/login */
export const login = async (req, res) => {
  const { email, password, keep } = req.body || {};
  const e = normEmail(email);
  if (!e || !password) {
    return res.status(400).json({ ok: false, message: "Invalid credentials" });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      "SELECT id, first_name, last_name, email, password_hash, is_active FROM users WHERE email = ? LIMIT 1",
      [e]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ ok: false, message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ ok: false, message: "Invalid credentials" });

    // update last_login
    await conn.query("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?", [user.id]);

    // create session row (optional; good for auditing)
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const ip = req.ip || req.connection?.remoteAddress || null;
    const ua = req.get("user-agent") || null;
    await conn.query(
      `INSERT INTO auth_sessions (user_id, session_token, user_agent, ip, created_at, expires_at)
       VALUES (?, ?, ?, INET6_ATON(?), NOW(), DATE_ADD(NOW(), INTERVAL 12 HOUR))`,
      [user.id, sessionToken, ua, ip]
    );

    const jwtPayload = { id: user.id, email: user.email };
    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: keep ? "7d" : "12h" });

    const opts = { ...cookieOptions };
    if (keep) opts.maxAge = 7 * 24 * 60 * 60 * 1000;

    res.cookie(COOKIE_NAME, token, opts);
    res.json({
      ok: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName:  user.last_name,
        email:     user.email,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Login failed" });
  } finally {
    conn.release();
  }
};

/* GET /auth/me (authRequired) */
export const me = async (req, res) => {
  const { id } = req.user || {};
  if (!id) return res.status(401).json({ ok: false, message: "Unauthorized" });

  const [rows] = await pool.query(
    "SELECT id, first_name, last_name, email FROM users WHERE id = ? LIMIT 1",
    [id]
  );
  const u = rows[0];
  if (!u) return res.status(404).json({ ok: false, message: "Not found" });

  res.json({
    ok: true,
    user: { id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email }
  });
};

/* POST /auth/logout */
export const logout = async (_req, res) => {
  // Clear cookie; optionally delete session rows for user
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
};

/* POST /auth/forgot — Mailtrap email in demo, generic response always */
export const forgot = async (req, res) => {
  const email = normEmail(req.body?.email);
  const genericOk = () =>
    res.json({ ok: true, message: "If an account exists, a reset link was sent." });

  if (!email) return genericOk();

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    const user = rows[0];
    if (!user) return genericOk();

    // Invalidate previous unused tokens
    await conn.query(
      "UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
      [user.id]
    );

    // Create new token (plain store to match your schema; TTL from env)
    const token = crypto.randomBytes(32).toString("hex");
    await conn.query(
      `INSERT INTO password_resets (user_id, reset_token, created_at, expires_at)
       VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [user.id, token, RESET_TTL_MIN]
    );

    const appBase = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
    const resetUrl = `${appBase}/reset?token=${token}`;

    // Send via Mailtrap if SMTP is configured
    const transporter = getTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || "Grade Assist <no-reply@grade-assist.local>",
          to: email,
          subject: "Reset your Grade Assist password",
          text: `Use this link to reset your password (expires in ${RESET_TTL_MIN} minutes): ${resetUrl}`,
          html: resetEmailHtml(resetUrl),
        });
      } catch (e) {
        console.error("SMTP send failed:", e?.message || e);
        // Keep response generic regardless
      }
    }

    // In non-production, also return the URL to speed up demos/tests
    if (process.env.NODE_ENV !== "production") {
      return res.json({ ok: true, resetUrl });
    }
    return genericOk();
  } catch (e) {
    console.error(e);
    return genericOk(); // Do not leak details, avoid enumeration
  } finally {
    conn.release();
  }
};

/* POST /auth/reset */
export const reset = async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || password.length < 6) {
    return res.status(400).json({ ok: false, message: "Invalid input" });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT pr.id, pr.user_id
         FROM password_resets pr
        WHERE pr.reset_token = ?
          AND pr.used_at IS NULL
          AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
        LIMIT 1`,
      [token]
    );
    const pr = rows[0];
    if (!pr) return res.status(400).json({ ok: false, message: "Invalid or expired token" });

    const hash = await bcrypt.hash(password, 10);

    await conn.beginTransaction();
    await conn.query("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?", [hash, pr.user_id]);
    await conn.query("UPDATE password_resets SET used_at = NOW() WHERE id = ?", [pr.id]);

    // Revoke existing auth sessions for this user
    await conn.query("DELETE FROM auth_sessions WHERE user_id = ?", [pr.user_id]);

    await conn.commit();
    res.json({ ok: true, message: "Password updated" });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error(e);
    res.status(500).json({ ok: false, message: "Reset failed" });
  } finally {
    conn.release();
  }
};
