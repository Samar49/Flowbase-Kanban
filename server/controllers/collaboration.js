import Invitation from "../models/Invitation.js";
import Notification from "../models/Notification.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { getProjectForUser } from "../services/access.js";
import { notifyProjectMembers } from "../services/notifications.js";

const userProjection = "name username email avatar";

function emitToUser(req, userId, event, data) {
  req.app.get("io")?.to(`user:${userId}`).emit(event, data);
}

function emitToProject(req, projectId, event, data) {
  req.app.get("io")?.to(`project:${projectId}`).emit(event, data);
}

export async function listProjectMembers(req, res) {
  const project = await getProjectForUser(req.params.projectId, req.user._id);

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const members = await User.find({
    _id: { $in: project.members },
  }).select(userProjection);

  return res.json({ members });
}

export async function listMyInvitations(req, res) {
  const invitations = await Invitation.find({
    invitee: req.user._id,
    status: "pending",
  })
    .populate("project", "name description")
    .populate("inviter", userProjection)
    .sort("-createdAt");

  return res.json({ invitations });
}

export async function inviteMember(req, res) {
  const project = await getProjectForUser(req.params.projectId, req.user._id);

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const identifier = String(
    req.body.identifier || req.body.username || req.body.email || ""
  )
    .trim()
    .toLowerCase();

  if (!identifier) {
    return res.status(400).json({ error: "Enter a username or email address." });
  }

  const invitee = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  }).select(userProjection);

  if (!invitee) {
    return res.status(404).json({ error: "No user found with that username or email." });
  }

  if (String(invitee._id) === String(req.user._id)) {
    return res.status(400).json({ error: "You are already in this project." });
  }

  const isMember = project.members.some(
    (memberId) => String(memberId) === String(invitee._id)
  );

  if (isMember) {
    return res.status(400).json({ error: "That user is already a project member." });
  }

  const existing = await Invitation.findOne({
    project: project._id,
    invitee: invitee._id,
    status: "pending",
  });

  if (existing) {
    return res.status(409).json({ error: "An invitation is already pending for this user." });
  }

  const invitation = await Invitation.create({
    project: project._id,
    inviter: req.user._id,
    invitee: invitee._id,
  });

  const populated = await invitation.populate([
    { path: "project", select: "name description" },
    { path: "inviter", select: userProjection },
    { path: "invitee", select: userProjection },
  ]);

  const notification = await Notification.create({
    user: invitee._id,
    project: project._id,
    type: "PROJECT_INVITATION",
    message: `${req.user.name || req.user.username} invited you to ${project.name}`,
  });

  emitToUser(req, invitee._id, "invitation:received", {
    invitation: populated,
    notification,
  });

  return res.status(201).json({ invitation: populated });
}

export async function acceptInvitation(req, res) {
  const invitation = await Invitation.findOne({
    _id: req.params.invitationId,
    invitee: req.user._id,
    status: "pending",
  }).populate("project", "name description owner members columns workspace");

  if (!invitation) {
    return res.status(404).json({ error: "Invitation not found or already handled." });
  }

  const project = await Project.findById(invitation.project._id);

  if (!project) {
    invitation.status = "declined";
    invitation.respondedAt = new Date();
    await invitation.save();
    return res.status(404).json({ error: "Project no longer exists." });
  }

  if (!project.members.some((memberId) => String(memberId) === String(req.user._id))) {
    project.members.push(req.user._id);
    await project.save();
  }

  invitation.status = "accepted";
  invitation.respondedAt = new Date();
  await invitation.save();

  const member = await User.findById(req.user._id).select(userProjection);

  await notifyProjectMembers({
    req,
    projectId: project._id,
    actorId: req.user._id,
    type: "PROJECT_MEMBER_JOINED",
    message: `${req.user.name || req.user.username} joined ${project.name}`,
  });

  emitToProject(req, project._id, "project:member:joined", {
    member,
    projectId: project._id,
  });

  emitToUser(req, project.owner, "project:member:joined", {
    member,
    projectId: project._id,
  });

  emitToUser(req, req.user._id, "invitation:updated", {
    invitationId: invitation._id,
    status: "accepted",
    projectId: project._id,
  });

  return res.json({
    ok: true,
    invitation,
    project,
  });
}

export async function declineInvitation(req, res) {
  const invitation = await Invitation.findOne({
    _id: req.params.invitationId,
    invitee: req.user._id,
    status: "pending",
  }).populate("project", "name");

  if (!invitation) {
    return res.status(404).json({ error: "Invitation not found or already handled." });
  }

  invitation.status = "declined";
  invitation.respondedAt = new Date();
  await invitation.save();

  emitToUser(req, invitation.inviter, "invitation:updated", {
    invitationId: invitation._id,
    status: "declined",
    projectId: invitation.project?._id,
  });

  return res.json({ ok: true, invitation });
}
