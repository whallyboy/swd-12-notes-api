import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PORT } from "./config.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import notesRouter from "./routes/notes.js";

const app = express();

const allowedOrigins = ["http://localhost:5173", "http://localhost:3000"];

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "100kb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/notes", notesRouter);
app.use("/api", healthRouter);

app.use((req, res) => {
  res.status(404).json({ error: { message: "Not found" } });
});

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";
  const message =
    isProd && status === 500 ? "Internal server error" : err.message || "Internal server error";
  const details = isProd ? undefined : err.details;
  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
});

export default app;
