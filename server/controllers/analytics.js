import Task from "../models/Task.js";
import { getProjectForUser } from "../services/access.js";

export async function analytics(req, res) {
  try {
    const project = await getProjectForUser(
      req.params.projectId,
      req.user._id
    );

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const tasks = await Task.find({
      project: project._id,
      deletedAt: null,
    }).lean();

    const total = tasks.length;

    const doneColumn = project.columns.find(
      (column) =>
        String(column.name || "").trim().toLowerCase() === "done"
    );

    const inProgressColumn = project.columns.find(
      (column) =>
        String(column.name || "").trim().toLowerCase() === "in progress"
    );

    const todoColumn = project.columns.find(
      (column) =>
        String(column.name || "").trim().toLowerCase() === "to do"
    );

    const completed = doneColumn
      ? tasks.filter(
          (task) => String(task.column) === String(doneColumn._id)
        ).length
      : tasks.filter((task) => task.completedAt).length;

    const now = new Date();

    const overdue = tasks.filter(
      (task) =>
        task.dueDate &&
        new Date(task.dueDate) < now &&
        !task.completedAt &&
        (!doneColumn || String(task.column) !== String(doneColumn._id))
    ).length;

    const byStatus = project.columns.map((column) => ({
      name: column.name,
      value: tasks.filter(
        (task) => String(task.column) === String(column._id)
      ).length,
    }));

    const byPriority = ["low", "medium", "high"].map((priority) => ({
      name: priority,
      value: tasks.filter((task) => task.priority === priority).length,
    }));

    const byLabel = {};

    tasks.forEach((task) => {
      (task.labels || []).forEach((label) => {
        byLabel[label] = (byLabel[label] || 0) + 1;
      });
    });

    const days = [];

    for (let i = 13; i >= 0; i -= 1) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      days.push({
        date: start.toISOString().slice(0, 10),
        created: tasks.filter(
          (task) =>
            new Date(task.createdAt) >= start &&
            new Date(task.createdAt) < end
        ).length,
        completed: tasks.filter(
          (task) =>
            task.completedAt &&
            new Date(task.completedAt) >= start &&
            new Date(task.completedAt) < end
        ).length,
      });
    }

    const completedTimes = tasks
      .filter((task) => task.completedAt)
      .map(
        (task) =>
          new Date(task.completedAt).getTime() -
          new Date(task.createdAt).getTime()
      );

    const averageCompletionHours = completedTimes.length
      ? Math.round(
          (completedTimes.reduce((sum, value) => sum + value, 0) /
            completedTimes.length /
            3600000) *
            10
        ) / 10
      : 0;

    return res.json({
      overview: {
        total,
        completed,
        inProgress: inProgressColumn
          ? tasks.filter(
              (task) =>
                String(task.column) === String(inProgressColumn._id)
            ).length
          : 0,
        todo: todoColumn
          ? tasks.filter(
              (task) =>
                String(task.column) === String(todoColumn._id)
            ).length
          : 0,
        overdue,
        completionPercentage: total
          ? Math.round((completed / total) * 100)
          : 0,
        averageCompletionHours,
      },
      byStatus,
      byPriority,
      byLabel: Object.entries(byLabel).map(([name, value]) => ({
        name,
        value,
      })),
      trend: days,
    });
  } catch (error) {
    console.error("Failed to load analytics:", error);
    return res.status(500).json({
      error: "Failed to load analytics",
    });
  }
}
