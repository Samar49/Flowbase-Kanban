import Project from "../models/Project.js";

/**
 * Load a project and verify the given user has access to it.
 *
 * By default this also populates `members` and `owner` with full user
 * details, which costs two extra round trips to MongoDB. Callers that
 * only need to check membership or read `project.columns` (most task
 * operations) should pass `{ populateUsers: false }` to skip that work.
 */
export async function getProjectForUser(
  id,
  userId,
  { populateUsers = true } = {}
) {
  let query = Project.findById(id);

  if (populateUsers) {
    query = query
      .populate("members", "name username email avatar")
      .populate("owner", "name username email avatar");
  }

  const project = await query;

  if (!project) return null;

  const ownerId = project.owner?._id || project.owner;

  const isMember =
    project.members.some(
      (member) => String(member._id || member) === String(userId)
    ) || String(ownerId) === String(userId);

  return isMember ? project : null;
}

export function isProjectOwner(project, userId) {
  return (
    String(project?.owner?._id || project?.owner) === String(userId)
  );
}