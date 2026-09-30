import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import { getProjectForUser } from "../services/access.js";
import { logActivity } from "../services/activity.js";
import { notifyProjectMembers } from "../services/notifications.js";

const USER_FIELDS = "name username avatar";

const POPULATE_PATHS = [
  { path: "assignee", select: USER_FIELDS },
  { path: "createdBy", select: USER_FIELDS },
];

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
    res.status(409).json({
      error: "This task changed while you were editing it.",
      code: "TASK_CONFLICT",
      task,
      serverUpdatedAt,
    });

    return false;
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

// Runs non-critical side effects (activity log, member notifications)
// AFTER the response has already been sent, in parallel with each
// other. A failure here is logged but never affects the response
// the client already received.
function runAfterResponse(tasks) {
  Promise.all(tasks).catch((error) => {
    console.error("Post-response task side effect failed:", error);
  });
}

/**
 * GET /api/projects/:projectId/tasks
 */
export async function listTasks(req, res) {
  try {
    const project = await getProjectForUser(
      req.params.projectId,
      req.user._id,
      { populateUsers: false }
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
      req.user._id,
      { populateUsers: false }
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
    const title = String(req.body.title || "").trim();

    if (!title) {
      return res.status(400).json({
        error: "Task title is required.",
      });
    }

    // These two reads are independent (one is on Project, the other
    // on Task filtered by projectId) so run them concurrently instead
    // of one after the other.
    const [project, lastTask] = await Promise.all([
      getProjectForUser(req.params.projectId, req.user._id, {
        populateUsers: false,
      }),
      Task.findOne({ project: req.params.projectId })
        .sort({ serial: -1 })
        .select("serial")
        .lean(),
    ]);

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const requestedColumn =
      req.body.column || project.columns[0]?._id;

    const column = getColumn(project, requestedColumn);

    if (!column) {
      return res.status(400).json({
        error: "The selected board column does not exist.",
      });
    }

    const nextSerial = Number(lastTask?.serial || 0) + 1;

    const task = await Task.create({
      serial: nextSerial,
      title,
      description: String(req.body.description || ""),
      project: project._id,
      column: column._id,
      position: Date.now(),
      priority: req.body.priority || "medium",
      labels: Array.isArray(req.body.labels) ? req.body.labels : [],
      dueDate: req.body.dueDate || null,
      assignee: req.body.assignee || null,
      createdBy: req.user._id,
      estimatedTime: Number(req.body.estimatedTime) || 0,
      subtasks: Array.isArray(req.body.subtasks)
        ? req.body.subtasks
        : [],
    });

    // Populate the document we already have instead of re-fetching
    // it from the database a second time.
    await task.populate(POPULATE_PATHS);

    // Respond as soon as the task itself is created and populated.
    // Activity logging and notifications don't need to block this.
    res.status(201).json({ task });

    emit(req, "task:created", {
      task,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    const sideEffects = [
      logActivity({
        user: req.user._id,
        project: project._id,
        task: task._id,
        action: "TASK_CREATED",
      }),
      notifyProjectMembers({
        req,
        projectId: project._id,
        actorId: req.user._id,
        taskId: task._id,
        type: "TASK_CREATED",
        message: `${actorName(req)} created "${task.title}"`,
        project,
      }),
    ];

    if (
      task.assignee &&
      String(task.assignee) !== String(req.user._id)
    ) {
      sideEffects.push(
        Notification.create({
          user: task.assignee,
          project: project._id,
          task: task._id,
          type: "ASSIGNED",
          message: `You were assigned "${task.title}"`,
        }).then((assignmentNotification) => {
          req.app
            .get("io")
            ?.to(`user:${task.assignee}`)
            .emit("notification:received", {
              notification: assignmentNotification,
            });
        })
      );
    }

    runAfterResponse(sideEffects);
  } catch (error) {
    console.error("Failed to create task:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message || "Failed to create task",
      });
    }
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

    const project = await getProjectForUser(task.project, req.user._id, {
      populateUsers: false,
    });

    if (!project) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    const before = task.toObject();

    if (checkTaskVersion(task, req, res) !== true) {
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
      if (!getColumn(project, req.body.column)) {
        return res.status(400).json({
          error: "The selected board column does not exist.",
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
      String(task.column) === String(doneColumn._id)
    ) {
      task.completedAt = task.completedAt || new Date();
    } else if (
      doneColumn &&
      String(before.column) === String(doneColumn._id) &&
      String(task.column) !== String(doneColumn._id)
    ) {
      task.completedAt = null;
    }

    await task.save();

    await task.populate(POPULATE_PATHS);

    res.json({ task });

    emit(req, "task:updated", {
      task,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    const sideEffects = [
      logActivity({
        user: req.user._id,
        project: project._id,
        task: task._id,
        action: "TASK_UPDATED",
        metadata: {
          before,
          changes: req.body,
        },
      }),
      notifyProjectMembers({
        req,
        projectId: project._id,
        actorId: req.user._id,
        taskId: task._id,
        type: "TASK_UPDATED",
        message: `${actorName(req)} updated "${task.title}"`,
        project,
      }),
    ];

    if (
      before.assignee?.toString() !== task.assignee?.toString() &&
      task.assignee &&
      String(task.assignee) !== String(req.user._id)
    ) {
      sideEffects.push(
        Notification.create({
          user: task.assignee,
          project: project._id,
          task: task._id,
          type: "ASSIGNED",
          message: `You were assigned "${task.title}"`,
        }).then((assignmentNotification) => {
          req.app
            .get("io")
            ?.to(`user:${task.assignee}`)
            .emit("notification:received", {
              notification: assignmentNotification,
            });
        })
      );
    }

    runAfterResponse(sideEffects);
  } catch (error) {
    console.error("Failed to update task:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message || "Failed to update task",
      });
    }
  }
}

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

    const project = await getProjectForUser(task.project, req.user._id, {
      populateUsers: false,
    });

    if (!project) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    if (checkTaskVersion(task, req, res) !== true) {
      return;
    }

    const targetColumn = getColumn(project, req.body.column);

    if (!targetColumn) {
      return res.status(400).json({
        error: "The selected board column does not exist.",
      });
    }

    // --------------------------------------------------
    // Save original column BEFORE changing the task
    // --------------------------------------------------

    const fromColumnId = task.column;
    const fromColumn = getColumn(project, fromColumnId);
    const fromColumnName = fromColumn?.name || "Unknown";
    const toColumnName = targetColumn?.name || "Unknown";

    // --------------------------------------------------
    // Move task
    // --------------------------------------------------

    task.column = targetColumn._id;
    task.position = Number(req.body.position) || Date.now();

    // --------------------------------------------------
    // Handle completedAt
    // --------------------------------------------------

    const doneColumn = project.columns.find(
      (column) =>
        String(column.name || "")
          .trim()
          .toLowerCase() === "done"
    );

    if (
      doneColumn &&
      String(targetColumn._id) === String(doneColumn._id)
    ) {
      task.completedAt = task.completedAt || new Date();
    } else if (
      doneColumn &&
      String(fromColumnId) === String(doneColumn._id) &&
      String(targetColumn._id) !== String(doneColumn._id)
    ) {
      task.completedAt = null;
    }

    await task.save();

    // --------------------------------------------------
    // Populate the document we already have in memory
    // instead of re-fetching it from the database.
    // --------------------------------------------------

    await task.populate(POPULATE_PATHS);

    // --------------------------------------------------
    // Respond immediately — the move is already durable.
    // Activity logging, the socket broadcast, and member
    // notifications don't need to block the client.
    // --------------------------------------------------

    res.json({ task });

    emit(req, "task:moved", {
      task,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    runAfterResponse([
      logActivity({
        user: req.user._id,
        project: project._id,
        task: task._id,
        action: "TASK_MOVED",
        metadata: {
          title: task.title,
          from: fromColumnId,
          to: task.column,
          fromColumn: fromColumnName,
          toColumn: toColumnName,
        },
      }),
      notifyProjectMembers({
        req,
        projectId: project._id,
        actorId: req.user._id,
        taskId: task._id,
        type: "TASK_MOVED",
        message:
          `${actorName(req)} moved "${task.title}" ` +
          `from ${fromColumnName} to ${toColumnName}`,
        project,
      }),
    ]);
  } catch (error) {
    console.error("Failed to move task:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message || "Failed to move task",
      });
    }
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

    const project = await getProjectForUser(task.project, req.user._id, {
      populateUsers: false,
    });

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
        Date.now() - task.timerStartedAt.getTime()
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

    const deletedAt = task.deletedAt;
    const expiresAt = new Date(deletedAt.getTime() + 24 * 60 * 60 * 1000);

    res.json({
      ok: true,
      taskId: task._id,
      deletedAt,
      expiresAt,
    });

    emit(req, "task:deleted", {
      taskId: task._id,
      projectId: project._id,
      deletedAt,
    });

    runAfterResponse([
      logActivity({
        user: req.user._id,
        project: project._id,
        task: task._id,
        action: "TASK_TRASHED",
        metadata: {
          title: task.title,
          deletedAt,
          permanentDeleteAfter: expiresAt,
        },
      }),
      notifyProjectMembers({
        req,
        projectId: project._id,
        actorId: req.user._id,
        taskId: task._id,
        type: "TASK_TRASHED",
        message: `${actorName(req)} moved "${task.title}" to Trash`,
        project,
      }),
    ]);
  } catch (error) {
    console.error("Failed to move task to trash:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message || "Failed to move task to trash",
      });
    }
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
        error: "Deleted task not found or it has expired",
      });
    }

    const project = await getProjectForUser(task.project, req.user._id, {
      populateUsers: false,
    });

    if (!project) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    const expiresAt =
      new Date(task.deletedAt).getTime() + 24 * 60 * 60 * 1000;

    if (Date.now() >= expiresAt) {
      return res.status(410).json({
        error: "This task's 24-hour recovery window has expired.",
      });
    }

    task.deletedAt = null;
    task.deletedBy = null;

    await task.save();

    await task.populate(POPULATE_PATHS);

    res.json({ ok: true, task });

    emit(req, "task:restored", {
      task,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });

    runAfterResponse([
      logActivity({
        user: req.user._id,
        project: project._id,
        task: task._id,
        action: "TASK_RESTORED",
        metadata: {
          title: task.title,
        },
      }),
      notifyProjectMembers({
        req,
        projectId: project._id,
        actorId: req.user._id,
        taskId: task._id,
        type: "TASK_RESTORED",
        message: `${actorName(req)} restored "${task.title}"`,
        project,
      }),
    ]);
  } catch (error) {
    console.error("Failed to restore task:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message || "Failed to restore task",
      });
    }
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

    const project = await getProjectForUser(task.project, req.user._id, {
      populateUsers: false,
    });

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
        Date.now() - task.timerStartedAt.getTime()
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

    await task.populate(POPULATE_PATHS);

    res.json({ task });

    emit(req, "task:updated", {
      task,
      projectId: project._id,
      actor: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
      },
    });
  } catch (error) {
    console.error("Failed to update timer:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message || "Failed to update timer",
      });
    }
  }
}