import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import Project from "../models/Project.js";
import { clearToken, setToken } from "../utils/jwt.js";

const INITIAL_COLUMNS = [
  { name: "To Do", position: 0, color: "#6D3DF5" },
  {
    name: "In Progress",
    position: 1,
    color: "#8B5CF6",
    wipLimit: 3,
  },
  { name: "Done", position: 2, color: "#A78BFA" },
];

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
  };
}

export async function signup(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const username = String(req.body.username || "").trim().toLowerCase();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        error: "Name, username, email and password are required.",
      });
    }

    if (name.length > 80 || username.length > 30) {
      return res.status(400).json({
        error: "Name or username is too long.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters.",
      });
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({
        error:
          "Username may contain lowercase letters, numbers, dots, underscores and hyphens.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Enter a valid email address.",
      });
    }

    const existing = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existing) {
      return res.status(409).json({
        error: "Email or username already exists.",
      });
    }

    const user = await User.create({
      name,
      username,
      email,
      passwordHash: await bcrypt.hash(password, 12),
    });

    const workspace = await Workspace.create({
      name: `${name}'s Workspace`,
      owner: user._id,
      members: [user._id],
    });

    await Project.create({
      name: "My First Project",
      description: "Collaborative Flowbase project",
      workspace: workspace._id,
      owner: user._id,
      members: [user._id],
      columns: INITIAL_COLUMNS,
    });

    setToken(res, user._id);

    return res.status(201).json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Signup failed:", error);
    return res.status(500).json({
      error: "Unable to create your account right now.",
    });
  }
}

export async function login(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    setToken(res, user._id);

    return res.json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({
      error: "Unable to log you in right now.",
    });
  }
}

export function logout(req, res) {
  clearToken(res);
  return res.json({ ok: true });
}

export function me(req, res) {
  return res.json({
    user: publicUser(req.user),
  });
}
