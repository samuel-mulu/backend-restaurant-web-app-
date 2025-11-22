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
    const { name, email, password, role, phone } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        details: [{ field: "name", message: "name is required" }],
      });
      return;
    }

    if (!phone) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        details: [{ field: "phone", message: "phone is required" }],
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

    // Registration is owner-only - require owner authentication
    const token = getAccessToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        details: [
          {
            message:
              "Only owner can create staff accounts. Please login first.",
          },
        ],
      });
      return;
    }

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
        details: [{ message: "Only owner can create staff accounts" }],
      });
      return;
    }

    // Ensure only cashier or waiter roles can be created
    if (role && role !== "cashier" && role !== "waiter") {
      res.status(403).json({
        success: false,
        message: "Access denied",
        details: [{ message: "Only cashier and waiter roles can be created" }],
      });
      return;
    }

    const existing = await User.findOne({
      phone: phone.trim(),
    }).lean();

    if (existing) {
      res.status(409).json({
        success: false,
        message: "Registration failed",
        details: [{ message: "Phone number already in use" }],
      });
      return;
    }

    // Check email if provided
    if (email) {
      const existingEmail = await User.findOne({
        email: email.toLowerCase().trim(),
      }).lean();

      if (existingEmail) {
        res.status(409).json({
          success: false,
          message: "Registration failed",
          details: [{ message: "Email already in use" }],
        });
        return;
      }
    }

    const hashed = await hashPassword(password);

    const user = await User.create({
      name,
      email: email ? email.toLowerCase().trim() : undefined,
      phone: phone.trim(),
      password: hashed,
      role: role || "cashier", // Default to cashier if not specified
    });

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
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
    const { phone, password } = (req.body ?? {}) as {
      phone: string;
      password: string;
    };

    // Basic validation
    if (!phone) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        details: [{ field: "phone", message: "phone is required" }],
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

    const probe = phone.trim();
    console.log("🔍 Looking for user with phone:", probe);

    const user = await User.findOne({
      phone: probe,
    })
      .select("password role phone name email")
      .exec();

    console.log("👤 User found:", user ? "Yes" : "No");
    if (user) {
      console.log("📱 User phone:", user.phone);
      console.log("🔒 Has password field:", !!user.password);
      console.log(
        "🔒 Password hash:",
        user.password ? user.password.substring(0, 20) + "..." : "None"
      );
    }

    // If user not found, equalize timing and return generic error
    if (!user) {
      await timingEqualizer();
      res.status(400).json({
        success: false,
        message: "Invalid credentials",
        details: [{ message: "Invalid phone number or password" }],
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
        details: [{ message: "Invalid phone number or password" }],
      });
      return;
    }

    console.log("🔐 Verifying password...");
    const okPass = await verifyPassword(password, user.password);
    console.log("🔐 Password verification result:", okPass);

    if (!okPass) {
      // Equalize a bit to blur timing between wrong-user and wrong-pass cases
      await timingEqualizer();

      res.status(400).json({
        success: false,
        message: "Login failed: Incorrect phone number or password.",
        details: [
          {
            message:
              "The phone number or password you entered is incorrect. Please double-check your credentials and try again.",
          },
        ],
      });
      return;
    }

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
    });

    const safeUser = {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
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
      "email name role phone"
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

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { name, email, phone } = req.body;
    const userRole = req.user.role;

    // Determine which fields can be updated based on role
    const updateData: { name?: string; email?: string; phone?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined && userRole === "owner") {
      updateData.phone = phone;
    }

    const updatedUser = await svc.updateUserProfile(
      req.user.id,
      updateData,
      userRole
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
      },
    });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    await svc.changeUserPassword(req.user.id, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

export const resetStaffPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    await svc.resetStaffPassword(id, newPassword);

    res.status(200).json({
      success: true,
      message: "Staff password reset successfully",
    });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};
