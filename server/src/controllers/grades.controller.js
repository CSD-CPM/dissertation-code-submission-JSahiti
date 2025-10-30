// src/controllers/grades.controller.js
import { pool } from "../config/db.js"; // adjust to "../db.js" if that's your path

const round0 = (n) => Math.round(Number(n) || 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Try to read from the view (fast path). If the view is missing,
 * fall back to an ad-hoc query that computes the same values.
 * Always filter by owner for defense in depth.
 */
async function fetchAveragePointsByStudent(sessionId, ownerId) {
  // 1) Try view
  try {
    const [rows] = await pool.query(
      `SELECT session_id, team, student, average_points
         FROM v_avg_points_sum_of_per_criterion_avgs
        WHERE session_id = ? AND owner_user_id = ?
        ORDER BY team, student`,
      [sessionId, ownerId]
    );
    return rows;
  } catch {
    // 2) Fallback (no view): compute with owner filter via JOIN
    const [rows] = await pool.query(
      `
      WITH per_criterion AS (
        SELECT
            c.session_id,
            ss.team,
            ss.recipient AS student,
            ss.id        AS summary_id,
            ss.criteria_id,
            SUM(CASE WHEN sp.value IS NOT NULL THEN sp.value ELSE 0 END) AS sum_points,
            SUM(CASE WHEN sp.value IS NOT NULL THEN 1 ELSE 0 END)        AS num_idx
        FROM summary_stats ss
        JOIN criteria  c ON c.id = ss.criteria_id
        JOIN sessions  s ON s.id = c.session_id AND s.owner_user_id = ?  -- owner guard
        LEFT JOIN summary_points sp ON sp.summary_id = ss.id
        WHERE c.session_id = ?
        GROUP BY c.session_id, ss.team, ss.recipient, ss.id, ss.criteria_id
      )
      SELECT
          session_id,
          team,
          student,
          ROUND(SUM(CASE WHEN num_idx > 0 THEN sum_points / num_idx ELSE 0 END), 2) AS average_points
      FROM per_criterion
      GROUP BY session_id, team, student
      ORDER BY team, student
      `,
      [ownerId, sessionId]
    );
    return rows;
  }
}

export const getGradeBreakdown = async (req, res) => {
  // set by requireSessionOwned middleware
  const sessionId = req.sessionId;
  const ownerId   = req.user.id;

  try {
    // grading config (join to enforce owner)
    let paWeight = 10, penaltyPercent = 0, numCriteria = 0;
    {
      const [cfg] = await pool.query(
        `SELECT gc.pa_weight, gc.penalty_percent, COALESCE(gc.num_criteria, 0) AS num_criteria
           FROM grading_configs gc
           JOIN sessions s ON s.id = gc.session_id AND s.owner_user_id = ?
          WHERE gc.session_id = ?`,
        [ownerId, sessionId]
      );
      if (cfg.length) {
        paWeight       = Number(cfg[0].pa_weight) || 10;
        penaltyPercent = Number(cfg[0].penalty_percent) || 0;
        numCriteria    = Number(cfg[0].num_criteria) || 0;
      }
    }
    const paW = Math.max(0, Math.min(100, paWeight)) / 100;

    // averages (with owner filter)
    const avgRows = await fetchAveragePointsByStudent(sessionId, ownerId);
    const avgMap = new Map(avgRows.map(r => [`${r.team}||${r.student}`, Number(r.average_points) || 0]));

    // group size per team (owner filter)
    const [ts] = await pool.query(
      `SELECT ss.team, COUNT(DISTINCT ss.recipient) AS groupSize
         FROM summary_stats ss
         JOIN criteria c ON c.id = ss.criteria_id
         JOIN sessions s ON s.id = c.session_id AND s.owner_user_id = ?
        WHERE c.session_id = ?
        GROUP BY ss.team`,
      [ownerId, sessionId]
    );
    const teamSize = new Map(ts.map(r => [r.team, Number(r.groupSize) || 0]));

    // group marks (owner filter)
    const [gmRows] = await pool.query(
      `SELECT gm.team, gm.group_mark
         FROM group_marks gm
         JOIN sessions s ON s.id = gm.session_id AND s.owner_user_id = ?
        WHERE gm.session_id = ?`,
      [ownerId, sessionId]
    );
    const gmByTeam = new Map(gmRows.map(r => [r.team, Number(r.group_mark)]));

    // PA not submitted (owner filter)
    const [nsRows] = await pool.query(
      `SELECT p.team, p.name
         FROM pa_not_submitted p
         JOIN sessions s ON s.id = p.session_id AND s.owner_user_id = ?
        WHERE p.session_id = ?`,
      [ownerId, sessionId]
    );
    const notSubmitted = new Set(nsRows.map(x => `${x.team}||${x.name}`));

    // build output
    const out = [];
    for (const r of avgRows) {
      const key   = `${r.team}||${r.student}`;
      const avgPt = avgMap.get(key) ?? 0;
      const gSize = teamSize.get(r.team) || 0;
      const gmRaw = gmByTeam.get(r.team);
      const gmVal = Number.isFinite(gmRaw) ? gmRaw : 0;

      let paScore = 1;
      if (numCriteria > 0 && gSize > 0) {
        paScore = (avgPt / numCriteria) / (100 / gSize);
      }
      paScore = round2(paScore);

      const weightedRaw = gmVal * paScore;
      const weighted    = round0(weightedRaw);
      const individual  = round0((weightedRaw * paW) + (gmVal * (1 - paW)));

      const isNS = notSubmitted.has(key);
      const final = isNS
        ? round0(individual - (individual * (Math.max(0, Math.min(100, penaltyPercent)) / 100)))
        : individual;

      out.push({
        team: r.team,
        student: r.student,
        email: null,
        averagePoints: Number(avgPt.toFixed(2)),
        paScore: Number(paScore.toFixed(2)),
        groupMark: Number.isFinite(gmRaw) ? round0(gmRaw) : null,
        weightedMark: weighted,
        individualMark: individual,
        paNotSubmitted: isNS,
        finalMark: final
      });
    }

    out.sort((a,b) => a.team.localeCompare(b.team) || a.student.localeCompare(b.student));
    res.json({ ok: true, sessionId, paWeight, penaltyPercent, rows: out });
  } catch (e) {
    console.error("getGradeBreakdown error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
};

export const upsertGroupMark = async (req, res) => {
  try {
    const sessionId = req.sessionId; // set by requireSessionOwned
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ ok: false, message: "Invalid sessionId" });
    }

    const { team, groupMark } = req.body || {};
    if (!team || !Number.isFinite(+groupMark)) {
      return res.status(400).json({ ok: false, message: "team and groupMark (0–100) are required" });
    }
    const gm = Math.max(0, Math.min(100, Math.round(Number(groupMark))));

    // owner guard via JOIN (defense in depth)
    const [result] = await pool.query(
      `INSERT INTO group_marks (session_id, team, group_mark)
       SELECT ?, ?, ?
       FROM sessions s
       WHERE s.id = ? AND s.owner_user_id = ?
       ON DUPLICATE KEY UPDATE group_mark=VALUES(group_mark), updated_at=CURRENT_TIMESTAMP`,
      [sessionId, String(team).trim(), gm, sessionId, req.user.id]
    );

    if (!result.affectedRows) {
      // Either session not found or not owned — keep it 404 to avoid leaking
      return res.status(404).json({ ok: false, message: "Not found" });
    }

    res.json({ ok: true, sessionId, team: String(team).trim(), groupMark: gm });
  } catch (e) {
    console.error("upsertGroupMark error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};