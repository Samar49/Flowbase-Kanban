import React, { useEffect, useState } from "react";
import { Check, MailPlus, X } from "lucide-react";
import { collaborationApi } from "../services/api";

export default function InvitationInbox({ onOpenProject }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const response = await collaborationApi.invitations();
      setInvitations(response.data.invitations || []);
    } catch (error) {
      console.error("Failed to load invitations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const respond = async (invitation, action) => {
    try {
      setBusyId(invitation._id);
      const response = await collaborationApi[action](invitation._id);
      setInvitations((current) => current.filter((item) => item._id !== invitation._id));
      if (action === "accept") onOpenProject?.(response.data.project?._id);
    } catch (error) {
      console.error(`Failed to ${action} invitation:`, error);
    } finally {
      setBusyId(null);
    }
  };

  if (loading || invitations.length === 0) return null;

  return (
    <section className="dashboard-invitations" aria-label="Project invitations">
      <div className="dashboard-invitations-head">
        <div>
          <span className="modal-eyebrow">TEAM INVITES</span>
          <h2>Project invitations</h2>
          <p>You have {invitations.length} pending invitation{invitations.length === 1 ? "" : "s"}.</p>
        </div>
        <MailPlus size={21} />
      </div>
      <div className="dashboard-invitation-list">
        {invitations.map((invitation) => (
          <div className="dashboard-invitation" key={invitation._id}>
            <div>
              <strong>{invitation.project?.name}</strong>
              <span>{invitation.inviter?.name || invitation.inviter?.username} invited you to collaborate.</span>
            </div>
            <div className="dashboard-invitation-actions">
              <button type="button" onClick={() => respond(invitation, "accept")} disabled={busyId === invitation._id}>
                <Check size={14} /> Accept
              </button>
              <button type="button" className="secondary" onClick={() => respond(invitation, "decline")} disabled={busyId === invitation._id}>
                <X size={14} /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
