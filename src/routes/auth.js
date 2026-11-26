import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { sql } from "../db.js";
import { JWT_SECRET } from "../config.js";
import { validate } from "../lib/validate.js";
import { requireAuth } from "../middleware/auth.js";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(10)
    .regex(/[a-zA-Z]/, "must contain letters")
    .regex(/[0-9]/, "must contain numbers"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const router = Router();

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    expiresIn: "1h",
    algorithm: "HS256",
  });
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, created_at: row.created_at };
}

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.validated;
    const normalizedEmail = email.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${name}, ${normalizedEmail}, ${passwordHash})
      RETURNING id, name, email, created_at
    `;
    const user = rows[0];
    const token = signToken(user.id);
    res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: { message: "Email already registered" } });
    }
    next(err);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      return res.status(401).json({ error: { message: "Invalid email or password" } });
    }
    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`SELECT id, name, email, created_at FROM users WHERE id = ${req.user.id}`;
    if (!rows[0]) return res.status(404).json({ error: { message: "Not found" } });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
