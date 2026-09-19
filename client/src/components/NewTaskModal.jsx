import React, { useEffect, useRef, useState } from "react";
import { X, Plus, CalendarDays, Flag, FileText } from "lucide-react";

export default function NewTaskModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  useEffect(() => {
    if (!open) return;
    setForm({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
    });
    setCreating(false);
    setError("");
    submittingRef.current = false;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submittingRef.current) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
    });

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }
    const title = form.title.trim();
    if (!title) {
      setError("Task title is required.");
      return;
    }
    submittingRef.current = true;
    setCreating(true);
    setError("");
    try {
      await onCreate({
        title,
        description: form.description.trim(),
        priority: form.priority,
        dueDate: form.dueDate || null,
      });

      resetForm();
      onClose();
    } catch (err) {
      console.error("Create task modal error:", err);
      setError(err?.response?.data?.error || err?.message || "Failed to create task.");
      submittingRef.current = false;
    } finally {
      setCreating(false);
    }
  };
  const handleClose = () => {
    if (submittingRef.current) {
      return;
    }

    resetForm();
    onClose();
  };

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };
  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} role="presentation">
      <div
        className="new-task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-task-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-heading">
            <div className="modal-icon">
              <Plus size={20} />
            </div>

            <div>
              <span className="modal-eyebrow">PROJECT BOARD</span>
              <h2 id="new-task-title">Create new task</h2>
              <p>Add a task to your project board.</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            disabled={creating}
            aria-label="Close create task dialog"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="task-title">
              Task title <span>*</span>
            </label>
            <input
              id="task-title"
              autoFocus
              type="text"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="e.g. Design landing page"
              maxLength={120}
              disabled={creating}
            />
            <small className="input-hint">Keep it short, clear, and action-oriented.</small>
          </div>
          <div className="form-group">
            <label htmlFor="task-description">
              <FileText size={14} />
              Description
            </label>
            <textarea
              id="task-description"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Describe what needs to be done..."
              rows={4}
              maxLength={1000}
              disabled={creating}
            />
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="task-priority">
                <Flag size={14} />
                Priority
              </label>
              <select
                id="task-priority"
                value={form.priority}
                onChange={(event) => updateField("priority", event.target.value)}
                disabled={creating}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="task-due-date">
                <CalendarDays size={14} />
                Due date
              </label>
              <input
                id="task-due-date"
                type="date"
                value={form.dueDate}
                onChange={(event) => updateField("dueDate", event.target.value)}
                disabled={creating}
              />
            </div>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={handleClose} disabled={creating}>
              Cancel
            </button>
            <button type="submit" className="create-task-btn" disabled={!form.title.trim() || creating}>
              <Plus size={17} />
              {creating ? "Creating..." : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}