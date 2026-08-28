import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import { getProjectForUser } from "../services/access.js";
import { logActivity } from "../services/activity.js";
import { notifyProjectMembers } from "../services/notifications.js";

const USER_FIELDS = "name username avatar";

const populate = (query) =>
  query
    .populate("assignee", USER_FIELDS)
    .populate("createdBy", USER_FIELDS);

function checkTaskVersion(task, req, res) {
  const baseUpdatedAt = req.body.baseUpdatedAt;

  if (!baseUpdatedAt) return true;

  const serverUpdatedAt =
    task.updatedAt?.toISOString?.() || String(task.updatedAt);

  if (String(baseUpdatedAt) !== serverUpdatedAt) {
    return res.status(409).json({
      error: "This task changed while you were editing it.",
      code: "TASK_CONFLICT",
      task,
      serverUpdatedAt,
    });
  }

  return true;
}

function emit(req, event, data) {
  req.app.get("io")?.to(`project:${data.projectId}`).emit(event, data);
}

function actorName(req) {
  return req.user.name || req.user.username || "Someone";
}

function getColumn(project, columnId) {
  return project.columns.find(
    (column) => String(column._id) === String(columnId)
  );
}

/**
 * GET /api/projects/:projectId/tasks
 */
export async function listTasks(req, res) {
  try {
    const project = await getProjectForUser(
      req.params.projectId,
      req.user._id
    );

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const tasks = await populate(
      Task.find({
        project: project._id,
        deletedAt: null,
      }).sort({
        column: 1,
        position: 1,
      })
    );

    return res.json({ tasks });
  } catch (error) {
    console.error("Failed to list tasks:", error);

    return res.status(500).json({
      error: "Failed to load tasks",
    });
  }
}

/**
 * GET /api/projects/:projectId/trash
 */
export async function listTrash(req, res) {
  try {
    const project = await getProjectForUser(
      req.params.projectId,
      req.user._id
    );

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const tasks = await populate(
      Task.find({
        project: project._id,
        deletedAt: { $ne: null },
      }).sort({
        deletedAt: -1,
      })
    );

    return res.json({ tasks });
  } catch (error) {
    console.error("Failed to list trash:", error);

    return res.status(500).json({
      error: "Failed to load trash",
    });
  }
}

/**
 * POST /api/projects/:projectId/tasks
 */
export async function createTask(req, res) {
  try {
    const project = await getProjectForUser(
      req.params.projectId,
      req.user._id
    );

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const title = String(req.body.title || "").trim();

    if (!title) {
      return res.status(400).json({
        error: "Task title is required.",
      });
    }

    const requestedColumn =
      req.body.column || project.columns[0]?._id;

    const column = getColumn(
      project,
      requestedColumn
    );

    if (!column) {
      return res.status(400).json({
        error: "The selected board column does not exist.",
      });
    }

    const lastTask = await Task.findOne({
      project: project._id,
    })
      .sort({
        serial: -1,
      })
      .select("serial")
      .lean();

    const nextSerial =
      Number(lastTask?.serial || 0) + 1;

    const task = await Task.create({
      serial: nextSerial,
      title,
      description: String(
        req.body.description || ""
      ),
      project: project._id,
      column: column._id,
      position: Date.now(),
      priority: req.body.priority || "medium",
      labels: Array.isArray(req.body.labels)
        ? req.body.labels
        : [],
      dueDate: req.body.dueDate || null,
      assignee: req.body.assignee || null,
      createdBy: req.user._id,
      estimatedTime:
        Number(req.body.estimatedTime) || 0,
      subtasks: Array.isArray(req.body.subtasks)
        ? req.body.subtasks
        : [],
    });

    const populatedTask = await populate(
      Task.findOne({
        _id: task._id,
        deletedAt: null,
      })
    );

    await logActivity({
      user: req.user._id,
      project: project._id,
      task: task._id,
      action: "TASK_CREATED",
    });

    emit(req, "task:created", {
      task: populatedTask,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    await notifyProjectMembers({
      req,
      projectId: project._id,
      actorId: req.user._id,
      taskId: task._id,
      type: "TASK_CREATED",
      message: `${actorName(req)} created "${task.title}"`,
    });

    if (
      task.assignee &&
      String(task.assignee) !==
        String(req.user._id)
    ) {
      const assignmentNotification =
        await Notification.create({
          user: task.assignee,
          project: project._id,
          task: task._id,
          type: "ASSIGNED",
          message:
            `You were assigned "${task.title}"`,
        });

      req.app
        .get("io")
        ?.to(`user:${task.assignee}`)
        .emit("notification:received", {
          notification: assignmentNotification,
        });
    }

    return res.status(201).json({
      task: populatedTask,
    });
  } catch (error) {
    console.error("Failed to create task:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Failed to create task",
    });
  }
}

/**
 * PUT /api/tasks/:taskId
 */
export async function updateTask(req, res) {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      deletedAt: null,
    });

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const project = await getProjectForUser(
      task.project,
      req.user._id
    );

    if (!project) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    const before = task.toObject();

    if (
      checkTaskVersion(task, req, res) !== true
    ) {
      return;
    }

    const fields = [
      "title",
      "description",
      "priority",
      "labels",
      "dueDate",
      "assignee",
      "estimatedTime",
      "dependencies",
      "subtasks",
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    if (req.body.column !== undefined) {
      if (
        !getColumn(
          project,
          req.body.column
        )
      ) {
        return res.status(400).json({
          error:
            "The selected board column does not exist.",
        });
      }

      task.column = req.body.column;
    }

    const doneColumn = project.columns.find(
      (column) =>
        String(column.name || "")
          .trim()
          .toLowerCase() === "done"
    );

    if (
      doneColumn &&
      String(task.column) ===
        String(doneColumn._id)
    ) {
      task.completedAt =
        task.completedAt || new Date();
    } else if (
      doneColumn &&
      String(before.column) ===
        String(doneColumn._id) &&
      String(task.column) !==
        String(doneColumn._id)
    ) {
      task.completedAt = null;
    }

    await task.save();

    const populatedTask = await populate(
      Task.findOne({
        _id: task._id,
        deletedAt: null,
      })
    );

    await logActivity({
      user: req.user._id,
      project: project._id,
      task: task._id,
      action: "TASK_UPDATED",
      metadata: {
        before,
        changes: req.body,
      },
    });

    emit(req, "task:updated", {
      task: populatedTask,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    await notifyProjectMembers({
      req,
      projectId: project._id,
      actorId: req.user._id,
      taskId: task._id,
      type: "TASK_UPDATED",
      message:
        `${actorName(req)} updated "${task.title}"`,
    });

    if (
      before.assignee?.toString() !==
        task.assignee?.toString() &&
      task.assignee &&
      String(task.assignee) !==
        String(req.user._id)
    ) {
      const assignmentNotification =
        await Notification.create({
          user: task.assignee,
          project: project._id,
          task: task._id,
          type: "ASSIGNED",
          message:
            `You were assigned "${task.title}"`,
        });

      req.app
        .get("io")
        ?.to(`user:${task.assignee}`)
        .emit("notification:received", {
          notification:
            assignmentNotification,
        });
    }

    return res.json({
      task: populatedTask,
    });
  } catch (error) {
    console.error(
      "Failed to update task:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Failed to update task",
    });
  }
}

/**
 * PATCH /api/tasks/:taskId/move
 */
/**
 * PATCH /api/tasks/:taskId/move
 */
export async function moveTask(req, res) {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      deletedAt: null,
    });

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const project =
      await getProjectForUser(
        task.project,
        req.user._id
      );

    if (!project) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    if (
      checkTaskVersion(
        task,
        req,
        res
      ) !== true
    ) {
      return;
    }

    const targetColumn =
      getColumn(
        project,
        req.body.column
      );

    if (!targetColumn) {
      return res.status(400).json({
        error:
          "The selected board column does not exist.",
      });
    }

    // --------------------------------------------------
    // Save original column BEFORE changing the task
    // --------------------------------------------------

    const fromColumnId =
      task.column;

    const fromColumn =
      getColumn(
        project,
        fromColumnId
      );

    const fromColumnName =
      fromColumn?.name ||
      "Unknown";

    const toColumnName =
      targetColumn?.name ||
      "Unknown";

    // --------------------------------------------------
    // Move task
    // --------------------------------------------------

    task.column =
      targetColumn._id;

    task.position =
      Number(req.body.position) ||
      Date.now();

    // --------------------------------------------------
    // Handle completedAt
    // --------------------------------------------------

    const doneColumn =
      project.columns.find(
        (column) =>
          String(
            column.name || ""
          )
            .trim()
            .toLowerCase() ===
          "done"
      );

    if (
      doneColumn &&
      String(
        targetColumn._id
      ) ===
        String(
          doneColumn._id
        )
    ) {
      task.completedAt =
        task.completedAt ||
        new Date();
    } else if (
      doneColumn &&
      String(
        fromColumnId
      ) ===
        String(
          doneColumn._id
        ) &&
      String(
        targetColumn._id
      ) !==
        String(
          doneColumn._id
        )
    ) {
      task.completedAt =
        null;
    }

    await task.save();

    // --------------------------------------------------
    // Get populated task
    // --------------------------------------------------

    const populatedTask =
      await populate(
        Task.findOne({
          _id: task._id,
          deletedAt: null,
        })
      );

    // --------------------------------------------------
    // ACTIVITY HISTORY
    // --------------------------------------------------

    await logActivity({
      user: req.user._id,
      project: project._id,
      task: task._id,

      action: "TASK_MOVED",

      metadata: {
        title: task.title,

        // Keep IDs
        from: fromColumnId,
        to: task.column,

        // Add readable names
        fromColumn:
          fromColumnName,

        toColumn:
          toColumnName,
      },
    });

    // --------------------------------------------------
    // REAL-TIME UPDATE
    // --------------------------------------------------

    emit(req, "task:moved", {
      task: populatedTask,

      projectId:
        project._id,

      actor: {
        _id:
          req.user._id,

        name:
          req.user.name,

        username:
          req.user.username,
      },
    });

    // --------------------------------------------------
    // NOTIFICATION
    // --------------------------------------------------

    await notifyProjectMembers({
      req,

      projectId:
        project._id,

      actorId:
        req.user._id,

      taskId:
        task._id,

      type:
        "TASK_MOVED",

      message:
        `${actorName(req)} moved "${task.title}" ` +
        `from ${fromColumnName} to ${toColumnName}`,
    });

    return res.json({
      task:
        populatedTask,
    });

  } catch (error) {
    console.error(
      "Failed to move task:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Failed to move task",
    });
  }
}

/**
 * DELETE /api/tasks/:taskId
 *
 * Soft-delete only. MongoDB TTL permanently removes
 * the document approximately 24 hours after
 * deletedAt is set.
 */
export async function deleteTask(req, res) {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      deletedAt: null,
    });

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const project = await getProjectForUser(
      task.project,
      req.user._id
    );

    if (!project) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    task.deletedAt = new Date();
    task.deletedBy = req.user._id;

    if (task.timerStartedAt) {
      const duration = Math.max(
        0,
        Date.now() -
          task.timerStartedAt.getTime()
      );

      task.actualTime += duration;

      task.sessions.push({
        startedAt: task.timerStartedAt,
        endedAt: new Date(),
        duration,
      });

      task.timerStartedAt = null;
    }

    await task.save();

    await logActivity({
      user: req.user._id,
      project: project._id,
      task: task._id,
      action: "TASK_TRASHED",
      metadata: {
        title: task.title,
        deletedAt: task.deletedAt,
        permanentDeleteAfter: new Date(
          task.deletedAt.getTime() +
            24 * 60 * 60 * 1000
        ),
      },
    });

    emit(req, "task:deleted", {
      taskId: task._id,
      projectId: project._id,
      deletedAt: task.deletedAt,
    });

    await notifyProjectMembers({
      req,
      projectId: project._id,
      actorId: req.user._id,
      taskId: task._id,
      type: "TASK_TRASHED",
      message:
        `${actorName(req)} moved "${task.title}" ` +
        `to Trash`,
    });

    return res.json({
      ok: true,
      taskId: task._id,
      deletedAt: task.deletedAt,
      expiresAt: new Date(
        task.deletedAt.getTime() +
          24 * 60 * 60 * 1000
      ),
    });
  } catch (error) {
    console.error(
      "Failed to move task to trash:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Failed to move task to trash",
    });
  }
}

/**
 * PATCH /api/tasks/:taskId/restore
 */
export async function restoreTask(req, res) {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      deletedAt: { $ne: null },
    });

    if (!task) {
      return res.status(404).json({
        error:
          "Deleted task not found or it has expired",
      });
    }

    const project = await getProjectForUser(
      task.project,
      req.user._id
    );

    if (!project) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    const expiresAt =
      new Date(task.deletedAt).getTime() +
      24 * 60 * 60 * 1000;

    if (Date.now() >= expiresAt) {
      return res.status(410).json({
        error:
          "This task's 24-hour recovery window has expired.",
      });
    }

    task.deletedAt = null;
    task.deletedBy = null;

    await task.save();

    const populatedTask = await populate(
      Task.findOne({
        _id: task._id,
        deletedAt: null,
      })
    );

    await logActivity({
      user: req.user._id,
      project: project._id,
      task: task._id,
      action: "TASK_RESTORED",
      metadata: {
        title: task.title,
      },
    });

    emit(req, "task:restored", {
      task: populatedTask,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    await notifyProjectMembers({
      req,
      projectId: project._id,
      actorId: req.user._id,
      taskId: task._id,
      type: "TASK_RESTORED",
      message:
        `${actorName(req)} restored "${task.title}"`,
    });

    return res.json({
      ok: true,
      task: populatedTask,
    });
  } catch (error) {
    console.error(
      "Failed to restore task:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Failed to restore task",
    });
  }
}

/**
 * POST /api/tasks/:taskId/timer
 */
export async function timer(req, res) {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      deletedAt: null,
    });

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const project = await getProjectForUser(
      task.project,
      req.user._id
    );

    if (!project) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    if (!task.timerStartedAt) {
      task.timerStartedAt = new Date();
    } else {
      const duration = Math.max(
        0,
        Date.now() -
          task.timerStartedAt.getTime()
      );

      task.actualTime += duration;

      task.sessions.push({
        startedAt: task.timerStartedAt,
        endedAt: new Date(),
        duration,
      });

      task.timerStartedAt = null;
    }

    await task.save();

    const populatedTask = await populate(
      Task.findOne({
        _id: task._id,
        deletedAt: null,
      })
    );

    emit(req, "task:updated", {
      task: populatedTask,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    return res.json({
      task: populatedTask,
    });
  } catch (error) {
    console.error(
      "Failed to update timer:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Failed to update timer",
    });
  }
}