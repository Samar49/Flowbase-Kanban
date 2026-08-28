import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import { getProjectForUser } from "../services/access.js";
import { logActivity } from "../services/activity.js";
import { notifyProjectMembers } from "../services/notifications.js";

const userFields = "name username avatar";

function emit(req, event, data) {
  req.app.get("io")?.to(`project:${data.projectId}`).emit(event, data);
}

function actorName(req) {
  return req.user.name || req.user.username || "Someone";
}

export async function listComments(req, res) {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      deletedAt: null,
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!(await getProjectForUser(task.project, req.user._id))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const comments = await Comment.find({ task: task._id })
      .populate("user", userFields)
      .sort("createdAt");

    return res.json({ comments });
  } catch (error) {
    console.error("Failed to load comments:", error);
    return res.status(500).json({ error: "Failed to load comments" });
  }
}

export async function addComment(req, res) {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      deletedAt: null,
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const project = await getProjectForUser(task.project, req.user._id);

    if (!project) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const body = String(req.body.body || "").trim();

    if (!body) {
      return res.status(400).json({ error: "Comment cannot be empty." });
    }

    if (body.length > 2000) {
      return res.status(400).json({
        error: "Comment must be 2000 characters or fewer.",
      });
    }

    const comment = await Comment.create({
      task: task._id,
      user: req.user._id,
      body,
    });

    const populated = await comment.populate("user", userFields);

    await logActivity({
      user: req.user._id,
      project: project._id,
      task: task._id,
      action: "COMMENT_ADDED",
    });

    emit(req, "comment:added", {
      comment: populated,
      projectId: project._id,
      taskId: task._id,
      actorId: req.user._id,
    });

    await notifyProjectMembers({
      req,
      projectId: project._id,
      actorId: req.user._id,
      taskId: task._id,
      type: "COMMENT_ADDED",
      message: `${actorName(req)} commented on "${task.title}"`,
    });

    return res.status(201).json({ comment: populated });
  } catch (error) {
    console.error("Failed to add comment:", error);
    return res.status(500).json({ error: "Failed to add comment" });
  }
}

export async function editComment(req, res) {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment || String(comment.user) !== String(req.user._id)) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const task = await Task.findOne({
      _id: comment.task,
      deletedAt: null,
    });

    const project = task
      ? await getProjectForUser(task.project, req.user._id)
      : null;

    if (!project) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const body = String(req.body.body || "").trim();

    if (!body) {
      return res.status(400).json({ error: "Comment cannot be empty." });
    }

    if (body.length > 2000) {
      return res.status(400).json({
        error: "Comment must be 2000 characters or fewer.",
      });
    }

    comment.body = body;
    await comment.save();

    const populated = await comment.populate("user", userFields);

    emit(req, "comment:updated", {
      comment: populated,
      projectId: project._id,
      taskId: task._id,
      actorId: req.user._id,
    });

    return res.json({ comment: populated });
  } catch (error) {
    console.error("Failed to edit comment:", error);
    return res.status(500).json({ error: "Failed to edit comment" });
  }
}

export async function deleteComment(req, res) {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment || String(comment.user) !== String(req.user._id)) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const task = await Task.findOne({
      _id: comment.task,
      deletedAt: null,
    });

    const project = task
      ? await getProjectForUser(task.project, req.user._id)
      : null;

    if (!project) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const commentId = comment._id;
    const taskId = comment.task;

    await comment.deleteOne();

    emit(req, "comment:deleted", {
      commentId,
      projectId: project._id,
      taskId,
      actorId: req.user._id,
    });

    return res.json({ ok: true, commentId });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return res.status(500).json({ error: "Failed to delete comment" });
  }
}
