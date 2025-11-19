export const isProd = process.env.NODE_ENV === "production";

export const cookieBase = {
  httpOnly: true,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
  secure: isProd,
};

export const accessCookieOpts = {
  ...cookieBase,
  maxAge: 15 * 60 * 1000,
  expires: new Date(Date.now() + 15 * 60 * 1000),
};
export const refreshCookieOpts = {
  ...cookieBase,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};
