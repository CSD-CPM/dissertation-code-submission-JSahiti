import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
