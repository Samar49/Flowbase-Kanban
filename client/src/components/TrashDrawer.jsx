import React, { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  RotateCcw,
  Trash2,
  X,
  AlertTriangle,
  Inbox,
} from "lucide-react";
import { taskApi } from "../services/api";
import { formatDate, timeAgo } from "../utils/format";

const TRASH_WINDOW_MS = 24 * 60 * 60 * 1000;

function getExpiresAt(task) {
  if (!task?.deletedAt) return null;
  return new Date(new Date(task.deletedAt).getTime() + TRASH_WINDOW_MS);
}

function getRemaining(expiresAt, now) {
  if (!expiresAt) return "Expired";
  const difference = expiresAt.getTime() - now;

  if (difference <= 0) return "Expired";

  const hours = Math.floor(difference / 3600000);
  const minutes = Math.floor((difference % 3600000) / 60000);

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${Math.max(minutes, 1)}m remaining`;
}

export default function TrashDrawer({
  projectId,
  open,
  onClose,
  onRestored,
  onToast,
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");

  const loadTrash = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError("");

      const response = await taskApi.trash(projectId);
      setTasks(response.data?.tasks || []);
    } catch (err) {
      console.error("Failed to load Trash:", err);
      setError(
        err?.response?.data?.error || "Failed to load Trash."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTrash();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, [open]);

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const expiresAt = getExpiresAt(task);
        return expiresAt && expiresAt.getTime() > now;
      }),
    [tasks, now]
  );

  const restore = async (task) => {
    if (!task?._id || workingId) return;

    try {
      setWorkingId(task._id);

      const response = await taskApi.restore(task._id);
      const restoredTask = response.data?.task;

      setTasks((current) =>
        current.filter(
          (currentTask) =>
            String(currentTask._id) !== String(task._id)
        )
      );

      onRestored?.(restoredTask);
      onToast?.(`"${task.title}" restored to the board.`);
    } catch (err) {
      console.error("Failed to restore task:", err);

      onToast?.(
        err?.response?.data?.error || "Failed to restore task.",
        "error"
      );

      await loadTrash();
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <>
      {open && (
        <div
          className="trash-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        />
      )}

      <aside
        className={`trash-drawer${open ? " is-open" : ""}`}
        aria-hidden={!open}
        aria-label="Trash"
      >
        <div className="trash-head">
          <div>
            <span className="modal-eyebrow">RECOVERY</span>
            <h2>
              <Trash2 size={20} />
              Trash
            </h2>
            <p>Deleted tasks are permanently removed after 24 hours.</p>
          </div>

          <button
            type="button"
            className="panel-close"
            onClick={onClose}
            aria-label="Close Trash"
          >
            <X size={18} />
          </button>
        </div>

        <div className="trash-window-note">
          <Clock3 size={15} />
          <span>
            Restore a task anytime during its 24-hour recovery window.
          </span>
        </div>

        <div className="trash-body">
          {loading ? (
            <div className="trash-state">
              <div className="loading-spinner" />
              <strong>Loading Trash</strong>
              <span>Checking recently deleted tasks...</span>
            </div>
          ) : error ? (
            <div className="trash-state error-state">
              <AlertTriangle size={22} />
              <strong>Unable to load Trash</strong>
              <span>{error}</span>
              <button type="button" onClick={loadTrash}>
                Try again
              </button>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="trash-state">
              <div className="trash-empty-icon">
                <Inbox size={24} />
              </div>
              <strong>Trash is empty</strong>
              <span>Deleted tasks will stay here for 24 hours.</span>
            </div>
          ) : (
            <div className="trash-list">
              {visibleTasks.map((task) => {
                const expiresAt = getExpiresAt(task);
                const busy = String(workingId) === String(task._id);

                return (
                  <article className="trash-item" key={task._id}>
                    <div className="trash-item-main">
                      <div className="trash-item-title">
                        <span className={`task-priority-badge ${task.priority}`}>
                          {task.priority}
                        </span>
                        <h3>{task.title}</h3>
                      </div>

                      {task.description && (
                        <p>{task.description}</p>
                      )}

                      <div className="trash-meta">
                        <span>Deleted {timeAgo(task.deletedAt)}</span>
                        <span>{formatDate(task.deletedAt)}</span>
                        <strong>
                          {getRemaining(expiresAt, now)}
                        </strong>
                      </div>
                    </div>

                    <div className="trash-actions">
                      <button
                        type="button"
                        className="restore-btn"
                        onClick={() => restore(task)}
                        disabled={busy}
                      >
                        <RotateCcw size={14} />
                        {busy ? "Working..." : "Restore"}
                      </button>

                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
