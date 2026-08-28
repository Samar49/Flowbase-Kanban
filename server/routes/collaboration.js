import { Router } from "express";
import * as c from "../controllers/collaboration.js";

const r = Router();

r.get("/invitations", c.listMyInvitations);
r.post("/projects/:projectId/invitations", c.inviteMember);
r.patch("/invitations/:invitationId/accept", c.acceptInvitation);
r.patch("/invitations/:invitationId/decline", c.declineInvitation);
r.get("/projects/:projectId/members", c.listProjectMembers);

export default r;
