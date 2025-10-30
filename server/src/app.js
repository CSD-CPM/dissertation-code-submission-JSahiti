// src/app.js
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { attachUserIfPresent } from "./middleware/auth.js";

// Routers
import healthRouter from "./routes/health.routes.js";
import authRouter   from "./routes/auth.routes.js";
import gradesRouter from "./routes/grades.routes.js";
import uploadRouter from "./routes/upload.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export const app = express();

// CORS (adjust origin to your frontend if needed)
app.use(cors({ origin: true, credentials: true }));

// Core middleware
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Attach req.user if a valid JWT cookie is present
app.use(attachUserIfPresent);

/* ------------------------------------------------------------------ */
/* HTML auth gate: redirect all HTML pages to /login when logged out, */
/* except /about.html (public) and /login itself                      */
/* ------------------------------------------------------------------ */
const PUBLIC_HTML = new Set([
  "/login",
  "/login.html",
  "/about",
  "/about.html",
  "/register",
  "/register.html",
  "/forgot",
  "/forgot.html",
  "/reset", 
   "/reset.html",

]);

app.use((req, res, next) => {
  // Only gate GET requests for HTML documents
  if (req.method !== "GET") return next();

  // Is this request for an HTML page?
  const wantsHtml =
    // Explicit .html files
    req.path.endsWith(".html") ||
    // Canonical page routes like "/" or "/grades"
    (!path.extname(req.path) && req.accepts(["html", "json"]) === "html");

  if (!wantsHtml) return next();

  // Public pages allowed without auth
  if (PUBLIC_HTML.has(req.path)) return next();

  // If user is not logged in, redirect to /login
  if (!req.user?.id) return res.redirect("/login");

  return next();
});

/* ------------------------------------------------------------------ */
/* API routes (JSON). Keep 401s for unauthenticated requests          */
/* ------------------------------------------------------------------ */
app.use(healthRouter);  // GET /health
app.use(authRouter);    // /auth/*
app.use(gradesRouter);  // /api/grade-breakdown, /api/group-marks, …
app.use(uploadRouter);  // POST /upload (+ ?preview=1)

/* ------------------------------------------------------------------ */
/* Debug route (optional)                                             */
/* ------------------------------------------------------------------ */
app.get("/__debug/routes", (_req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).map((mm) => mm.toUpperCase());
      routes.push({ path: m.route.path, methods });
    } else if (m.name === "router" && m.handle?.stack) {
      m.handle.stack.forEach((s) => {
        if (s.route) {
          const methods = Object.keys(s.route.methods).map((mm) => mm.toUpperCase());
          routes.push({ path: s.route.path, methods });
        }
      });
    }
  });
  res.json(routes);
});

app.get("/reset.html", (req, res) => {
  const token = req.query.token || "";
  res.redirect(302, `/reset?token=${encodeURIComponent(token)}`);
});


/* ------------------------------------------------------------------ */
/* 404 + error handlers                                               */
/* ------------------------------------------------------------------ */
app.use((req, res) => {
  // If it was an HTML navigation and user isn’t logged in, send them to login
  const wantsHtml =
    req.method === "GET" &&
    (req.path.endsWith(".html") || (!path.extname(req.path) && req.accepts(["html", "json"]) === "html"));

  if (wantsHtml && !req.user?.id && !PUBLIC_HTML.has(req.path)) {
    return res.redirect("/login");
  }
  res.status(404).json({ ok: false, message: `Not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, message: "Server error" });
});
