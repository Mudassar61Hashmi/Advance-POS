import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "pos-secret-change-in-production";

/* ── Sign a token ── */
export const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

/* ── Verify middleware ── */
export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ message: "No token provided" });

  try {
    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;          // { id, username, role }
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* ── Role guard factory ── */
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ message: "Insufficient permissions" });
  next();
};