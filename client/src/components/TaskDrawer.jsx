import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Save,
  Plus,
  Trash2,
  CalendarDays,
  Flag,
  MessageCircle,
  History,
  CheckCircle2,
} from "lucide-react";

import { activityApi, commentApi, taskApi } from "../services/api";
import { timeAgo } from "../utils/format";

export default function TaskDrawer({
  task,
  project,
  onClose,
  onSaved,
  socket,
  currentUser,
  typingUserIds = [],
  realtimeCommentEvent,
  onConflict,
}) {
  const [form, setForm] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  const [error, setError] = useState("");
  const [conflictTask, setConflictTask] = useState(null);

  const dirtyRef = useRef(false);
  const typingTimerRef = useRef(null);
  const baseUpdatedAtRef = useRef(null);

  useEffect(() => {
    if (!task) {
      setForm(null);
      return;
    }

    const isSameTask = form && String(form._id) === String(task._id);

    if (!isSameTask || !dirtyRef.current) {
      setForm({
        ...task,
        description: task.description || "",
        labels: task.labels || [],
        subtasks: task.subtasks || [],
      });

      baseUpdatedAtRef.current = task.updatedAt;
      dirtyRef.current = false;
      setConflictTask(null);
    } else if (String(task.updatedAt || "") !== String(baseUpdatedAtRef.current || "")) {
      setConflictTask(task);
    }

    const loadDetails = async () => {
      try {
        setLoading(true);
        setError("");

        const [commentsResponse, activitiesResponse] = await Promise.all([
          commentApi.list(task._id),
          activityApi.task(task._id),
        ]);

        setComments(commentsResponse.data.comments || []);
        setActivities(activitiesResponse.data.activities || []);
      } catch (err) {
        console.error("Failed to load task details:", err);
        setError(err?.response?.data?.error || "Failed to load task details.");
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [task]);

  useEffect(() => {
    if (!realtimeCommentEvent || !task?._id) {
      return;
    }

    if (String(realtimeCommentEvent.taskId) !== String(task._id)) {
      return;
    }

    if (String(realtimeCommentEvent.actorId) === String(currentUser?._id)) {
      return;
    }

    if (realtimeCommentEvent.type === "added" && realtimeCommentEvent.comment) {
      setComments((current) =>
        current.some((item) => String(item._id) === String(realtimeCommentEvent.comment._id))
          ? current
          : [...current, realtimeCommentEvent.comment]
      );
    }

    if (realtimeCommentEvent.type === "updated" && realtimeCommentEvent.comment) {
      setComments((current) =>
        current.map((item) =>
          String(item._id) === String(realtimeCommentEvent.comment._id)
            ? realtimeCommentEvent.comment
            : item
        )
      );
    }

    if (realtimeCommentEvent.type === "deleted" && realtimeCommentEvent.commentId) {
      setComments((current) =>
        current.filter((item) => String(item._id) !== String(realtimeCommentEvent.commentId))
      );
    }
  }, [realtimeCommentEvent, task?._id, currentUser?._id]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const updateField = (field, value) => {
    dirtyRef.current = true;

    setForm((current) => ({ ...current, [field]: value }));

    if (socket && task?._id && project?._id && (field === "title" || field === "description")) {
      socket.emit("task:typing", {
        projectId: project._id,
        taskId: task._id,
        isTyping: true,
      });

      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = window.setTimeout(() => {
        socket.emit("task:typing", {
          projectId: project._id,
          taskId: task._id,
          isTyping: false,
        });
      }, 900);
    }
  };

  const save = async () => {
    if (!form || saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await taskApi.update(task._id, {
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate || null,
        labels: form.labels,
        assignee: form.assignee?._id || form.assignee || null,
        estimatedTime: form.estimatedTime || 0,
        subtasks: form.subtasks,
        baseUpdatedAt: baseUpdatedAtRef.current,
      });

      if (response.data.task) {
        onSaved(response.data.task);
        baseUpdatedAtRef.current = response.data.task.updatedAt;
      }

      dirtyRef.current = false;
      setConflictTask(null);
      onClose();
    } catch (err) {
      console.error("Failed to save task:", err);

      if (err?.response?.status === 409 && err?.response?.data?.task) {
        setConflictTask(err.response.data.task);
        onConflict?.(err.response.data.task);
        setError(
          "This task was changed by another collaborator. Your unsaved edits were kept here; review the latest version before trying again."
        );
      } else {
        setError(err?.response?.data?.error || "Failed to save task.");
      }
    } finally {
      setSaving(false);
    }
  };

  const addSubtask = () => {
    setForm((current) => ({
      ...current,
      subtasks: [...(current.subtasks || []), { title: "New subtask", completed: false }],
    }));
  };

  const updateSubtask = (index, changes) => {
    setForm((current) => {
      const subtasks = [...(current.subtasks || [])];
      subtasks[index] = { ...subtasks[index], ...changes };
      return { ...current, subtasks };
    });
  };

  const deleteSubtask = (index) => {
    setForm((current) => ({
      ...current,
      subtasks: current.subtasks.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const addComment = async () => {
    const body = comment.trim();

    if (!body || commentLoading) {
      return;
    }

    try {
      setCommentLoading(true);
      setError("");

      const response = await commentApi.add(task._id, { body });

      if (response.data.comment) {
        setComments((current) => [...current, response.data.comment]);
      }

      setComment("");
    } catch (err) {
      console.error("Failed to add comment:", err);
      setError(err?.response?.data?.error || "Failed to add comment.");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleCommentKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addComment();
    }
  };

  // TASK_MOVED is handled separately so we can display the original and destination columns.
  const renderActivityMessage = (activity) => {
    const userName = activity.user?.name || activity.user?.username || "Someone";
    const action = activity.action?.toUpperCase();

    if (action === "TASK_MOVED") {
      const taskTitle = activity.metadata?.title || task?.title || "task";
      const fromColumn = activity.metadata?.fromColumn || "previous column";
      const toColumn = activity.metadata?.toColumn || "new column";

      return (
        <>
          <b>{userName}</b> moved <strong>"{taskTitle}"</strong> from <strong>{fromColumn}</strong> →{" "}
          <strong>{toColumn}</strong>
        </>
      );
    }

    return (
      <>
        <b>{userName}</b> {activity.action?.toLowerCase().replaceAll("_", " ")}
      </>
    );
  };

  if (!task || !form) {
    return null;
  }

  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} />

      <aside className="drawer" aria-label="Task details">
        <div className="drawer-head">
          <div>
            <span className="drawer-eyebrow">TASK DETAILS</span>
            <strong>{form.title || "Untitled task"}</strong>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close task details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          {conflictTask && (
            <div className="drawer-conflict" role="alert">
              <strong>Someone else changed this task.</strong>
              <span>The latest server version is available. Review your edits before saving again.</span>

              <button
                type="button"
                onClick={() => {
                  setForm({
                    ...conflictTask,
                    description: conflictTask.description || "",
                    labels: conflictTask.labels || [],
                    subtasks: conflictTask.subtasks || [],
                  });

                  baseUpdatedAtRef.current = conflictTask.updatedAt;
                  dirtyRef.current = false;
                  setConflictTask(null);
                  setError("");
                }}
              >
                Use latest version
              </button>
            </div>
          )}

          {typingUserIds.length > 0 && (
            <div className="typing-indicator">
              <span className="typing-dots">
                <i />
                <i />
                <i />
              </span>
              Someone is editing this task...
            </div>
          )}

          <section className="drawer-section drawer-main">
            <label className="drawer-label" htmlFor="drawer-title">
              Task title
            </label>

            <input
              id="drawer-title"
              className="drawer-title"
              value={form.title || ""}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Task title"
            />

            <label className="drawer-label" htmlFor="drawer-description">
              Description
            </label>

            <textarea
              id="drawer-description"
              value={form.description || ""}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Description..."
            />
          </section>

          <section className="drawer-section">
            <div className="drawer-grid">
              <label>
                <span>
                  <Flag size={13} />
                  Priority
                </span>

                <select
                  value={form.priority || "medium"}
                  onChange={(event) => updateField("priority", event.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label>
                <span>
                  <CalendarDays size={13} />
                  Due date
                </span>

                <input
                  type="date"
                  value={form.dueDate ? new Date(form.dueDate).toISOString().slice(0, 10) : ""}
                  onChange={(event) => updateField("dueDate", event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-title">
              <div className="section-title-main">
                <CheckCircle2 size={16} />
                <b>Subtasks</b>
              </div>

              <button type="button" onClick={addSubtask}>
                <Plus size={14} />
                Add
              </button>
            </div>

            {form.subtasks?.length ? (
              <div className="subtask-list">
                {form.subtasks.map((subtask, index) => (
                  <div className="sub-row" key={index}>
                    <input
                      type="checkbox"
                      checked={Boolean(subtask.completed)}
                      onChange={(event) => updateSubtask(index, { completed: event.target.checked })}
                      aria-label={`Complete subtask ${index + 1}`}
                    />

                    <input
                      value={subtask.title || ""}
                      onChange={(event) => updateSubtask(index, { title: event.target.value })}
                      aria-label={`Subtask ${index + 1} title`}
                    />

                    <button
                      type="button"
                      onClick={() => deleteSubtask(index)}
                      title="Delete subtask"
                      aria-label={`Delete subtask ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="drawer-empty">
                <CheckCircle2 size={17} />
                <span>No subtasks yet.</span>
              </div>
            )}
          </section>

          <section className="drawer-section">
            <div className="section-title">
              <div className="section-title-main">
                <MessageCircle size={16} />
                <b>Comments</b>
              </div>

              <span className="section-count">{comments.length}</span>
            </div>

            {loading ? (
              <div className="drawer-loading">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="drawer-empty">
                <MessageCircle size={17} />
                <span>No comments yet.</span>
              </div>
            ) : (
              <div className="comments">
                {comments.map((currentComment) => (
                  <div className="comment" key={currentComment._id}>
                    <div className="comment-head">
                      <strong>
                        {currentComment.user?.name || currentComment.user?.username || "User"}
                      </strong>
                      <span>{timeAgo(currentComment.createdAt)}</span>
                    </div>

                    <p>{currentComment.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="comment-box">
              <input
                value={comment}
                onChange={(event) => {
                  const value = event.target.value;
                  setComment(value);

                  if (socket && project?._id && task?._id) {
                    socket.emit("task:typing", {
                      projectId: project._id,
                      taskId: task._id,
                      isTyping: Boolean(value.trim()),
                    });

                    if (typingTimerRef.current) {
                      window.clearTimeout(typingTimerRef.current);
                    }

                    typingTimerRef.current = window.setTimeout(() => {
                      socket.emit("task:typing", {
                        projectId: project._id,
                        taskId: task._id,
                        isTyping: false,
                      });
                    }, 900);
                  }
                }}
                onKeyDown={handleCommentKeyDown}
                placeholder="Write a comment..."
                disabled={commentLoading}
              />

              <button type="button" onClick={addComment} disabled={commentLoading || !comment.trim()}>
                {commentLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-title">
              <div className="section-title-main">
                <History size={16} />
                <b>Activity History</b>
              </div>

              <span className="section-count">{activities.length}</span>
            </div>

            {loading ? (
              <div className="drawer-loading">Loading activity...</div>
            ) : activities.length === 0 ? (
              <div className="drawer-empty">
                <History size={17} />
                <span>No activity yet.</span>
              </div>
            ) : (
              <div className="activity-list">
                {activities.slice(0, 30).map((activity) => (
                  <div className="activity" key={activity._id}>
                    <span>{timeAgo(activity.timestamp)}</span>
                    <p>{renderActivityMessage(activity)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="drawer-foot">
          <button className="save-btn" onClick={save} disabled={saving} type="button">
            <Save size={16} />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </aside>
    </div>
  );
}