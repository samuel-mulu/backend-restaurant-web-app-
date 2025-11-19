import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { User } from "../../modules/auth/user.model";
import { Role } from "../../constants/roles";
import { getAccessToken } from "../utils/getToken";

export const ROLE_RANK: Record<Role, number> = {
  owner: 3,
  cashier: 2,
  waiter: 1,
};

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        id: string;
        name: string;
        email: string;
        role: Role;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

/**
 * Require a valid access token and attach a minimal user object from DB to req.user.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (req.user) return next();

    const token = getAccessToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        details: [
          {
            message:
              "Your session has expired or the access token is invalid. Please log in to continue.",
          },
        ],
      });
      return;
    }

    const decoded = verifyAccessToken(token);
    const id = decoded._id;
    if (!id) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        details: [
          {
            message:
              "Your session has expired or the access token is invalid. Please log in to continue.",
          },
        ],
      });
      return;
    }

    const user = await User.findById(id)
      .select("name email role phone status isActive createdAt updatedAt")
      .lean()
      .exec();

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User account not found",
        details: [
          {
            message:
              "We could not find a user account associated with your credentials. Please check your login details or contact support if you believe this is an error.",
          },
        ],
      });
      return;
    }

    // Guard by account status
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Account deactivated",
        details: [
          {
            message:
              "Your account has been deactivated. Please contact support.",
          },
        ],
      });
      return;
    }

    req.user = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
      details: [
        {
          message:
            "Your session has expired or the access token is invalid. Please log in to continue.",
        },
      ],
    });
    return;
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await requireAuth(req, res, async (err?: any) => {
      if (err) return next(err);

      const user = req.user;
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          details: [
            { message: "Please log in with a valid account to continue." },
          ],
        });
        return;
      }

      if (!roles.includes(user.role)) {
        res.status(403).json({
          success: false,
          message: "Access denied",
          details: [
            { message: "You don't have permission to perform this action." },
          ],
        });
        return;
      }

      next();
    });
  };
}

export function requireMinRole(min: Role) {
  const minRank = ROLE_RANK[min];
  return async (req: Request, res: Response, next: NextFunction) => {
    await requireAuth(req, res, async (err?: any) => {
      if (err) return next(err);

      const user = req.user;
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          details: [
            { message: "Please log in with a valid account to continue." },
          ],
        });
        return;
      }

      if (ROLE_RANK[user.role] < minRank) {
        res.status(403).json({
          success: false,
          message: "Access denied",
          details: [
            { message: "You don't have permission to perform this action." },
          ],
        });
        return;
      }

      next();
    });
  };
}

export const requireOwner = requireRole("owner");
export const requireCashier = requireRole("cashier");
export const requireWaiter = requireRole("waiter");
