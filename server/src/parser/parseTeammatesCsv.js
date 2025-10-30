import { parse } from "csv-parse/sync";

/**
 * Parses TEAMMATES-like CSV (summary & non-submitters).
 */
export function parseTeammatesCsv(csvBuffer) {
  const rows = parse(csvBuffer, { skip_empty_lines: false });

  const get = (r, c) => (rows[r] && rows[r][c] ? String(rows[r][c]).trim() : "");
  const isBlankRow = (r) => !rows[r] || rows[r].every((cell) => String(cell).trim() === "");
  const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

  // ---------- Course ----------
  let i = 0;
  while (i < rows.length && norm(get(i, 0)).replace(/:$/, "") !== "course") i++;
  if (i >= rows.length) throw new Error('CSV does not contain a "Course" row');

  // Prefer entire “CODE - Title - Term” in col B.
  // If col B is empty, try B,C,D as [code,title,term].
  let code = "", title = "", term = "";
  const b = get(i, 1), c = get(i, 2), d = get(i, 3);

  const sep = /\s*[-–—]\s*/; // hyphen / en-dash / em-dash
  if (b) {
    // Try “CODE - Title - Term”
    const parts = String(b).split(sep);
    code  = (parts[0] || "").trim();
    title = (parts[1] || "").trim();
    term  = (parts.slice(2).join(" - ") || "").trim();
    // If still empty, fall back to commas in the same cell (rare)
    if (!code && b.includes(",")) {
      const p = b.split(",").map(s => s.trim());
      code = p[0] || "";
      title = p[1] || "";
      term = p.slice(2).join(" - ") || "";
    }
  } else if (b || c || d) {
    // Across B,C,D
    code = b || "";
    title = c || "";
    term = d || "";
  } else {

    const a = get(i, 0);
    const afterComma = a.includes(",") ? a.split(",").slice(1).join(",").trim() : "";
    if (afterComma) {
      const parts = afterComma.split(sep);
      code  = (parts[0] || "").trim();
      title = (parts[1] || "").trim();
      term  = (parts.slice(2).join(" - ") || "").trim();
    }
  }

  // ---------- Session name ----------
  i++;
  while (i < rows.length && norm(get(i, 0)) !== "session name") i++;
  if (i >= rows.length) throw new Error('CSV does not contain a "Session Name" row');
  const sessionName = get(i, 1);

  // ---------- Questions & summary statistics (unchanged) ----------
  i++;
  while (i < rows.length && !norm(get(i, 0)).startsWith("question ")) i++;

  const criteria = [];
  const toInt = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s || s === "no response") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  while (i < rows.length) {
    const col0 = norm(get(i, 0));
    if (!col0.startsWith("question ")) break;

    const qLine = get(i, 0);
    const label = get(i, 1) || "";
    const questionNo =
      Number(qLine.replace(/question/i, "").replace(":", "").trim().split(",")[0]) || 0;

    const start = i + 1;

    let nextQuestion = start;
    while (nextQuestion < rows.length && !norm(get(nextQuestion, 0)).startsWith("question ")) nextQuestion++;

    let ssRow = -1;
    for (let r = start; r < (nextQuestion < rows.length ? nextQuestion : rows.length); r++) {
      if (norm(get(r, 0)) === "summary statistics") { ssRow = r; break; }
    }

    const summaryStats = [];
    if (ssRow !== -1) {
      let h = ssRow + 1;
      while (h < rows.length && (isBlankRow(h) || get(h, 0) === "")) h++;

      const hdr = rows[h] || [];
      const headerOk = norm(hdr[0] || "").startsWith("team") && norm(hdr[1] || "").startsWith("recipient");
      if (headerOk) {
        let r = h + 1;
        while (r < rows.length && !isBlankRow(r)) {
          const rr = rows[r];
          const c0norm = norm(String(rr[0] || ""));
          if (c0norm.startsWith("team,giver") || c0norm.startsWith("question ")) break;

          const team = String(rr[0] || "").trim();
          const recipient = String(rr[1] || "").trim();
          const recipientEmail = String(rr[2] || "").trim() || null;
          const totalPoints = toInt(rr[3]) ?? 0;
          const averagePoints = rr[4] ? Number(String(rr[4]).trim()) : null;

          const pointsRaw = rr.slice(5);
          const points = pointsRaw.map(toInt);
          while (points.length && points[points.length - 1] == null) points.pop();

          if (team || recipient) {
            summaryStats.push({ team, recipient, recipientEmail, totalPoints, averagePoints, points });
          }
          r++;
        }
      }
    }
    criteria.push({ questionNo, label, summaryStats });
    i = (nextQuestion < rows.length ? nextQuestion : rows.length);
  }

  // ---------- Non-submitters ----------
  const paNotSubmitted = [];
  let paTitleIdx = -1;
  for (let r = 0; r < rows.length; r++) {
    if (norm(get(r, 0)) === "participants who have not responded to any question") { paTitleIdx = r; break; }
  }
  if (paTitleIdx !== -1) {
    let j = paTitleIdx + 1;
    while (j < rows.length && isBlankRow(j)) j++;
    const hdr2 = rows[j] || [];
    const looksLikeHeader = norm(hdr2[0] || "").startsWith("team") && norm(hdr2[1] || "").startsWith("name");
    if (looksLikeHeader) {
      j++;
      while (j < rows.length && !isBlankRow(j)) {
        const r = rows[j];
        const team = String(r[0] || "").trim();
        const name = String(r[1] || "").trim();
        const email = String(r[2] || "").trim() || null;
        if (team || name || email) paNotSubmitted.push({ team, name, email });
        j++;
      }
    }
  }

  // Return the object (even if some fields are blank strings)
  return { course: { code, title, term }, sessionName, criteria, paNotSubmitted };
}
