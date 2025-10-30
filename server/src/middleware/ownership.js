// src/middleware/ownership.js
import { pool } from "../config/db.js"; 

/**
 * Ensures the session (from :sessionId or ?sessionId=) belongs to req.user.id.
 * Returns 404 to avoid leaking existence. Attaches req.sessionId for handlers.
 */
export async function requireSessionOwned(req, res, next) {
  const raw = req.params.sessionId ?? req.query.sessionId;
  const sessionId = Number(raw);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ ok: false, message: "Invalid sessionId" });
  }
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, message: "Not authenticated" });
  }
  try {
    const [[row]] = await pool.query(
      "SELECT 1 AS ok FROM sessions WHERE id = ? AND owner_user_id = ? LIMIT 1",
      [sessionId, req.user.id]
    );
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    req.sessionId = sessionId;
    next();
  } catch (e) {
    console.error("requireSessionOwned error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}
