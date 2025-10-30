// server/src/routes/upload.routes.js
import express from "express";
import multer from "multer";
import { uploadCsv as handleUpload } from "../controllers/upload.controller.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

// --- Multer setup ---
const storage = multer.memoryStorage();               
const MAX_SIZE = 5 * 1024 * 1024;                     

const csvMimes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel" // many browsers label .csv like this
]);

function csvOnlyFileFilter(req, file, cb) {
  const extOK  = /\.csv$/i.test(file.originalname || "");
  const typeOK = csvMimes.has(file.mimetype);
  if (extOK || typeOK) return cb(null, true);
  cb(Object.assign(new Error("Only .csv files are allowed"), { status: 415 }));
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: csvOnlyFileFilter,
});

// --- Extra guard against disguised .xlsx/.xls ---
function rejectNonCsvContent(req, res, next) {
  if (!req.file?.buffer) return res.status(400).json({ ok:false, message:"No file uploaded" });

  const b = req.file.buffer;
  // .xlsx/.xlsm/.zip start with PK\x03\x04
  const looksZip = b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04;
  if (looksZip) {
    return res.status(415).json({ ok:false, message:"Only .csv files are allowed (no .xlsx/.xls)" });
  }

  // Optional: quick text sniff – reject obvious binary
  // Count non-text bytes in the first chunk
  const sample = b.subarray(0, Math.min(b.length, 2048));
  let binish = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    // allow common text range + CR/LF/TAB + UTF-8 BOM
    if (
      c === 0x09 || c === 0x0A || c === 0x0D || // tab/lf/cr
      (c >= 0x20 && c <= 0x7E) ||                // printable ASCII
      c === 0xEF || c === 0xBB || c === 0xBF     // BOM bytes
    ) continue;
    binish++;
    if (binish > 16) break; // heuristic
  }
  if (binish > 16) {
    return res.status(415).json({ ok:false, message:"File doesn’t look like plain-text CSV" });
  }

  return next();
}

// --- Route wiring: auth → multer → content sniff → controller ---
router.post(
  "/upload",
  authRequired,                 // you already gate APIs; keep it
  upload.single("file"),
  rejectNonCsvContent,          // hard enforcement
  handleUpload                  // your existing controller (parseTeammatesCsv, save, etc.)
);


// Centralized Multer error handling (size, type, etc.)
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ ok:false, message:"CSV too large" });
  }
  if (err?.status === 415) {
    return res.status(415).json({ ok:false, message: err.message || "Unsupported file type" });
  }
  if (err) {
    console.error("Upload error:", err);
    return res.status(400).json({ ok:false, message: err.message || "Upload failed" });
  }
  _next?.(); // just in case
});

export default router;
