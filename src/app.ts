import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import compression from "compression";

//**====importing custom middlewares==== */
import { corsOptions } from "./config/corsOptions";
import { errorHandler } from "./common/middleware/errorHandler";
import { getMongoHealth } from "./config//database";

import routes from "./modules/routes";
import path from "path";

const app = express();
const routePrefix = "/api/v1";

//**====disabling x-powered-by header==== */
app.disable("x-powered-by");

//**====helmet middleware==== */
app.use(helmet());

//**====http logger middleware==== */
// app.use(httpLogger);

//**====cors middleware==== */
app.use(corsOptions);

//**====limiting the request rate==== */
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 400 }));

//**====limiting the request body size==== */
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

//**====cookie parser middleware==== */
app.use(cookieParser());

//**==== response compression middleware==== */
app.use(compression());

// **==== setting cache headers ==== */
app.use((req, res, next) => {
  if (req.path.startsWith(routePrefix + "/auth")) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

app.get("/", (req, res) => {
  res.json({
    message: "Restaurant Menu API Server",
    status: "running",
    health: "/health",
    api: "/api/v1",
  });
});

app.get("/health", (req, res) => {
  const mongoHealth = getMongoHealth();
  res.json({
    status: mongoHealth.status === "connected" ? "ok" : "degraded",
    mongo: mongoHealth,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// **==== serving static files ==== */
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

//**====http logger middleware==== */
app.use((req, res, next) => {
  console.log("----- Incoming Request -----");
  console.log("===========================");
  console.log("===========================");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  // console.log("Headers:", req.headers);
  console.log("Query:", req.query);
  console.log("Body:", req.body);
  console.log("----------------------------");

  next();
});

//**==== prefixing all routes ====*/
app.use(routePrefix, routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `The requested endpoint [${req.method} ${req.originalUrl}] was not found on this server.`,
    hint: "Verify the URL or check the API documentation for available endpoints.",
    timestamp: new Date().toISOString(),
  });
});

//**====error handler middleware==== */
app.use(errorHandler);

export default app;
