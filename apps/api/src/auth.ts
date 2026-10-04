import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, HttpError } from "./db";

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
} as const;
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32)
  throw new Error("JWT_SECRET must contain at least 32 characters");
export const jwtSecret = secret;
export const cookieName = "easyretail_session";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies[cookieName];
    if (typeof token === "string") {
      let payload: jwt.JwtPayload | undefined;
      try {
        const decoded = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
        if (typeof decoded !== "string") payload = decoded;
      } catch {
        /* Public routes still work with an expired cookie. */
      }
      if (payload?.sub) {
        const user = await db.user.findUnique({
          where: { id: payload.sub },
          select: userSelect,
        });
        if (user?.active) req.user = user;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user)
    return next(new HttpError(401, "Vui lòng đăng nhập để tiếp tục"));
  next();
}
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user)
    return next(new HttpError(401, "Vui lòng đăng nhập để tiếp tục"));
  if (req.user.role !== "ADMIN")
    return next(
      new HttpError(403, "Chỉ quản trị viên được thực hiện thao tác này"),
    );
  next();
}
