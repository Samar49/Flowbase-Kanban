import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, UserPlus, UsersRound, X } from "lucide-react";
import { collaborationApi } from "../services/api";

export default function CollaborationPanel({
  project,
  onlineUsers = [],
  onClose,
  onMemberJoined,
  onToast,
  onOpenProject,
}) {
  const [members, setMembers] = useState(project?.members || []);
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [invitations, setInvitations] = useState([]);

  const onlineIds = useMemo(
    () => new Set(onlineUsers.map((item) => String(item._id))),
    [onlineUsers]
  );

  const load = async () => {
    if (!project?._id) return;
    try {
      setLoading(true);
      const [memberResponse, invitationResponse] = await Promise.all([
        collaborationApi.members(project._id),
        collaborationApi.invitations(),
      ]);
      setMembers(memberResponse.data.members || []);
      setInvitations(invitationResponse.data.invitations || []);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.error || "Unable to load collaboration data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [project?._id]);

  useEffect(() => {
    if (project?.members?.length) setMembers(project.members);
  }, [project?.members]);

  const invite = async () => {
    const value = identifier.trim();
    if (!value || sending) return;

    try {
      setSending(true);
      setError("");
      await collaborationApi.invite(project._id, value);
      setIdentifier("");
      onToast?.("Invitation sent successfully.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || "Unable to send invitation.");
    } finally {
      setSending(false);
    }
  };

  const copyProjectLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onToast?.("Copy failed. Share the project URL manually.", "error");
    }
  };

  const accept = async (invitation) => {
    try {
      const response = await collaborationApi.accept(invitation._id);
      setInvitations((current) => current.filter((item) => item._id !== invitation._id));
      onToast?.(`You joined ${response.data.project?.name || "the project"}.`);
      onOpenProject?.(response.data.project?._id);
    } catch (err) {
      setError(err?.response?.data?.error || "Unable to accept invitation.");
    }
  };

  const decline = async (invitation) => {
    try {
      await collaborationApi.decline(invitation._id);
      setInvitations((current) => current.filter((item) => item._id !== invitation._id));
      onToast?.("Invitation declined.");
    } catch (err) {
      setError(err?.response?.data?.error || "Unable to decline invitation.");
    }
  };

  return (
    <>
      <div className="collab-backdrop" onClick={onClose} />
      <aside className="collab-panel" role="dialog" aria-label="Project collaboration">
        <header className="collab-head">
          <div>
            <span className="modal-eyebrow">COLLABORATION</span>
            <h2>Project team</h2>
            <p>{members.length} member{members.length === 1 ? "" : "s"} · {onlineUsers.length} online</p>
          </div>
          <button className="panel-close" type="button" onClick={onClose} aria-label="Close collaboration panel">
            <X size={17} />
          </button>
        </header>

        {error && <div className="collab-error" role="alert">{error}</div>}

        <section className="collab-section">
          <div className="collab-section-title">
            <span><UsersRound size={15} /> Members</span>
            <span>{onlineUsers.length} online</span>
          </div>

          {loading ? (
            <div className="collab-loading"><Loader2 size={16} className="spin" /> Loading team...</div>
          ) : (
            <div className="member-list">
              {members.map((member) => {
                const isOnline = onlineIds.has(String(member._id));
                return (
                  <div className="member-row" key={member._id}>
                    <span className="member-avatar">{(member.name || member.username || "U").slice(0, 1).toUpperCase()}</span>
                    <span className="member-copy">
                      <strong>{member.name || member.username}</strong>
                      <small>@{member.username}</small>
                    </span>
                    <span className={`member-status ${isOnline ? "online" : "offline"}`}>
                      <i /> {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="collab-section">
          <div className="collab-section-title"><span><UserPlus size={15} /> Invite people</span></div>
          <div className="invite-row">
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && invite()}
              placeholder="Username or email"
              aria-label="Username or email"
              disabled={sending}
            />
            <button type="button" onClick={invite} disabled={!identifier.trim() || sending}>
              {sending ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />}
              Invite
            </button>
          </div>
          <button className="share-project-btn" type="button" onClick={copyProjectLink}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Link copied" : "Copy project link"}
          </button>
        </section>

        {invitations.length > 0 && (
          <section className="collab-section">
            <div className="collab-section-title"><span>Pending invitations</span><span>{invitations.length}</span></div>
            <div className="invitation-list">
              {invitations.map((invitation) => (
                <div className="invitation-row" key={invitation._id}>
                  <div>
                    <strong>{invitation.project?.name || "Project invitation"}</strong>
                    <small>{invitation.inviter?.name || invitation.inviter?.username} invited you</small>
                  </div>
                  <div className="invitation-actions">
                    <button type="button" className="accept-btn" onClick={() => accept(invitation)}><Check size={14} /> Accept</button>
                    <button type="button" className="decline-btn" onClick={() => decline(invitation)}><X size={14} /> Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </>
  );
}
