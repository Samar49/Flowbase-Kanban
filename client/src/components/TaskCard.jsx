import React from "react";
import {
  Calendar,
  Clock3,
  GripVertical,
  Play,
  Pause,
  UserCircle,
} from "lucide-react";
import { formatDate, timeAgo } from "../utils/format";

export default function TaskCard({
  task,
  onOpen,
  onDelete,
  onTimer,
  onPointerDown,
  isDragging = false,
  isMoving = false,
}) {
  const done = Boolean(task.completedAt);

  const handlePointerDown = (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;

    const interactive = event.target.closest(
      "button, input, textarea, select, a"
    );

    if (interactive) return;

    onPointerDown?.(event, task);
  };

  return (
    <article
      className={`task pri-${task.priority}${
        isDragging ? " is-dragging" : ""
      }${isMoving ? " is-moving" : ""}`}
      onPointerDown={handlePointerDown}
      onClick={() => onOpen(task)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task);
        }
      }}
      aria-label={`Task: ${task.title}`}
    >
      <div className="task-top">
        <div className="task-id-wrap">
          <GripVertical
            className="task-drag"
            size={15}
            aria-hidden="true"
          />
          <span className="task-serial">TASK #{task.serial}</span>
        </div>

        <span className={`task-priority-badge ${task.priority}`}>
          {task.priority}
        </span>
      </div>

      <h3>{task.title}</h3>

      {task.description && <p>{task.description}</p>}

      {task.labels?.length > 0 && (
        <div className="task-labels">
          {task.labels.map((label) => (
            <span key={label} className={`task-label lbl-${label}`}>
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="task-meta">
        {task.dueDate && (
          <span
            className={
              new Date(task.dueDate) < new Date() && !done
                ? "overdue"
                : ""
            }
          >
            <Calendar size={13} />
            {formatDate(task.dueDate)}
          </span>
        )}

        {task.assignee && (
          <span>
            <UserCircle size={13} />
            {task.assignee.name}
          </span>
        )}

        {task.estimatedTime > 0 && (
          <span>
            <Clock3 size={13} />
            {Math.round(task.estimatedTime / 60)}m
          </span>
        )}
      </div>

      {task.subtasks?.length > 0 && (
        <div className="sub-progress">
          <div className="sub-progress-top">
            <span>
              {task.subtasks.filter((subtask) => subtask.completed).length}/
              {task.subtasks.length} subtasks
            </span>
            <strong>
              {Math.round(
                (task.subtasks.filter((subtask) => subtask.completed).length /
                  task.subtasks.length) *
                  100
              )}
              %
            </strong>
          </div>

          <div className="sub-progress-track">
            <i
              style={{
                width: `${
                  (task.subtasks.filter((subtask) => subtask.completed).length /
                    task.subtasks.length) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="task-footer">
        <span className="task-time">{timeAgo(task.createdAt)}</span>

        <div className="task-actions">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTimer(task);
            }}
          >
            {task.timerStartedAt ? <Pause size={14} /> : <Play size={14} />}
            {task.timerStartedAt ? "Stop" : "Timer"}
          </button>

          <button
            type="button"
            className="delete-btn"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(task);
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
