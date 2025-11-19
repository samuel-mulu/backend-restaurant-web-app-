import { NextFunction, Request, Response } from "express";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  const message =
    isProd && status === 500
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

  let details: Array<{ field?: string; message: string }> | null = null;

  if (err.isJoi && err.details) {
    details = err.details.map((d: any) => ({
      field: d.path?.join(".") || undefined,
      message: d.message.replace(/['"]/g, ""),
    }));
  } else if (err?.code === 11000 && err?.keyValue) {
    details = Object.keys(err.keyValue).map((k) => ({
      field: k,
      message: `${k} already in use`,
    }));
  } else if (Array.isArray(err?.errors)) {
    details = err.errors.map((e: any) =>
      typeof e === "string"
        ? { message: e }
        : { field: e.field, message: e.message ?? String(e) }
    );
  }

  console.error("Error:", {
    status,
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  res.status(status).json({
    success: false,
    message,
    details,
    data: null,
  });
}
