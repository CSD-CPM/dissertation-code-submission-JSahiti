// src/middleware/auth.js
import jwt from "jsonwebtoken";
import { COOKIE_NAME, JWT_SECRET } from "../config/jwt.js";

export function authRequired(req, res, next) {
  if (req.user?.id) return next(); 
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ ok: false, message: "Unauthorized" });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
}

export function attachUserIfPresent(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = { id: payload.id, email: payload.email };
    }
  } catch {
    // ignore — req.user just remains undefined
  }
  next();
}

// Helper for HTML pages: redirect to /login if not authed
export function requireAuthPage(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.redirect("/login");
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.redirect("/login");
  }
}