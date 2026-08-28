import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import { connectDB, disconnectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import commentRoutes from "./routes/comments.js";
import activityRoutes from "./routes/activity.js";
import analyticsRoutes from "./routes/analytics.js";
import notificationRoutes from "./routes/notifications.js";
import collaborationRoutes from "./routes/collaboration.js";
import { auth } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { initSocket } from "./socket/index.js";

const requiredEnv = ["MONGO_URI", "JWT_SECRET", "CLIENT_URL"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`${key} is required.`);
  }
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server and health checks without an Origin header.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS."));
  },
  credentials: true,
};

app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/api/health", (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;

  res.status(databaseReady ? 200 : 503).json({
    ok: databaseReady,
    service: "flowbase-api",
    database: databaseReady ? "connected" : "disconnected",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", auth, projectRoutes);
app.use("/api", auth, taskRoutes);
app.use("/api", auth, commentRoutes);
app.use("/api", auth, activityRoutes);
app.use("/api", auth, analyticsRoutes);
app.use("/api/notifications", auth, notificationRoutes);
app.use("/api/collaboration", auth, collaborationRoutes);

app.use(notFound);
app.use(errorHandler);

const io = initSocket(server);
app.set("io", io);

const port = Number(process.env.PORT) || 5000;

await connectDB();

server.listen(port, () => {
  console.log(`Flowbase API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);

  io.close();

  server.close(async () => {
    try {
      await disconnectDB();
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
