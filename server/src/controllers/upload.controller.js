// src/controllers/upload.controller.js
import { pool } from "../config/db.js"; 
import { parseTeammatesCsv } from "../parser/parseTeammatesCsv.js";

// ---- Preview helper: per-criterion summary row counts ----
function computeCountsFromParsed(parsed) {
  const out = [];
  const criteria = Array.isArray(parsed?.criteria) ? parsed.criteria : [];
  for (const c of criteria) {
    const qn = Number.isFinite(c?.questionNo) ? c.questionNo
             : Number.isFinite(c?.idx)       ? c.idx
             : out.length + 1;
    const rows = Array.isArray(c?.summaryStats) ? c.summaryStats.length : 0;
    out.push({ questionNo: qn, summaryRows: rows });
  }
  return out;
}

export async function uploadCsv(req, res) {
  try {
    if (!req.user?.id) return res.status(401).json({ ok:false, message:"Not authenticated" });
    if (!req.file)     return res.status(400).json({ ok:false, message:"No file uploaded" });

    const ownerId = req.user.id;
    const previewOnly = String(req.query.preview || "") === "1";

    // Parse CSV buffer
    const parsed = parseTeammatesCsv(req.file.buffer);
    const course = parsed.course || {};
    const sessionName = parsed.sessionName || "";

    // --- Required fields check: code, title, sessionName ---
    if (!course.code || !course.title || !sessionName) {
      const miss = [];
      if (!course.code)    miss.push("Course code");
      if (!course.title)   miss.push("Course title");
      if (!sessionName)    miss.push("Session name");
      // For preview requests, return 400 with a clear message
      return res.status(400).json({
        ok: false,
        message: `CSV is missing required fields: ${miss.join(", ")}`
      });
    }

    if (previewOnly) {
      const counts = computeCountsFromParsed(parsed);
      return res.json({ ok:true, course, sessionName, statsCounts: counts });
    }

    // Save to DB
    const cfg = {
      paWeight:       Number(req.body.paWeight ?? 10) || 10,
      numCriteria:    Number(req.body.numCriteria ?? (parsed.criteria?.length || 0)) || 0,
      penaltyPercent: Number(req.body.penaltyPercent ?? 0) || 0,
    };

    const sessionId = await saveParsedToDb(parsed, cfg, ownerId);

    const [counts] = await pool.query(
      `SELECT c.question_no AS questionNo, COUNT(ss.id) AS summaryRows
         FROM criteria c
         LEFT JOIN summary_stats ss ON ss.criteria_id = c.id
        WHERE c.session_id = ?
        GROUP BY c.question_no
        ORDER BY c.question_no`, [sessionId]
    );

    return res.json({ ok:true, sessionId, course, sessionName, statsCounts: counts });
  } catch (err) {
    console.error("uploadCsv error:", err);
    return res.status(400).json({ ok:false, message: err.message || "Upload failed" });
  }
}

async function saveParsedToDb(parsed, cfg, ownerId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Upsert course by (owner_user_id, code, term)
    const { code, title, term } = parsed.course || {};
    if (!code)  throw new Error("Course code missing in CSV.");
    if (!title) throw new Error("Course title missing in CSV.");
    if (!parsed.sessionName) throw new Error("Session name missing in CSV.");

    let courseId;
    const [cRows] = await conn.query(
      `SELECT id FROM courses WHERE owner_user_id=? AND code=? AND term=? LIMIT 1`,
      [ownerId, code, term]
    );

    if (cRows.length) {
      courseId = cRows[0].id;
      await conn.query(
        `UPDATE courses SET title=? WHERE id=? AND owner_user_id=?`,
        [title || "", courseId, ownerId]
      );
    } else {
      const [ins] = await conn.query(
        `INSERT INTO courses (owner_user_id, code, title, term)
         VALUES (?, ?, ?, ?)`, [ownerId, code, title || "", term]
      );
      courseId = ins.insertId;
    }

    // 2) Create session (owner guard trigger expects same owner as course)
    if (!parsed.sessionName) throw new Error("Session name missing in CSV.");
    const [sIns] = await conn.query(
      `INSERT INTO sessions (course_id, owner_user_id, name)
       VALUES (?, ?, ?)`, [courseId, ownerId, parsed.sessionName]
    );
    const sessionId = sIns.insertId;

    // 3) Criteria + summaries (+ points)
    for (const crit of parsed.criteria || []) {
      const [cIns] = await conn.query(
        `INSERT INTO criteria (session_id, question_no, label)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE label=VALUES(label)`,
        [sessionId, crit.questionNo, crit.label || ""]
      );

      let criteriaId = cIns.insertId;
      if (!criteriaId) {
        const [cid] = await conn.query(
          `SELECT id FROM criteria WHERE session_id=? AND question_no=? LIMIT 1`,
          [sessionId, crit.questionNo]
        );
        criteriaId = cid[0]?.id;
      }

      for (const row of crit.summaryStats || []) {
        const [ssIns] = await conn.query(
          `INSERT INTO summary_stats
           (criteria_id, team, recipient, recipient_email, total_points, average_points)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            criteriaId,
            row.team,
            row.recipient,
            row.recipientEmail || null,
            row.totalPoints ?? 0,
            row.averagePoints ?? null
          ]
        );
        const summaryId = ssIns.insertId;

        if (Array.isArray(row.points) && row.points.length) {
          const values = row.points.map((v, i) => [summaryId, i + 1, v == null ? null : Number(v)]);
          await conn.query(
            `INSERT INTO summary_points (summary_id, idx, value) VALUES ?`,
            [values]
          );
        }
      }
    }

    // 4) PA Not Submitted
    if (Array.isArray(parsed.paNotSubmitted) && parsed.paNotSubmitted.length) {
      const values = parsed.paNotSubmitted.map(p => [sessionId, p.team, p.name, p.email || null]);
      await conn.query(
        `INSERT INTO pa_not_submitted (session_id, team, name, email)
         VALUES ?
         ON DUPLICATE KEY UPDATE email=VALUES(email)`,
        [values]
      );
    }

    // 5) Grading configuration
    await conn.query(
      `INSERT INTO grading_configs (session_id, pa_weight, num_criteria, penalty_percent)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         pa_weight=VALUES(pa_weight),
         num_criteria=VALUES(num_criteria),
         penalty_percent=VALUES(penalty_percent)`,
      [sessionId, cfg.paWeight, cfg.numCriteria, cfg.penaltyPercent]
    );

    await conn.commit();
    return sessionId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
