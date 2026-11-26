import { Router } from "express";
import { sql } from "../db.js";

const router = Router();

router.get("/health", async (req, res, next) => {
  try {
    await sql`SELECT 1`;
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    next(err);
  }
});

export default router;
