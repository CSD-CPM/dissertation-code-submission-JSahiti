// src/routes/auth.routes.js
import { Router } from "express";
import { register, login, me, logout, forgot, reset } from "../controllers/auth.controller.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.post("/auth/register", register);
router.post("/auth/login",    login);
router.get ("/auth/me",       authRequired, me);
router.post("/auth/logout",   logout);
router.post("/auth/forgot",   forgot);
router.post("/auth/reset",    reset);

export default router;
