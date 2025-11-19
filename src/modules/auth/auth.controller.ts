import { Request, Response, NextFunction } from "express";
import { User } from "./user.model";
import { verifyPassword } from "../../common/utils/password";
import {
  signAccessToken,
  signRefreshToken,
  newJti,
  verifyRefreshToken,
  verifyAccessToken,
} from "../../common/utils/jwt";

import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
} from "../../constants/cookiesName";
import { refreshCookieOpts, accessCookieOpts } from "../../config/cookieBase";
import { getRefreshToken, getAccessToken } from "../../common/utils/getToken";
import { ROLE_LABELS } from "../../constants/roles";
import { hashPassword } from "../../common/utils/password";
import * as svc from "./auth.service";

const MAX_FAILED = 25;
const LOCK_MINUTES = 15;

// --- Helpers ---------------------------------------------------------------

function isLocked(user: any) {
  return user.lockUntil && user.lockUntil.getTime() > Date.now();
}

function lockUser(user: any) {
  user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
  if (user.failedLoginCount >= MAX_FAILED) {
    user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    user.failedLoginCount = 0;
  }
}

function clearLockState(user: any) {
  user.failedLoginCount = 0;
  user.lockUntil = undefined;
}

/** small constant delay to reduce timing side-channels */
function timingEqualizer(ms = 120) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Controller ------------------------------------------------------------

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        details: [{ field: "name", message: "name is required" }],
      });
      return;
    }

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        details: [{ field: "email", message: "email is required" }],
      });
      return;
    }

    if (!password) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        details: [{ field: "password", message: "password is required" }],
      });
      return;
    }

    const token = getAccessToken(req);

    if (token) {
      const decoded = verifyAccessToken(token);
      if (!decoded) {
        res.status(401).json({
          success: false,
          message: "Token expired or invalid token used",
        });
        return;
      }
      if (decoded.role !== "owner") {
        res.status(403).json({
          success: false,
          message: "Access denied",
          details: [
            { message: "You don't have permission to perform this action" },
          ],
        });
        return;
      }
    } else if (role && role !== "cashier") {
      res.status(403).json({
        success: false,
        message: "Access denied",
        details: [
          { message: "You don't have permission to perform this action" },
        ],
      });
      return;
    }

    const existing = await User.findOne({
      email: email.toLowerCase().trim(),
    }).lean();

    if (existing) {
      res.status(409).json({
        success: false,
        message: "Registration failed",
        details: [{ message: "Email already in use" }],
      });
      return;
    }

    const hashed = await hashPassword(password);

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashed,
      role: role || "cashier",
    });

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      message: "Registration successful. Please login to access your account.",
    });
    return;
  } catch (err: any) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = (req.body ?? {}) as {
      email: string;
      password: string;
    };

    // Basic validation
    if (!email) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        details: [{ field: "email", message: "email is required" }],
      });
      return;
    }
    if (!password) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        details: [{ field: "password", message: "password is required" }],
      });
      return;
    }

    const probe = email.trim().toLowerCase();
    console.log("🔍 Looking for user with email:", probe);

    const user = await User.findOne({
      email: probe,
    })
      .select(
        "password failedLoginCount lockUntil tokenVersion isActive role email name"
      )
      .exec();

    console.log("👤 User found:", user ? "Yes" : "No");
    if (user) {
      console.log("📧 User email:", user.email);
      console.log("🔒 Has password field:", !!user.password);
      console.log(
        "🔒 Password hash:",
        user.password ? user.password.substring(0, 20) + "..." : "None"
      );
      console.log("✅ Is active:", user.isActive);
    }

    // If user not found, equalize timing and return generic error
    if (!user) {
      await timingEqualizer();
      res.status(400).json({
        success: false,
        message: "Invalid credentials",
        details: [{ message: "Invalid email or password" }],
      });
      return;
    }

    // Locked?
    if (isLocked(user)) {
      const mins = Math.ceil((user.lockUntil!.getTime() - Date.now()) / 60000);
      res.status(423).json({
        success: false,
        message: "Account locked",
        details: [{ message: `Try again in ${mins} minute(s)` }],
      });
      return;
    }

    // Status checks
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Your account has been suspended",
        details: [
          {
            message:
              "Your account is currently suspended. Please contact support for assistance.",
          },
        ],
      });
      return;
    }

    // Check if password exists
    if (!user.password) {
      console.log("❌ No password field found");
      await timingEqualizer();
      res.status(400).json({
        success: false,
        message: "Invalid credentials",
        details: [{ message: "Invalid email or password" }],
      });
      return;
    }

    console.log("🔐 Verifying password...");
    const okPass = await verifyPassword(password, user.password);
    console.log("🔐 Password verification result:", okPass);

    if (!okPass) {
      lockUser(user);
      await user.save();

      // Equalize a bit to blur timing between wrong-user and wrong-pass cases
      await timingEqualizer();

      res.status(400).json({
        success: false,
        message: "Login failed: Incorrect email or password.",
        details: [
          {
            message:
              "The email or password you entered is incorrect. Please double-check your credentials and try again.",
          },
        ],
      });
      return;
    }

    // Clear lock state & update last login
    clearLockState(user);
    user.lastLogin = new Date();

    await user.save();

    // --- Issue tokens ---
    const accessToken = signAccessToken({
      id: user._id.toString(),
      _id: user._id.toString(),
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      id: user._id.toString(),
      _id: user._id.toString(),
      role: user.role,
      jti: newJti(),
      tv: user.tokenVersion,
    });

    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    // ---------------------- WEB RESPONSE --------------------------
    res
      .cookie(COOKIE_REFRESH_TOKEN, refreshToken, refreshCookieOpts)
      .cookie(COOKIE_ACCESS_TOKEN, accessToken, accessCookieOpts)
      .status(200)
      .json({
        success: true,
        message: "Login successful",
        data: {
          accessToken,
          user: safeUser,
        },
      });
    return;
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // --- get incoming refresh token
    const headerRT =
      typeof req.headers["x-refresh-token"] === "string"
        ? String(req.headers["x-refresh-token"])
        : null;
    const bodyRT =
      typeof req.body?.refreshToken === "string"
        ? String(req.body.refreshToken)
        : null;
    const fallbackRT = getRefreshToken(req);
    const token = headerRT || bodyRT || fallbackRT;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Please login again",
        details: [{ message: "No refresh token provided" }],
        data: null,
      });
      return;
    }

    const payload = verifyRefreshToken(token);

    const user = await User.findById(payload.id).select(
      "email name role isActive tokenVersion"
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "Invalid token",
        details: [{ message: "User not found" }],
        data: null,
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Account not active",
        details: [
          { message: "Please contact support or reactivate your account" },
        ],
        data: null,
      });
      return;
    }

    const tvFromToken = Number(payload.tv);
    const tvFromUser = Number(user.tokenVersion ?? 0);

    if (!Number.isFinite(tvFromToken) || tvFromToken !== tvFromUser) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
        details: [{ message: "Token version mismatch" }],
        data: null,
      });
      return;
    }

    // --- always issue a fresh access token
    const accessToken = signAccessToken({
      id: user._id.toString(),
      _id: user._id.toString(),
      role: user.role,
    });

    res
      .cookie(COOKIE_ACCESS_TOKEN, accessToken, accessCookieOpts)
      .status(200)
      .json({
        success: true,
        message: "Token refreshed",
        details: null,
        data: { accessToken },
      });
    return;
  } catch (err) {
    next(err);
  }
};

export const list = async (_req: Request, res: Response) =>
  res.json(await svc.listUsers());
export const disable = async (req: Request, res: Response) =>
  res.json(await svc.deactivate(req.params.id));

export const logout = async (req: Request, res: Response) => {
  try {
    // Clear both access and refresh token cookies
    res
      .clearCookie(COOKIE_ACCESS_TOKEN, {
        ...accessCookieOpts,
        maxAge: 0,
      })
      .clearCookie(COOKIE_REFRESH_TOKEN, {
        ...refreshCookieOpts,
        maxAge: 0,
      })
      .status(200)
      .json({
        success: true,
        message: "Logout successful",
        data: null,
      });
  } catch (err) {
    // Even if there's an error, we should still clear cookies
    res
      .clearCookie(COOKIE_ACCESS_TOKEN, {
        ...accessCookieOpts,
        maxAge: 0,
      })
      .clearCookie(COOKIE_REFRESH_TOKEN, {
        ...refreshCookieOpts,
        maxAge: 0,
      })
      .status(200)
      .json({
        success: true,
        message: "Logout completed",
        data: null,
      });
  }
};

export const profile = async (req: Request, res: Response) => {
  // The requireAuth middleware already populated req.user
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  res.json(req.user);
};
