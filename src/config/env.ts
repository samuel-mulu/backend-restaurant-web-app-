import "dotenv/config";

const bool = (v?: string, d = false) =>
  v === undefined ? d : ["1", "true", "yes", "on"].includes(v.toLowerCase());

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 5000),

  // Database
  mongoUri: process.env.MONGO_URI as string,

  // Cloudinary
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY as string,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET as string,
  cloudinaryUrl: process.env.CLOUDINARY_URL as string,

  // Cookies / CORS
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  corsOrigin: process.env.CORS_ORIGIN || undefined,
  secureCookies: bool(process.env.SECURE_COOKIES, false),

  // JWT
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? "30d",
  jwtSecret: process.env.JWT_SECRET as string,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET as string,

  // Email (SMTP)
  smtpHost: process.env.SMTP_HOST as string,
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER as string,
  smtpPass: process.env.SMTP_PASS as string,
  smtpFromName: process.env.SMTP_FROM_NAME || "Longtea",
  smtpFromEmail: process.env.SMTP_FROM_EMAIL as string,

  // POS Printer Service
  posPrinterUrl: process.env.POS_PRINTER_URL || "http://localhost:7777",
  posPrinterKey: process.env.POS_PRINTER_KEY as string | undefined,
};
