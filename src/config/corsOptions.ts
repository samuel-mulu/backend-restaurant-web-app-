import cors from "cors";
import { env } from "./env";

const allowedOrigins = [
  "http://localhost:5000",
  "http://192.168.247.135:3000", // ✅ FIXED (added http://)
  env.corsOrigin,
  "https://menu-wheat-sigma.vercel.app",
  "https://kandinos.vercel.app", // ✅ ADDED (your missing frontend)
]
  .filter((domain): domain is string => Boolean(domain))
  .map((domain) => domain.toLowerCase().replace(/\/$/, ""));

// Fallback to allow all origins in development or if no CORS_ORIGIN is set
const isDevelopment = env.nodeEnv === "development";
const shouldAllowAll = isDevelopment || allowedOrigins.length === 0;

console.log("Allowed CORS origins:", allowedOrigins);

export const corsOptions = cors({
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    console.log("CORS check for origin:", origin);
    console.log("Environment:", env.nodeEnv);
    console.log("Should allow all:", shouldAllowAll);

    // ✅ Allow all in development
    if (shouldAllowAll) {
      console.log("Development mode or no CORS_ORIGIN - allowing all origins");
      return callback(null, true);
    }

    // ✅ Allow requests with no origin (Postman, mobile apps)
    if (!origin) {
      console.log("No origin - allowing");
      return callback(null, true);
    }

    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "");
    console.log("Normalized origin:", normalizedOrigin);

    // ✅ Exact match
    if (allowedOrigins.includes(normalizedOrigin)) {
      console.log("Exact match found - allowing");
      return callback(null, true);
    }

    // ✅ Subdomain match
    const isSubdomain = allowedOrigins.some((domain) =>
      normalizedOrigin.endsWith(`.${domain}`)
    );

    if (isSubdomain) {
      console.log("Subdomain match found - allowing");
      return callback(null, true);
    }

    // ❌ BLOCK (REAL BLOCK NOW)
    console.warn(`CORS blocked: ${origin}`);
    console.warn(`Allowed origins: ${allowedOrigins.join(", ")}`);

    return callback(new Error(`Origin ${origin} not allowed by CORS`)); // ✅ FIXED
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Set-Cookie", "Authorization"],
  optionsSuccessStatus: 204,
  preflightContinue: false,
});