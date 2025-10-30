// src/pages/Upload.jsx
import { useRef, useState, useMemo } from "react";
import { uploadCsv } from "../api/upload";

export default function Upload(){
  const fileRef = useRef(null);

  // UI state
  const [fileName, setFileName] = useState("");
  const [droppedFile, setDroppedFile] = useState(null); // supports real drag & drop
  const [isDrag, setIsDrag] = useState(false);
  const [toast, setToast] = useState("");
  const [bar, setBar] = useState(0);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  // required grading fields
  const [paWeight, setPaWeight] = useState("");
  const [numCriteria, setNumCriteria] = useState("");
  const [penaltyPercent, setPenaltyPercent] = useState("");

  // field-level errors
  const [fieldErr, setFieldErr] = useState({
    paWeight: "",
    numCriteria: "",
    penaltyPercent: ""
  });

  // --- CSV + size policy (keep in sync with server/multer limit) ---
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  function validateSelectedFile(file) {
    if (!file) return { ok:false, msg:"Please choose a TEAMMATES CSV." };

    const isCsvExt  = /\.csv$/i.test(file.name || "");
    const isCsvMime = ["text/csv","application/csv","application/vnd.ms-excel"].includes(file.type || "");

    if (!isCsvExt && !isCsvMime) {
      return { ok:false, msg:"⚠ Please upload a valid .csv file only." };
    }
    if (file.size > MAX_SIZE) {
      return { ok:false, msg:`⚠ File is too large. Max allowed is ${Math.round(MAX_SIZE/1024/1024)} MB.` };
    }
    return { ok:true };
  }

  const setErr = (msg) => setToast(msg ? `⚠ ${msg.replace(/^⚠\s*/,'')}` : "");

  const clear = () => {
    // clear UI state
    setToast("");
    setBar(0);
    setBusy(false);
    setPreview(null);
    setFileName("");
    setDroppedFile(null);
    setIsDrag(false);

    // reset grading inputs so placeholders show again
    setPaWeight("");
    setNumCriteria("");
    setPenaltyPercent("");

    // clear any field-level errors
    setFieldErr({ paWeight:"", numCriteria:"", penaltyPercent:"" });

    // reset the file input
    if (fileRef.current) fileRef.current.value = "";
  };

  // ------- form validation (required + ranges) -------
  function validateBasics() {
    const errs = { paWeight:"", numCriteria:"", penaltyPercent:"" };
    let ok = true;

    // PA Weight: required, 0–100 whole
    if (paWeight === "") { errs.paWeight = "PA Weight is required."; ok = false; }
    else {
      const v = Number(paWeight);
      if (!Number.isInteger(v) || v < 0 || v > 100) { errs.paWeight = "Enter a whole number 0–100."; ok = false; }
    }

    // Number of Criteria: required, ≥1 whole
    if (numCriteria === "") { errs.numCriteria = "Number of Criteria is required."; ok = false; }
    else {
      const v = Number(numCriteria);
      if (!Number.isInteger(v) || v < 1) { errs.numCriteria = "Enter a whole number ≥ 1."; ok = false; }
    }

    // Penalty Percentage: required, 0–100 whole
    if (penaltyPercent === "") { errs.penaltyPercent = "Penalty Percentage is required."; ok = false; }
    else {
      const v = Number(penaltyPercent);
      if (!Number.isInteger(v) || v < 0 || v > 100) { errs.penaltyPercent = "Enter a whole number 0–100."; ok = false; }
    }

    setFieldErr(errs);
    return ok;
  }

  // —— Required fields check from PREVIEW ——
  const missingReq = useMemo(() => {
    if (!preview) return [];
    const miss = [];
    if (!preview.course?.code)  miss.push("Course code");
    if (!preview.course?.title) miss.push("Course title");
    if (!preview.sessionName)   miss.push("Session name");
    return miss;
  }, [preview]);

  const formValid = useMemo(() =>
    !fieldErr.paWeight && !fieldErr.numCriteria && !fieldErr.penaltyPercent &&
    paWeight !== "" && numCriteria !== "" && penaltyPercent !== ""
  , [fieldErr, paWeight, numCriteria, penaltyPercent]);

  const canUpload = Boolean(preview && missingReq.length === 0 && formValid);

  // pick the current file (dragged or from input)
  const currentFile = () => droppedFile || fileRef.current?.files?.[0] || null;

  // ----------------- actions -----------------
  const handlePreview = async () => {
    setToast("");

    // validate form first
    if (!validateBasics()) {
      return setErr("Please complete all required fields with valid values, then try Preview.");
    }

    const file = currentFile();
    if (!file) return setErr("Please choose a TEAMMATES CSV.");

    const check = validateSelectedFile(file);
    if (!check.ok) return setErr(check.msg);

    try {
      setBusy(true); setBar(45);
      const data = await uploadCsv({
        file,
        paWeight, numCriteria, penaltyPercent,
        preview: true
      });
      setBar(100); setPreview(data);

      if (!data.course?.code || !data.course?.title || !data.sessionName) {
        setToast("⚠ Looks like something’s missing. Please ensure Course code, Course title, and Session name are present in your CSV, then Preview again.");
      } else {
        setToast("Preview ready. Take a quick look to confirm everything looks right.");
      }
    } catch (e) {
      setErr(e.message || "Preview failed");
    } finally {
      setBusy(false);
      setTimeout(()=>setBar(0), 400);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setToast("");

    // validate form first
    if (!validateBasics()) {
      return setErr("Please complete all grading fields with valid values, then Preview before uploading.");
    }

    const file = currentFile();
    if (!file) return setErr("Please choose a TEAMMATES CSV.");

    const check = validateSelectedFile(file);
    if (!check.ok) return setErr(check.msg);

    if (!canUpload) {
      return setErr(
        preview
          ? `Please ensure ${missingReq.join(", ")} are present in your CSV and run Preview again before uploading.`
          : "Please select a CSV, complete the grading fields, and click Preview before uploading."
      );
    }

    try {
      setBusy(true); setBar(45);
      const data = await uploadCsv({
        file,
        paWeight, numCriteria, penaltyPercent,
        preview: false
      });
      setBar(100); setPreview(data);
      setToast("Saved! Redirecting to Grade Breakdown…");
      const sid = data.sessionId;
      window.location.href = `/grades?sessionId=${encodeURIComponent(sid)}`;
    } catch (e) {
      setErr(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  // Tooltip explaining why Upload is disabled (no inline red block)
  const disabledReason = useMemo(() => {
    if (busy) return "";
    if (!formValid) {
      return "Complete all grading fields and Preview the CSV before uploading.";
    }
    if (!preview) {
      return "Select a CSV and click Preview to check the parsed details first.";
    }
    if (missingReq.length) {
      return `Please ensure ${missingReq.join(", ")} are present in your CSV, then Preview again.`;
    }
    return "";
  }, [busy, formValid, preview, missingReq]);

  // helpers to constrain input and clear field errors on change
  const onlyDigits = (s) => s.replace(/[^\d]/g,"");

  // drag helpers (visual + real file read)
  const onDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDrag(true); };
  const onDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); setIsDrag(true); };
  const onDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget === e.target) setIsDrag(false);
  };
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDrag(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const { ok, msg } = validateSelectedFile(file);
    if (!ok) {
      setDroppedFile(null);
      setFileName("");
      setToast(msg);
      return;
    }
    setDroppedFile(file);
    setFileName(file.name);
    setToast("");
    // optional: also clear input to avoid confusion
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      {/* Ingest / form */}
      <section id="ingest" className="card emphasis">
        <div className="stepper" aria-label="Upload steps">
          <div className="step is-active"><div className="dot">1</div><div className="label">Configure Grading</div></div>
          <div className="rail"></div>
          <div className="step"><div className="dot">2</div><div className="label">Attach CSV</div></div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid-2">
            {/* Grading configuration */}
            <div className="panel">
              <h2 className="panel-title">Grading Configuration</h2>

              <div className="field">
                <label htmlFor="paWeight">Peer Assessment (PA) Weight</label>
                <input
                  id="paWeight"
                  type="number"
                  min="0" max="100" step="1"
                  placeholder="0–100"
                  aria-invalid={!!fieldErr.paWeight}
                  value={paWeight}
                  onChange={e=>{
                    setPaWeight(onlyDigits(e.target.value));
                    if (fieldErr.paWeight) setFieldErr(s=>({...s, paWeight:""}));
                  }}
                />
                {fieldErr.paWeight
                  ? <p className="error">{fieldErr.paWeight}</p>
                  : <p className="hint">Percentage of final grade from peer assessment</p>}
              </div>

              <div className="field">
                <label htmlFor="numCriteria">Number of Criteria</label>
                <input
                  id="numCriteria"
                  type="number"
                  min="1" step="1"
                  placeholder="e.g., 4"
                  aria-invalid={!!fieldErr.numCriteria}
                  value={numCriteria}
                  onChange={e=>{
                    setNumCriteria(onlyDigits(e.target.value));
                    if (fieldErr.numCriteria) setFieldErr(s=>({...s, numCriteria:""}));
                  }}
                />
                {fieldErr.numCriteria
                  ? <p className="error">{fieldErr.numCriteria}</p>
                  : <p className="hint">How many criteria are evaluated per peer assessment?</p>}
              </div>

              <div className="field">
                <label htmlFor="penaltyPercent">Penalty Percentage</label>
                <input
                  id="penaltyPercent"
                  type="number"
                  min="0" max="100" step="1"
                  placeholder="0–100"
                  aria-invalid={!!fieldErr.penaltyPercent}
                  value={penaltyPercent}
                  onChange={e=>{
                    setPenaltyPercent(onlyDigits(e.target.value));
                    if (fieldErr.penaltyPercent) setFieldErr(s=>({...s, penaltyPercent:""}));
                  }}
                />
                {fieldErr.penaltyPercent
                  ? <p className="error">{fieldErr.penaltyPercent}</p>
                  : <p className="hint">Penalty for students who didn’t participate</p>}
              </div>
            </div>

            {/* CSV panel */}
            <div className="panel">
              <h2 className="panel-title">TEAMMATES CSV</h2>

              <div
                id="drop"
                className={`dropzone ${isDrag ? "is-drag" : ""}`}
                tabIndex={0}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div className="dz-icon" aria-hidden="true">⬆</div>
                <div className="dz-title">Drag &amp; drop your CSV</div>
                <div className="dz-sub">Only .csv files, up to 5&nbsp;MB</div>

                <input
                  id="csvFile"
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileRef}
                  onChange={(e) => {
                    setIsDrag(false);
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const { ok, msg } = validateSelectedFile(file);
                    if (!ok) {
                      setToast(msg);
                      e.target.value = ""; // reset input
                      setFileName("");
                      setDroppedFile(null);
                      return;
                    }
                    setDroppedFile(null); // prefer the newly-picked file
                    setFileName(file.name);
                    setToast("");
                  }}
                />
              </div>

              {fileName && <div className="file-chip">{fileName}</div>}

              <div className="note">
                Before uploading, please <b>Preview</b> to confirm that the parsed details (Course &amp; Session) look correct.
                We’ll store <em>both</em> the grading configuration and the CSV data (course, session, criteria, summary rows).
              </div>

              <div className="cta-sticky">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !canUpload}
                  title={(!canUpload && disabledReason) ? disabledReason : undefined}
                >
                  Upload &amp; Save
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={handlePreview}
                >
                  Preview
                </button>
                <button type="button" className="btn-ghost" onClick={clear}>Reset</button>
                <div className="progress" hidden={!busy}><div className="bar" style={{ width: `${bar}%` }} /></div>
              </div>

              {toast && (
                <div className={`toast ${toast.startsWith("Saved")||toast.startsWith("Preview") ? "ok" : "err"}`}>
                  {toast}
                </div>
              )}
            </div>
          </div>
        </form>
      </section>

      {/* Preview area — ALWAYS visible */}
      <section id="details" className="grid-2" style={{ marginTop: 12 }}>
        <div className="card">
          <h2 className="card-title">Course &amp; Session</h2>
          {!preview ? (
            <div className="empty" aria-live="polite">
              <div className="empty-title">No preview yet</div>
              <div className="empty-sub">
                Select your CSV, complete the grading fields, then click <b>Preview</b> to check the details here.
              </div>
            </div>
          ) : (
            <dl className="kv">
              <div className="kv-row">
                <dt>Course code</dt>
                <dd>{preview.course?.code || <span className="badge bad">missing</span>}</dd>
              </div>
              <div className="kv-row">
                <dt>Course title</dt>
                <dd>{preview.course?.title || <span className="badge bad">missing</span>}</dd>
              </div>
              <div className="kv-row"><dt>Term</dt><dd>{preview.course?.term ?? "—"}</dd></div>
              <div className="kv-row">
                <dt>Session name</dt>
                <dd>{preview.sessionName || <span className="badge bad">missing</span>}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Parsed Counts</h2>
          {!preview ? (
            <div className="empty">
              <div className="empty-sub">You’ll see question/summary counts here after you click <b>Preview</b>.</div>
            </div>
          ) : (
            <div id="counts" className="mono">
              {(Array.isArray(preview.statsCounts) ? preview.statsCounts : [])
                .sort((a,b)=> (a.questionNo||0)-(b.questionNo||0))
                .map(s => (
                  <div key={s.questionNo}>Question {s.questionNo}: {s.summaryRows} summary rows</div>
                ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
