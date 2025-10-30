// src/routes/grades.routes.js
import { Router } from "express";
import { getGradeBreakdown, upsertGroupMark } from "../controllers/grades.controller.js";
import { authRequired } from "../middleware/auth.js";
import { requireSessionOwned } from "../middleware/ownership.js";

const router = Router();

router.get("/api/grade-breakdown", authRequired, requireSessionOwned, getGradeBreakdown);
router.post("/api/group-marks", authRequired, requireSessionOwned, upsertGroupMark);

export default router;
