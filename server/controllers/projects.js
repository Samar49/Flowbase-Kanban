import Project from "../models/Project.js";
import Workspace from "../models/Workspace.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import Invitation from "../models/Invitation.js";
import { getProjectForUser, isProjectOwner } from "../services/access.js";
import { logActivity } from "../services/activity.js";
import { notifyProjectMembers } from "../services/notifications.js";

const FIXED_COLUMNS = [
  { name: "To Do", position: 0, color: "#6D3DF5" },
  {
    name: "In Progress",
    position: 1,
    color: "#8B5CF6",
    wipLimit: 3,
  },
  { name: "Done", position: 2, color: "#A78BFA" },
];

function emit(req, event, data) {
  const projectId = data.projectId || data.project?._id;
  if (!projectId) return;

  req.app.get("io")?.to(`project:${projectId}`).emit(event, data);
}

export async function listProjects(req, res) {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { members: req.user._id },
      ],
    })
      .select(
        "_id name description owner updatedAt"
      )
      .populate(
        "owner",
        "name username"
      )
      .sort("-updatedAt")
      .lean();

    return res.json({
      projects,
    });
  } catch (error) {
    console.error(
      "Failed to list projects:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Failed to load projects",
    });
  }
}

export async function createProject(req, res) {
  try {
    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Project name is required." });
    }

    if (name.length > 80) {
      return res.status(400).json({
        error: "Project name must be 80 characters or fewer.",
      });
    }

    const workspaceId =
      req.body.workspace ||
      (await Workspace.findOne({ members: req.user._id }))?._id;

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace required" });
    }

    const p = await Project.create({
      name,
      description: String(req.body.description || ""),
      workspace: workspaceId,
      owner: req.user._id,
      members: [req.user._id],
      columns: FIXED_COLUMNS,
    });

    await logActivity({
      user: req.user._id,
      project: p._id,
      action: "PROJECT_CREATED",
    });

    return res.status(201).json({ project: p });
  } catch (error) {
    console.error("Failed to create project:", error);
    return res.status(500).json({
      error: error.message || "Failed to create project",
    });
  }
}

export async function getProject(req, res) {
  try {
    const p = await getProjectForUser(req.params.id, req.user._id);

    if (!p) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.json({ project: p });
  } catch (error) {
    console.error("Failed to load project:", error);
    return res.status(500).json({ error: "Failed to load project" });
  }
}

export async function updateProject(req, res) {
  try {
    const p = await getProjectForUser(req.params.id, req.user._id);

    if (!p) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();

      if (!name) {
        return res.status(400).json({
          error: "Project name cannot be empty.",
        });
      }

      if (name.length > 80) {
        return res.status(400).json({
          error: "Project name must be 80 characters or fewer.",
        });
      }

      p.name = name;
    }

    if (req.body.description !== undefined) {
      p.description = String(req.body.description).slice(0, 500);
    }

    await p.save();

    emit(req, "project:updated", {
      project: p,
      projectId: p._id,
    });

    await notifyProjectMembers({
      req,
      projectId: p._id,
      actorId: req.user._id,
      type: "PROJECT_UPDATED",
      message: `${req.user.name || req.user.username || "Someone"} updated ${p.name}`,
    });

    return res.json({ project: p });
  } catch (error) {
    console.error("Failed to update project:", error);
    return res.status(500).json({ error: "Failed to update project" });
  }
}

export async function deleteProject(req, res) {
  try {
    const p = await getProjectForUser(req.params.id, req.user._id);

    if (!p) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!isProjectOwner(p, req.user._id)) {
      return res.status(403).json({
        error: "Only the project owner can delete this project.",
      });
    }

    const taskIds = await Task.find({
      project: p._id,
    }).distinct("_id");

    // Tell collaborators before the room disappears.
    emit(req, "project:deleted", {
      projectId: p._id,
      projectName: p.name,
    });

    await Promise.all([
      taskIds.length
        ? Comment.deleteMany({ task: { $in: taskIds } })
        : Promise.resolve(),
      Task.deleteMany({ project: p._id }),
      Activity.deleteMany({ project: p._id }),
      Notification.deleteMany({ project: p._id }),
      Invitation.deleteMany({ project: p._id }),
    ]);

    await p.deleteOne();

    return res.json({
      ok: true,
      projectId: p._id,
    });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return res.status(500).json({
      error: error.message || "Failed to delete project",
    });
  }
}

// Flowbase intentionally uses exactly three fixed columns.
export async function addColumn(req, res) {
  return res.status(403).json({
    error:
      "Flowbase boards use exactly three fixed columns: TO DO, IN PROGRESS and DONE.",
  });
}

export async function updateColumn(req, res) {
  return res.status(403).json({
    error: "Board columns are fixed and cannot be changed.",
  });
}

export async function deleteColumn(req, res) {
  return res.status(403).json({
    error: "Board columns are fixed and cannot be deleted.",
  });
}

export async function exportProject(req, res) {
  try {
    const p = await getProjectForUser(req.params.id, req.user._id);

    if (!p) {
      return res.status(404).json({ error: "Project not found" });
    }

    const tasks = await Task.find({
      project: p._id,
      deletedAt: null,
    }).lean();

    return res.json({ project: p, tasks });
  } catch (error) {
    console.error("Failed to export project:", error);
    return res.status(500).json({ error: "Failed to export project" });
  }
}

export async function importProject(req, res) {
  try {
    const p = await getProjectForUser(req.params.id, req.user._id);

    if (!p) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!Array.isArray(req.body.tasks)) {
      return res.status(400).json({ error: "tasks must be an array." });
    }

    const allowedColumns = new Set(p.columns.map((column) => String(column._id)));

    const tasks = req.body.tasks
      .slice(0, 500)
      .map((task, index) => ({
        title: String(task.title || "").trim(),
        description: String(task.description || ""),
        project: p._id,
        column: allowedColumns.has(String(task.column))
          ? task.column
          : p.columns[0]._id,
        position: Date.now() + index,
        serial: index + 1,
        priority: ["low", "medium", "high"].includes(task.priority)
          ? task.priority
          : "medium",
        labels: Array.isArray(task.labels) ? task.labels.slice(0, 20) : [],
        dueDate: task.dueDate || null,
        assignee: task.assignee || null,
        createdBy: req.user._id,
        estimatedTime: Number(task.estimatedTime) || 0,
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      }))
      .filter((task) => task.title);

    if (tasks.length) {
      await Task.insertMany(tasks);
    }

    return res.json({ imported: tasks.length });
  } catch (error) {
    console.error("Failed to import project:", error);
    return res.status(500).json({ error: "Failed to import project" });
  }
}
