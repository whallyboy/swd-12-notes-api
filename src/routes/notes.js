import { Router } from "express";
import { z } from "zod";
import { sql } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../lib/validate.js";

const uuidSchema = z.string().uuid();

const createSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().default(""),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
});

const patchSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    body: z.string().optional(),
    tags: z.array(z.string()).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field required");

const router = Router();
router.use(requireAuth);

function parseId(req, res) {
  const r = uuidSchema.safeParse(req.params.id);
  if (!r.success) {
    res.status(400).json({ error: { message: "Invalid id" } });
    return null;
  }
  return r.data;
}

router.get("/", async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q) : "";
    const tag = req.query.tag ? String(req.query.tag) : "";
    const pinned = req.query.pinned;
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const offset = (page - 1) * limit;

    const conditions = [sql`user_id = ${req.user.id}`];
    if (q) {
      conditions.push(sql`(title ILIKE ${"%" + q + "%"} OR body ILIKE ${"%" + q + "%"})`);
    }
    if (tag) {
      conditions.push(sql`${tag} = ANY(tags)`);
    }
    if (pinned === "true" || pinned === "false") {
      conditions.push(sql`pinned = ${pinned === "true"}`);
    }
    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    const countRows = await sql`SELECT count(*)::int AS total FROM notes ${where}`;
    const total = countRows[0].total;

    const rows = await sql`
      SELECT * FROM notes
      ${where}
      ORDER BY pinned DESC, updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    res.json({ data: rows, page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const rows = await sql`SELECT * FROM notes WHERE id = ${id} AND user_id = ${req.user.id}`;
    if (!rows[0]) return res.status(404).json({ error: { message: "Not found" } });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { title, body, tags, pinned } = req.validated;
    const rows = await sql`
      INSERT INTO notes (user_id, title, body, tags, pinned)
      VALUES (${req.user.id}, ${title}, ${body}, ${tags}, ${pinned})
      RETURNING *
    `;
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", validate(patchSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const { title, body, tags, pinned } = req.validated;
    const rows = await sql`
      UPDATE notes SET
        title = COALESCE(${title ?? null}, title),
        body = COALESCE(${body ?? null}, body),
        tags = COALESCE(${tags ?? null}, tags),
        pinned = COALESCE(${pinned ?? null}, pinned),
        updated_at = now()
      WHERE id = ${id} AND user_id = ${req.user.id}
      RETURNING *
    `;
    if (!rows[0]) return res.status(404).json({ error: { message: "Not found" } });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const rows = await sql`DELETE FROM notes WHERE id = ${id} AND user_id = ${req.user.id} RETURNING id`;
    if (!rows[0]) return res.status(404).json({ error: { message: "Not found" } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;