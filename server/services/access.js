import Project from "../models/Project.js";

export async function getProjectForUser(id, userId) {
  const project = await Project.findById(id)
    .populate("members", "name username email avatar")
    .populate("owner", "name username email avatar");

  if (!project) return null;

  const isMember =
    project.members.some(
      (member) => String(member._id || member) === String(userId)
    ) || String(project.owner?._id || project.owner) === String(userId);

  return isMember ? project : null;
}

export function isProjectOwner(project, userId) {
  return (
    String(project?.owner?._id || project?.owner) === String(userId)
  );
}
