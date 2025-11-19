import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { Role } from "../../constants/roles";

export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.role as Role | undefined;
    if (!role) return next(createError(401, "Unauthorized"));
    if (!allowed.includes(role)) return next(createError(403, "Forbidden"));
    next();
  };
}
