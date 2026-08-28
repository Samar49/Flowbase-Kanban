import Activity from "../models/Activity.js";
import Task from "../models/Task.js";
import { getProjectForUser } from "../services/access.js";

export async function projectActivity(req, res) {
  try {
    const project = await getProjectForUser(
      req.params.projectId,
      req.user._id
    );

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const activities = await Activity.find({
      project: project._id,
    })
      .populate("user", "name username avatar")
      .populate("task", "title")
      .sort("-timestamp")
      .limit(200);

    return res.json({ activities });
  } catch (error) {
    console.error("Failed to load project activity:", error);
    return res.status(500).json({ error: "Failed to load activity" });
  }
}

export async function taskActivity(req, res) {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const project = await getProjectForUser(task.project, req.user._id);

    if (!project) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const activities = await Activity.find({
      task: task._id,
    })
      .populate("user", "name username avatar")
      .sort("-timestamp")
      .limit(100);

    return res.json({ activities });
  } catch (error) {
    console.error("Failed to load task activity:", error);
    return res.status(500).json({ error: "Failed to load activity" });
  }
}
