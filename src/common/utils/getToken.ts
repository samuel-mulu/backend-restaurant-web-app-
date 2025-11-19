import { Request } from "express";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from "../../constants/cookiesName";

export function getAccessToken(req: Request): string | null {
  // check cookies (web)
  if (req.cookies?.[COOKIE_ACCESS_TOKEN]) {
    return req.cookies[COOKIE_ACCESS_TOKEN];
  }

  // check Authorization header (mobile)
  const header = req.headers.authorization;
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || null;
  }

  return null;
}

export function getRefreshToken(req: Request): string | null {
  // check cookies (web)
  if (req.cookies?.[COOKIE_REFRESH_TOKEN]) {
    return req.cookies[COOKIE_REFRESH_TOKEN];
  }

  // check custom header (mobile) — avoid Authorization reuse
  const rt = req.headers["x-refresh-token"];
  if (typeof rt === "string" && rt.length > 0) {
    return rt;
  }

  return null;
}
