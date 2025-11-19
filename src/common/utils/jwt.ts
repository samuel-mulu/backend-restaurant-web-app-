import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../../config/env";

export type JwtUser = {
  id: string;
  _id: string;
  role: string;
};

type ResetTokenPayload = {
  uid: string;
  jti: string;
  purpose: "password_reset";
};

export const signResetToken = (payload: ResetTokenPayload, expiresIn = "15m") =>
  (jwt as any).sign(payload, env.jwtSecret, { expiresIn });

export const verifyResetToken = (token: string): ResetTokenPayload =>
  (jwt as any).verify(token, env.jwtSecret) as ResetTokenPayload;

export function signAccessToken(payload: JwtUser) {
  return (jwt as any).sign(payload, env.jwtSecret, {
    expiresIn: env.jwtAccessExpires,
  });
}

type RefreshPayload = JwtUser & { jti: string; tv: number };

export function signRefreshToken(payload: RefreshPayload) {
  return (jwt as any).sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpires,
  });
}

export function verifyAccessToken(token: string): JwtUser {
  return (jwt as any).verify(token, env.jwtSecret) as JwtUser;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return (jwt as any).verify(token, env.jwtRefreshSecret) as RefreshPayload;
}

export function newJti() {
  return crypto.randomBytes(16).toString("hex");
}
