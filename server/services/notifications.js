import Notification from "../models/Notification.js";
import Project from "../models/Project.js";

/**
 * Create one notification per project member, excluding the actor,
 * and deliver the notification immediately through Socket.IO.
 */
export async function notifyProjectMembers({
  req,
  projectId,
  actorId,
  taskId = null,
  type,
  message,
  includeOwner = true,
}) {
  const project = await Project.findById(projectId).select(
    "owner members name"
  );

  if (!project) return [];

  const recipientIds = new Set(
    (includeOwner
      ? [project.owner, ...(project.members || [])]
      : [...(project.members || [])]
    )
      .filter(Boolean)
      .map((id) => String(id))
  );

  if (actorId) {
    recipientIds.delete(String(actorId));
  }

  if (!recipientIds.size) return [];

  const notifications = await Notification.insertMany(
    [...recipientIds].map((userId) => ({
      user: userId,
      project: project._id,
      task: taskId,
      type,
      message,
      read: false,
    }))
  );

  const io = req?.app?.get("io");

  if (io) {
    notifications.forEach((notification) => {
      io.to(`user:${notification.user}`).emit(
        "notification:received",
        { notification }
      );
    });
  }

  return notifications;
}
