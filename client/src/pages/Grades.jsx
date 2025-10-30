// src/pages/Grades.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchGrades, saveGroupMark } from "../api/grades";

export default function Grades(){
  const { search } = useLocation();
  const sessionId = Number(new URLSearchParams(search).get("sessionId") || "");

  const [rows, setRows] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groupMarks, setGroupMarks] = useState(new Map());      // team -> number|null
  const [editMarks, setEditMarks] = useState(new Map());        // team -> string (input value)
  const [statusByTeam, setStatusByTeam] = useState(new Map());  // team -> "Saved" | "Saving…" | error

  const [paWeight, setPaWeight] = useState(0);
  const [penaltyPercent, setPenaltyPercent] = useState(0);
  const [kpis, setKpis] = useState({ teams:0, students:0, notSub:0 });
  const [meta, setMeta] = useState("");

  const [q, setQ] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [sortIdx, setSortIdx] = useState(0);
  const [sortDir, setSortDir] = useState(1);

  // Initial load
  useEffect(() => {
    if (!sessionId) return;
    fetchGrades(sessionId)
      .then(data => {
        const r = (data.rows || []).sort(
          (a,b)=> a.team.localeCompare(b.team) || a.student.localeCompare(b.student)
        );
        const t = [...new Set(r.map(x=>x.team))];

        const gm = new Map();
        for (const team of t) {
          const a = r.find(x => x.team===team);
          gm.set(team, (a && Number.isFinite(a.groupMark)) ? Number(a.groupMark) : null);
        }

        const edits = new Map();
        for (const team of t) {
          const v = gm.get(team);
          edits.set(team, Number.isFinite(v) ? String(Math.round(v)) : "");
        }

        setRows(r);
        setTeams(t);
        setGroupMarks(gm);
        setEditMarks(edits);
        setKpis({
          teams: t.length,
          students: r.length,
          notSub: r.filter(x=>x.paNotSubmitted).length
        });
        setMeta(
          `Session ${data.sessionId} - PA Weight: ${Number(data.paWeight||0)}% | Penalty: ${Number(data.penaltyPercent||0)}%`
        );
        setPaWeight(Number(data.paWeight||0));
        setPenaltyPercent(Number(data.penaltyPercent||0));
      })
      .catch(err => setMeta(err.message || "Failed to load grade breakdown."));
  }, [sessionId]);

  const headerKeyMap = ["student","averagePoints","paScore","groupMark","weightedMark","individualMark","paNotSubmitted","finalMark"];
  const round2 = (x) => Math.round(Number(x)*100)/100;
  const whole  = (x) => Math.round(Number(x||0));
  const badge  = (flag) => flag ? <span className="badge bad">Not Submitted</span> : <span className="badge good">Submitted</span>;

  const visibleGroups = useMemo(() => {
    const passes = (r) =>
      (!filterTeam || r.team===filterTeam) &&
      (!q || r.student.toLowerCase().includes(q.trim().toLowerCase()));

    const valFor = (r, key) => {
      switch(key){
        case "student": return r.student || "";
        case "averagePoints":
        case "paScore":
        case "weightedMark":
        case "individualMark":
        case "finalMark": return Number(r[key]) || 0;
        case "groupMark": return Number.isFinite(r.groupMark) ? Number(r.groupMark) : -Infinity;
        case "paNotSubmitted": return r.paNotSubmitted ? 1 : 0;
        default: return 0;
      }
    };

    const cmp = (a,b) => {
      const key = headerKeyMap[sortIdx] || "student";
      const va = valFor(a,key), vb = valFor(b,key);
      const diff = (typeof va === "string" ? va.localeCompare(vb) : va - vb);
      return diff * sortDir;
    };

    const filtered = rows.filter(passes);
    const order = teams.filter(t => filtered.some(r => r.team===t));
    return order.map(team => ({ team, rows: filtered.filter(r => r.team===team).sort(cmp) }));
  }, [rows, teams, q, filterTeam, sortIdx, sortDir]);

  // Save a single team's mark (inline list on the left)
  const doSaveTeam = async (team) => {
    const raw = editMarks.get(team) ?? "";
    const gm = Number(raw);
    if (!Number.isFinite(gm) || gm < 0 || gm > 100) {
      setStatusByTeam(prev => new Map(prev).set(team, "Please enter 0–100"));
      return;
    }

    try {
      setStatusByTeam(prev => new Map(prev).set(team, "Saving…"));
      await saveGroupMark(sessionId, team, gm);

      setGroupMarks(prev => new Map(prev).set(team, Math.round(gm)));
      setEditMarks(prev => new Map(prev).set(team, String(Math.round(gm))));
      setStatusByTeam(prev => new Map(prev).set(team, "Saved"));

      // Refresh table/KPIs (non-blocking)
      fetchGrades(sessionId)
        .then(data => {
          const r = (data.rows || []).sort(
            (a,b)=> a.team.localeCompare(b.team) || a.student.localeCompare(b.student)
          );
          setRows(r);
          setKpis(s => ({ ...s, notSub: r.filter(x=>x.paNotSubmitted).length }));
        })
        .catch(() => {});
    } catch (e) {
      setStatusByTeam(prev => new Map(prev).set(team, e.message || "Error"));
    }
  };

  if (!sessionId) return <p id="sessionMeta">No sessionId provided.</p>;

  return (
    <>
      <div className="cards-row grid-2">
        <section className="card" id="gmConfigBox">
          <h2 className="card-title">Group Mark Configuration</h2>
          <div className="gm-list">
            {teams.map(team => {
              const status = statusByTeam.get(team) || "";
              const statusClass =
                status === "Saved" ? "saved" :
                status && status !== "Saving…" ? "error" :
                "";

              return (
                <div key={team} className="gm-row">
                  <span className="team-name">{team}</span>
                  <input
                    id={`gm-${team}`}
                    className="ctrl gm-input"
                    value={editMarks.get(team) ?? ""}
                    onChange={(e)=>{
                      const v = e.target.value.replace(/[^\d]/g,"");
                      setEditMarks(prev => new Map(prev).set(team, v));
                      if ((statusByTeam.get(team)||"").startsWith("Please")) {
                        setStatusByTeam(prev => { const n = new Map(prev); n.delete(team); return n; });
                      }
                    }}
                    inputMode="numeric"
                    placeholder="0–100"
                  />
                  <button className="btn-primary gm-save" onClick={()=>doSaveTeam(team)}>Save</button>
                  <span
                    className={`gm-chip ${statusClass}`}
                    aria-live="polite"
                    title={Number.isFinite(groupMarks.get(team)) ? `Saved: ${Math.round(groupMarks.get(team))}` : "Not saved yet"}
                  >
                    {status || (Number.isFinite(groupMarks.get(team)) ? `Saved` : "Missing")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Session Stats */}
        <section className="card emphasis" id="sessionStats">
          <h2 className="card-title">Session Stats</h2>
          <div className="kpi-track">
            <div className="kpi"><div className="kpi-label">Teams</div><div className="kpi-value">{kpis.teams||"—"}</div></div>
            <div className="kpi"><div className="kpi-label">Students</div><div className="kpi-value">{kpis.students||"—"}</div></div>
            <div className="kpi"><div className="kpi-label">PA Not Submitted</div><div className="kpi-value">{kpis.notSub||"—"}</div></div>
          </div>
          <p id="sessionMeta" className="muted" style={{ marginTop:8 }}>{meta}</p>
        </section>
      </div>

      <section className="card helper cols-guide-simple" style={{ marginTop:8 }}>
        <details>
          <summary className="card-title">What the columns mean?</summary>
          <div className="cols-simple">
            <div className="col-item"><h4>Average Points</h4><p>Average points received from teammates across all criteria (0–100).</p></div>
            <div className="col-item"><h4>PA Score</h4><p>Relative contribution in team (≈1.00 is average; &gt;1 higher, &lt;1 lower).</p></div>
            <div className="col-item"><h4>Group Mark</h4><p>Team mark for the deliverable (set per team).</p></div>
            <div className="col-item"><h4>Weighted Mark</h4><p>Group Mark × PA Score (whole number).</p></div>
            <div className="col-item"><h4>Individual Mark</h4><p>(Weighted Mark × PA%) + (Group Mark × (1−PA%)) (whole number).</p></div>
            <div className="col-item"><h4>PA Status</h4><p>Peer assessment status (Submitted / Not Submitted).</p></div>
            <div className="col-item"><h4>Final Mark</h4><p>Individual Mark; minus penalty if PA was not submitted.</p></div>
          </div>
          <div className="cols-cta"><a href="/methodology">See the methodology →</a></div>
        </details>
      </section>

      <section className="card">
        <h2 className="card-title">Grade Breakdown</h2>

        <div className="table-toolbar">
          <div className="controls">
            <input className="ctrl" type="search" placeholder="Search student…" value={q} onChange={e=>setQ(e.target.value)} />
            <select className="ctrl" value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
              <option value="">All teams</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            className="btn-ghost"
            onClick={()=>{
              const visible = [];
              visible.push(["Student","Average Points","PA Score","Group Mark","Weighted Mark","Individual Mark","PA Status","Final Mark"]);
              visibleGroups.forEach(g => {
                visible.push([`[${g.team}]`]);
                g.rows.forEach(r => {
                  visible.push([
                    r.student,
                    Number(r.averagePoints).toFixed(2),
                    round2(r.paScore).toFixed(2),
                    Number.isFinite(r.groupMark) ? Math.round(r.groupMark) : "",
                    whole(r.weightedMark),
                    whole(r.individualMark),
                    r.paNotSubmitted ? "Not Submitted" : "Submitted",
                    whole(r.finalMark)
                  ]);
                });
              });
              const csv = visible.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `grade_breakdown_session_${sessionId}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export CSV
          </button>
        </div>

        <div className="table-wrap">
          <table className="table table-enhanced table-fixed" aria-describedby="sessionMeta">
            <thead>
              <tr>
                {["Student","Average Points","PA Score","Group Mark","Weighted Mark","Individual Mark","PA Status","Final Mark"].map((h,i)=>(
                  <th
                    key={h}
                    className={i===0?"col-student":"num"}
                    onClick={()=>{
                      if (sortIdx === i) setSortDir(d => -d);
                      else { setSortIdx(i); setSortDir(1); }
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map(g => (
                <FragmentOrTr key={g.team} team={g.team} gm={groupMarks.get(g.team)}>
                  {g.rows.map((r, idx) => (
                    <tr key={g.team+"#"+idx} className={r.paNotSubmitted ? "ns" : ""}>
                      <td className="col-student" title={r.student}>{r.student}</td>
                      <td className="num" data-label="Average Points">{Number(r.averagePoints).toFixed(2)}</td>
                      <td className="num" data-label="PA Score">{round2(r.paScore).toFixed(2)}</td>
                      <td className="num" data-label="Group Mark">{Number.isFinite(r.groupMark) ? Math.round(r.groupMark) : "—"}</td>
                      <td className="num" data-label="Weighted Mark">{whole(r.weightedMark)}</td>
                      <td className="num" data-label="Individual Mark">{whole(r.individualMark)}</td>
                      <td data-label="PA Status">{badge(r.paNotSubmitted)}</td>
                      <td className="num" data-label="Final Mark">{whole(r.finalMark)}</td>
                    </tr>
                  ))}
                </FragmentOrTr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function FragmentOrTr({ team, gm, children }){
  return (
    <>
      <tr className="team-header">
        <td colSpan="8">
          <div className="hstack" style={{ justifyContent:"space-between" }}>
            <strong className="team-chip">{team}</strong>
            <div>
              {Number.isFinite(gm)
                ? <span className="gm-chip saved">Saved: {Math.round(gm)}</span>
                : <span className="gm-chip error">Missing</span>}
            </div>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}
