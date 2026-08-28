import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Project from "../models/Project.js";

function getAllowedOrigins() {
  return String(process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function initSocket(httpServer) {
  const allowedOrigins = getAllowedOrigins();

  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("Origin not allowed by Socket.IO CORS."));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers.cookie || "";
      const match = header.match(/(?:^|; )token=([^;]+)/);
      const token = socket.handshake.auth?.token || match?.[1];

      if (!token) {
        return next(new Error("unauthorized"));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(payload.id).select(
        "name username email avatar"
      );

      if (!user) {
        return next(new Error("unauthorized"));
      }

      socket.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userRoom = `user:${socket.user._id}`;

    socket.join(userRoom);
    socket.data.projectIds = new Set();

    socket.on("project:join", async (projectId) => {
      try {
        const project = await Project.findOne({
          _id: projectId,
          $or: [
            { owner: socket.user._id },
            { members: socket.user._id },
          ],
        }).populate("members", "name username email avatar");

        if (!project) {
          socket.emit("project:error", {
            error: "You do not have access to this project.",
          });
          return;
        }

        const room = `project:${projectId}`;

        socket.join(room);
        socket.data.projectIds.add(String(projectId));

        const onlineSockets = await io.in(room).fetchSockets();
        const onlineIds = new Set(
          onlineSockets.map((item) => String(item.user._id))
        );

        socket.emit("presence:snapshot", {
          users: project.members.filter((member) =>
            onlineIds.has(String(member._id))
          ),
          projectId,
        });

        socket.to(room).emit("presence:joined", {
          user: socket.user,
          projectId,
        });
      } catch {
        socket.emit("project:error", {
          error: "Unable to join this project.",
        });
      }
    });

    socket.on("project:leave", async (projectId) => {
      const room = `project:${projectId}`;

      socket.leave(room);
      socket.data.projectIds.delete(String(projectId));

      const remaining = await io.in(room).fetchSockets();

      const sameUserStillOnline = remaining.some(
        (item) => String(item.user._id) === String(socket.user._id)
      );

      if (!sameUserStillOnline) {
        socket.to(room).emit("presence:left", {
          userId: socket.user._id,
          projectId,
        });
      }
    });

    socket.on("task:typing", async (data = {}) => {
      const projectId = data.projectId;
      const taskId = data.taskId;

      if (!projectId || !taskId) return;

      const project = await Project.exists({
        _id: projectId,
        $or: [
          { owner: socket.user._id },
          { members: socket.user._id },
        ],
      });

      if (!project) return;

      socket.to(`project:${projectId}`).emit("task:typing", {
        projectId,
        taskId,
        isTyping: Boolean(data.isTyping),
        user: socket.user,
      });
    });

    socket.on("disconnect", async () => {
      const projectIds = socket.data.projectIds || new Set();

      for (const projectId of projectIds) {
        const room = `project:${projectId}`;

        const remaining = await io.in(room).fetchSockets();

        const sameUserStillOnline = remaining.some(
          (item) => String(item.user._id) === String(socket.user._id)
        );

        if (!sameUserStillOnline) {
          socket.to(room).emit("presence:left", {
            userId: socket.user._id,
            projectId,
          });
        }
      }
    });
  });

  return io;
}
