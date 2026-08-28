import React, { useEffect } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export default function DeleteConfirmModal({
  task,
  open,
  onClose,
  onConfirm,
  deleting = false,
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !deleting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, deleting]);

  if (!open || !task) {
    return null;
  }

  return (
    <div
      className="modal-overlay confirm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-task-title"
        aria-describedby="delete-task-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon danger">
          <AlertTriangle size={23} />
        </div>

        <div className="confirm-content">
          <div className="confirm-header">
            <div>
              <span className="modal-eyebrow">MOVE TO TRASH</span>
              <h2 id="delete-task-title">Delete this task?</h2>
            </div>

            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              disabled={deleting}
              aria-label="Close delete confirmation"
            >
              <X size={19} />
            </button>
          </div>

          <p id="delete-task-description" className="confirm-description">
            <strong>{task.title}</strong> will be moved to Trash. You can
            restore it within 24 hours before it is permanently deleted.
          </p>

          <div className="confirm-notice">
            <Trash2 size={16} />
            <span>
              Nothing is permanently deleted right now.
            </span>
          </div>

          <div className="confirm-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={deleting}
            >
              Keep task
            </button>

            <button
              type="button"
              className="danger-btn"
              onClick={onConfirm}
              disabled={deleting}
            >
              <Trash2 size={16} />
              {deleting ? "Moving..." : "Move to Trash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
