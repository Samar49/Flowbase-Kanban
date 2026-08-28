import React, { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export default function DeleteProjectModal({
  project,
  open,
  deleting = false,
  onClose,
  onConfirm,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    cancelRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !deleting) {
        onClose?.();
      }

      if (event.key === "Enter" && !deleting) {
        onConfirm?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, deleting, onClose, onConfirm]);

  if (!open || !project) return null;

  return (
    <div
      className="modal-overlay confirm-overlay project-delete-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          onClose?.();
        }
      }}
    >
      <section
        className="confirm-modal project-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        aria-describedby="delete-project-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon danger">
          <AlertTriangle size={23} />
        </div>

        <div className="confirm-content">
          <div className="confirm-header">
            <div>
              <span className="modal-eyebrow">REMOVE PROJECT</span>
              <h2 id="delete-project-title">Delete this project?</h2>
            </div>

            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              disabled={deleting}
              aria-label="Close project deletion dialog"
            >
              <X size={19} />
            </button>
          </div>

          <p id="delete-project-description" className="confirm-description">
            <strong>{project.name}</strong> and all of its tasks, comments,
            activity history, invitations, and notifications will be permanently
            removed. This cannot be undone.
          </p>

          <div className="confirm-notice project-delete-notice">
            <Trash2 size={16} />
            <span>Only the project owner can perform this action.</span>
          </div>

          <div className="confirm-actions">
            <button
              ref={cancelRef}
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={deleting}
            >
              Keep project
            </button>

            <button
              type="button"
              className="danger-btn"
              onClick={onConfirm}
              disabled={deleting}
            >
              <Trash2 size={16} />
              {deleting ? "Deleting..." : "Delete project"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
