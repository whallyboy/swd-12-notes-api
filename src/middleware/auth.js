import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.set("WWW-Authenticate", 'Bearer realm="api"');
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }
  try {
    const payload = jwt.verify(match[1], JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    res.set("WWW-Authenticate", 'Bearer realm="api"');
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }
}
