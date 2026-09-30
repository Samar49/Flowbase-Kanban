import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Search, ListTodo, Clock3, BadgeCheck, AlertTriangle } from "lucide-react";

import { projectApi, taskApi, notificationApi } from "../services/api";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../context/AuthContext";

import Navbar from "../components/Navbar";
import TaskCard from "../components/TaskCard";
import TaskDrawer from "../components/TaskDrawer";
import CommandPalette from "../components/CommandPalette";
import AnalyticsView from "../components/AnalyticsView";
import NewTaskModal from "../components/NewTaskModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import TrashDrawer from "../components/TrashDrawer";
import NotificationPanel from "../components/NotificationPanel";
import CollaborationPanel from "../components/CollaborationPanel";

const COLUMN_ORDER = ["to do", "in progress", "done"];

const getColumnMeta = (name) => {
  const normalized = String(name || "").trim().toLowerCase();

  if (normalized === "to do") {
    return { icon: ListTodo, className: "todo", label: "TO DO" };
  }

  if (normalized === "in progress") {
    return { icon: Clock3, className: "progress", label: "IN PROGRESS" };
  }

  return { icon: BadgeCheck, className: "done", label: "DONE" };
};

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem("theme") !== "light");

  const [notifications, setNotifications] = useState([]);
  const [online, setOnline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCollaboration, setShowCollaboration] = useState(false);

  const [typingUsers, setTypingUsers] = useState({});
  const [liveCommentEvent, setLiveCommentEvent] = useState(null);

  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);
  const [recentlyMovedTaskId, setRecentlyMovedTaskId] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);

  const creatingTaskRef = useRef(false);
  const toastTimerRef = useRef(null);
  const dragRef = useRef(null);
  const dragPreviewRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    creatingTaskRef.current = false;
  }, [id]);

  const showToast = (message, type = "success", action = null, duration = 2800) => {
    setToast({ message, type, action });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const loadProject = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError("");

      // Only load data required to display the board. Notifications are
      // intentionally excluded so they cannot delay the initial board render.
      const [projectResponse, taskResponse] = await Promise.all([
        projectApi.get(id),
        taskApi.list(id),
      ]);

      setProject(projectResponse?.data?.project || null);

      const loadedTasks = taskResponse?.data?.tasks || [];

      // Remove accidental duplicate tasks.
      const uniqueTasks = Array.from(
        new Map(loadedTasks.map((task) => [String(task._id), task])).values()
      );

      setTasks(uniqueTasks);

      notificationApi
        .list()
        .then((response) => {
          setNotifications(response?.data?.notifications || []);
        })
        .catch((err) => {
          console.error("Failed to load notifications:", err);
        });
    } catch (err) {
      console.error("Failed to load project:", err);
      setError(err?.response?.data?.error || "Failed to load project.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const upsertTask = (incomingTask) => {
    if (!incomingTask?._id) {
      return;
    }

    setTasks((currentTasks) => {
      const existingIndex = currentTasks.findIndex(
        (currentTask) => String(currentTask._id) === String(incomingTask._id)
      );

      if (existingIndex === -1) {
        return [...currentTasks, incomingTask];
      }

      const nextTasks = [...currentTasks];
      nextTasks[existingIndex] = { ...nextTasks[existingIndex], ...incomingTask };
      return nextTasks;
    });
  };

  const updateTask = (updatedTask) => {
    if (!updatedTask?._id) {
      return;
    }

    setTasks((currentTasks) => {
      const index = currentTasks.findIndex((task) => String(task._id) === String(updatedTask._id));

      if (index === -1) {
        return [...currentTasks, updatedTask];
      }

      const nextTasks = [...currentTasks];
      nextTasks[index] = { ...nextTasks[index], ...updatedTask };
      return nextTasks;
    });

    setSelected((currentSelected) => {
      if (!currentSelected || String(currentSelected._id) !== String(updatedTask._id)) {
        return currentSelected;
      }

      return updatedTask;
    });
  };

  const socket = useSocket(id, {
    "task:created": ({ task }) => {
      if (task) {
        upsertTask(task);
      }
    },

    "task:updated": ({ task }) => {
      if (task) {
        updateTask(task);
      }
    },

    "task:moved": ({ task }) => {
      if (task) {
        updateTask(task);
      }
    },

    "task:deleted": ({ taskId }) => {
      if (!taskId) {
        return;
      }

      setTasks((currentTasks) => currentTasks.filter((task) => String(task._id) !== String(taskId)));

      setSelected((currentSelected) => {
        if (!currentSelected || String(currentSelected._id) !== String(taskId)) {
          return currentSelected;
        }

        return null;
      });
    },

    "task:restored": ({ task }) => {
      if (task) {
        upsertTask(task);
      }
    },

    "column:changed": ({ project: nextProject }) => {
      if (nextProject) {
        setProject(nextProject);
      }
    },

    "presence:joined": ({ user: joinedUser }) => {
      if (!joinedUser?._id) {
        return;
      }

      setOnline((currentUsers) => {
        const exists = currentUsers.some(
          (onlineUser) => String(onlineUser._id) === String(joinedUser._id)
        );

        return exists ? currentUsers : [...currentUsers, joinedUser];
      });
    },

    "presence:snapshot": ({ users = [] }) => {
      setOnline(users);
    },

    "presence:left": ({ userId }) => {
      if (!userId) {
        return;
      }

      setOnline((currentUsers) =>
        currentUsers.filter((onlineUser) => String(onlineUser._id) !== String(userId))
      );
    },

    "project:member:joined": ({ member }) => {
      if (!member?._id) {
        return;
      }

      setProject((current) => {
        if (!current) {
          return current;
        }

        const currentMembers = current.members || [];

        if (currentMembers.some((item) => String(item._id || item) === String(member._id))) {
          return current;
        }

        return { ...current, members: [...currentMembers, member] };
      });
    },

    "project:updated": ({ project: nextProject }) => {
      if (nextProject) {
        setProject(nextProject);
      }
    },

    "project:deleted": ({ projectId: deletedProjectId }) => {
      if (String(deletedProjectId) !== String(id)) {
        return;
      }

      showToast("This project was deleted by its owner.", "error", null, 4000);
      window.setTimeout(() => navigate("/"), 900);
    },

    "task:typing": ({ taskId, isTyping, user: typingUser }) => {
      if (!taskId || !typingUser?._id) {
        return;
      }

      setTypingUsers((current) => {
        const next = { ...current };
        const existing = new Set(next[taskId] || []);

        if (isTyping) {
          existing.add(String(typingUser._id));
        } else {
          existing.delete(String(typingUser._id));
        }

        if (existing.size) {
          next[taskId] = [...existing];
        } else {
          delete next[taskId];
        }

        return next;
      });
    },

    "comment:added": (event) => {
      setLiveCommentEvent({ type: "added", ...event, nonce: Date.now() });
    },

    "comment:updated": (event) => {
      setLiveCommentEvent({ type: "updated", ...event, nonce: Date.now() });
    },

    "comment:deleted": (event) => {
      setLiveCommentEvent({ type: "deleted", ...event, nonce: Date.now() });
    },

    "invitation:received": ({ notification }) => {
      if (notification?._id) {
        setNotifications((current) => [
          notification,
          ...current.filter((item) => String(item._id) !== String(notification._id)),
        ]);
      }

      showToast("You received a new project invitation.");
    },

    "notification:received": ({ notification }) => {
      if (!notification?._id) {
        return;
      }

      setNotifications((current) => [
        notification,
        ...current.filter((item) => String(item._id) !== String(notification._id)),
      ]);
    },
  });

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tasks;
    }

    return tasks.filter((task) => {
      const searchableText = `
        ${task.title || ""}
        ${task.description || ""}
        ${(task.labels || []).join(" ")}
        ${task.priority || ""}
      `.toLowerCase();

      return searchableText.includes(query);
    });
  }, [tasks, search]);

  const sortedColumns = useMemo(() => {
    if (!project?.columns) {
      return [];
    }

    return COLUMN_ORDER.map((desiredName) =>
      project.columns.find(
        (column) => String(column.name || "").trim().toLowerCase() === desiredName
      )
    ).filter(Boolean);
  }, [project]);

  const progressPercentage = useMemo(() => {
    if (!tasks.length) {
      return 0;
    }

    const doneColumn = sortedColumns.find(
      (column) => String(column.name || "").trim().toLowerCase() === "done"
    );

    if (!doneColumn) {
      return 0;
    }

    const completedCount = tasks.filter(
      (task) => String(task.column) === String(doneColumn._id)
    ).length;

    return Math.round((completedCount / tasks.length) * 100);
  }, [tasks, sortedColumns]);

  const requestDeleteTask = (task) => {
    if (!task?._id) {
      return;
    }

    setDeleteTarget(task);
  };

  const closeDeleteModal = () => {
    if (deletingTask) {
      return;
    }

    setDeleteTarget(null);
  };

  const restoreTask = async (taskId, silent = false) => {
    if (!taskId) {
      return null;
    }

    try {
      const response = await taskApi.restore(taskId);
      const restoredTask = response?.data?.task;

      if (restoredTask?._id) {
        upsertTask(restoredTask);
      }

      if (!silent) {
        showToast(
          restoredTask?.title
            ? `"${restoredTask.title}" restored to the board.`
            : "Task restored to the board."
        );
      }

      return restoredTask;
    } catch (err) {
      console.error("Failed to restore task:", err);
      showToast(err?.response?.data?.error || "Failed to restore task.", "error");
      return null;
    }
  };

  const confirmDeleteTask = async () => {
    const task = deleteTarget;

    if (!task?._id || deletingTask) {
      return;
    }

    setDeletingTask(true);

    try {
      await taskApi.remove(task._id);

      setTasks((currentTasks) =>
        currentTasks.filter((existingTask) => String(existingTask._id) !== String(task._id))
      );

      setSelected((currentSelected) =>
        currentSelected && String(currentSelected._id) === String(task._id) ? null : currentSelected
      );

      setDeleteTarget(null);

      showToast(
        `"${task.title}" moved to Trash.`,
        "success",
        {
          label: "Undo",
          onClick: async () => {
            const restoredTask = await restoreTask(task._id, true);

            if (restoredTask) {
              showToast(`"${task.title}" restored to the board.`);
            }
          },
        },
        8000
      );
    } catch (err) {
      console.error("Failed to move task to Trash:", err);
      showToast(err?.response?.data?.error || "Failed to move task to Trash.", "error");
    } finally {
      setDeletingTask(false);
    }
  };

  const finishPointerDrag = (commit = false) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    if (commit && drag.started && drag.currentColumnId) {
      moveTaskById(drag.task._id, drag.currentColumnId);

      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);

    document.body.classList.remove("is-board-dragging");

    dragRef.current = null;
    dragPreviewRef.current = null;

    setDragPreview(null);
    setDraggingTaskId(null);
    setDragOverColumnId(null);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);

    if (!drag.started) {
      if (distance < 6) {
        return;
      }

      drag.started = true;
      setDraggingTaskId(drag.task._id);

      setDragPreview({
        task: drag.task,
        width: drag.width,
        x: event.clientX - drag.offsetX,
        y: event.clientY - drag.offsetY,
      });

      document.body.classList.add("is-board-dragging");
    }

    event.preventDefault();

    const x = event.clientX - drag.offsetX;
    const y = event.clientY - drag.offsetY;

    if (dragPreviewRef.current) {
      dragPreviewRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const column = element?.closest?.(".task-column");

    if (column?.dataset.columnId) {
      const nextColumnId = String(column.dataset.columnId);

      if (drag.currentColumnId !== nextColumnId) {
        drag.currentColumnId = nextColumnId;
        setDragOverColumnId(nextColumnId);
      }
    }
  };

  const handlePointerUp = () => {
    finishPointerDrag(true);
  };

  const handlePointerCancel = () => {
    finishPointerDrag(false);
  };

  const handleTaskPointerDown = (event, task) => {
    if (!task?._id || dragRef.current) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    dragRef.current = {
      task,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      started: false,
      currentColumnId: String(task.column),
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerCancel, { passive: true });
  };

  const moveTaskById = async (taskId, columnId) => {
    if (!taskId || !columnId) {
      return;
    }

    const currentTask = tasks.find((task) => String(task._id) === String(taskId));

    if (!currentTask) {
      return;
    }

    const previousColumn = currentTask.column;

    if (String(previousColumn) === String(columnId)) {
      return;
    }

    // Optimistic UI update.
    const optimisticTask = {
      ...currentTask,
      column: columnId,
      position: Date.now(),
      completedAt: undefined,
    };

    updateTask(optimisticTask);
    setRecentlyMovedTaskId(taskId);

    window.setTimeout(() => {
      setRecentlyMovedTaskId((currentId) => (String(currentId) === String(taskId) ? null : currentId));
    }, 280);

    try {
      const response = await taskApi.move(taskId, {
        column: columnId,
        position: Date.now(),
        baseUpdatedAt: currentTask.updatedAt,
      });

      if (response?.data?.task) {
        updateTask(response.data.task);
      }
    } catch (err) {
      console.error("Failed to move task:", err);

      const serverTask = err?.response?.data?.task;

      updateTask(
        serverTask || {
          ...optimisticTask,
          column: previousColumn,
          completedAt: currentTask.completedAt,
        }
      );

      showToast(
        err?.response?.data?.code === "TASK_CONFLICT"
          ? "Someone else moved this task. The latest version has been restored."
          : err?.response?.data?.error || "Failed to move task.",
        "error"
      );
    }
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      document.body.classList.remove("is-board-dragging");
    };
  }, []);

  useEffect(() => {
    if (!dragPreview || !dragPreviewRef.current) {
      return;
    }

    dragPreviewRef.current.style.transform = `translate3d(${dragPreview.x}px, ${dragPreview.y}px, 0)`;
  }, [dragPreview]);

  const createTask = async (taskData) => {
    if (creatingTaskRef.current) {
      return;
    }

    if (!project) {
      throw new Error("Project is not loaded.");
    }

    const todoColumn = sortedColumns.find(
      (column) => String(column.name || "").trim().toLowerCase() === "to do"
    );

    if (!todoColumn) {
      throw new Error("TO DO column is missing from this project.");
    }

    creatingTaskRef.current = true;

    try {
      const response = await taskApi.create(id, { ...taskData, column: todoColumn._id });
      const newTask = response?.data?.task;

      if (!newTask?._id) {
        throw new Error("Server did not return a valid task.");
      }

      upsertTask(newTask);
      setShowNewTask(false);
      showToast("Task created successfully.");

      return newTask;
    } catch (err) {
      console.error("Failed to create task:", err);
      showToast(err?.response?.data?.error || err?.message || "Failed to create task.", "error");
      throw err;
    } finally {
      creatingTaskRef.current = false;
    }
  };

  const handleTimer = async (currentTask) => {
    if (!currentTask?._id) {
      return;
    }

    try {
      const response = await taskApi.timer(currentTask._id);

      if (response?.data?.task) {
        updateTask(response.data.task);
      }
    } catch (err) {
      console.error("Timer error:", err);
      showToast(err?.response?.data?.error || "Failed to update timer.", "error");
    }
  };

  const openNotifications = async () => {
    setShowTrash(false);

    const nextOpen = !showNotifications;
    setShowNotifications(nextOpen);

    if (!nextOpen) {
      return;
    }

    try {
      const response = await notificationApi.list();
      setNotifications(response?.data?.notifications || []);
    } catch (err) {
      console.error("Failed to refresh notifications:", err);
      showToast(err?.response?.data?.error || "Failed to load notifications.", "error");
    }
  };

  const exportData = () => {
    if (!project) {
      return;
    }

    const exportObject = {
      project,
      tasks,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${project.name || "flowbase-project"}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Project exported successfully.");
  };

  if (showAnalytics) {
    return (
      <>
        <Navbar
          user={user}
          onLogout={logout}
          onAnalytics={() => setShowAnalytics(false)}
          onTheme={() => setDark((value) => !value)}
          onExport={exportData}
          onTrash={() => {
            setShowNotifications(false);
            setShowTrash(true);
          }}
          onNotifications={openNotifications}
          onCollaboration={() => setShowCollaboration((current) => !current)}
          dark={dark}
          notifications={notifications}
          onlineUsers={online}
        />

        {showNotifications && (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
            onUpdated={setNotifications}
          />
        )}

        {showCollaboration && project && (
          <CollaborationPanel
            project={project}
            onlineUsers={online}
            onClose={() => setShowCollaboration(false)}
            onToast={showToast}
            onOpenProject={(projectId) => projectId && navigate(`/project/${projectId}`)}
          />
        )}

        <AnalyticsView projectId={id} onBack={() => setShowAnalytics(false)} />
      </>
    );
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-card">
          <div className="loading-spinner" />
          <strong>Loading project</strong>
          <span>Getting your board ready...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading">
        <div className="loading-card error-card">
          <div className="loading-error-icon">!</div>
          <h2>Unable to load project</h2>
          <p>{error}</p>

          <div className="loading-actions">
            <button onClick={loadProject} type="button">
              Try Again
            </button>

            <button className="secondary-btn" onClick={() => navigate("/")} type="button">
              Back to Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="loading">
        <div className="loading-card">
          <h2>Project not found</h2>
          <p>The project you're looking for doesn't exist or you don't have access to it.</p>

          <button onClick={() => navigate("/")} type="button">
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar
        user={user}
        onLogout={logout}
        onAnalytics={() => setShowAnalytics(true)}
        onTheme={() => setDark((value) => !value)}
        onExport={exportData}
        dark={dark}
        notifications={notifications}
        onlineUsers={online}
        progress={progressPercentage}
        onTrash={() => {
          setShowNotifications(false);
          setShowTrash(true);
          setShowCollaboration(false);
        }}
        onNotifications={openNotifications}
        onCollaboration={() => {
          setShowNotifications(false);
          setShowTrash(false);
          setShowCollaboration((current) => !current);
        }}
      />

      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onUpdated={setNotifications}
        />
      )}

      {showCollaboration && (
        <CollaborationPanel
          project={project}
          onlineUsers={online}
          onClose={() => setShowCollaboration(false)}
          onToast={showToast}
          onOpenProject={(projectId) => projectId && navigate(`/project/${projectId}`)}
        />
      )}

      <main className="board-page">
        <div className="project-toolbar">
          <div className="project-info">
            <button className="back-btn" onClick={() => navigate("/")} type="button">
              ← Workspace
            </button>

            <div className="project-title-row">
              <h1>{project.name}</h1>
            </div>

            <p>{project.description || "Collaborative project board"}</p>
          </div>

          <div className="toolbar-right">
            <label className="search-box">
              <Search size={17} aria-hidden="true" />
              <input
                className="board-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
              />
            </label>

            <button className="new-board-btn" type="button" onClick={() => setShowNewTask(true)}>
              <Plus size={17} />
              New Task
            </button>
          </div>
        </div>

        <section className="board" aria-label="Flowbase board">
          {sortedColumns.map((column) => {
            const columnTasks = filteredTasks.filter(
              (task) => String(task.column) === String(column._id)
            );

            const meta = getColumnMeta(column.name);
            const ColumnIcon = meta.icon;

            return (
              <div
                className={`task-column column-${meta.className}${
                  String(dragOverColumnId) === String(column._id) ? " is-drag-over" : ""
                }`}
                key={column._id}
                data-column-id={column._id}
              >
                <div className="col-header">
                  <div className="column-heading">
                    <span className="column-icon">
                      <ColumnIcon size={19} />
                    </span>
                    <span className="col-title">{meta.label}</span>
                  </div>

                  <div className="column-header-right">
                    <span className="count-badge">{columnTasks.length}</span>
                  </div>
                </div>

                {column.wipLimit > 0 && columnTasks.length >= column.wipLimit && (
                  <div className="wip-bar">
                    <AlertTriangle size={13} />
                    WIP limit reached
                  </div>
                )}

                <div className="tasks-list">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      onOpen={(currentTask) => {
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false;
                          return;
                        }

                        setSelected(currentTask);
                      }}
                      onDelete={requestDeleteTask}
                      onTimer={handleTimer}
                      onPointerDown={handleTaskPointerDown}
                      isDragging={String(draggingTaskId) === String(task._id)}
                      isMoving={String(recentlyMovedTaskId) === String(task._id)}
                    />
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <ColumnIcon size={30} />
                      </div>

                      <strong>{search ? "No matching tasks" : "No tasks yet"}</strong>
                      <span>{search ? "Try a different search." : "Drag and drop tasks here"}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </main>

      {dragPreview && (
        <div
          ref={dragPreviewRef}
          className="drag-preview"
          aria-hidden="true"
          style={{
            width: `${dragPreview.width}px`,
            transform: `translate3d(${dragPreview.x}px, ${dragPreview.y}px, 0)`,
          }}
        >
          <TaskCard task={dragPreview.task} onOpen={() => {}} onDelete={() => {}} onTimer={() => {}} isDragging />
        </div>
      )}

      <CommandPalette
        onNewTask={() => setShowNewTask(true)}
        onAnalytics={() => setShowAnalytics(true)}
        onTheme={() => setDark((value) => !value)}
        onExport={exportData}
      />

      {selected && (
        <TaskDrawer
          task={selected}
          project={project}
          onClose={() => setSelected(null)}
          onSaved={updateTask}
          socket={socket}
          currentUser={user}
          typingUserIds={typingUsers[selected._id] || []}
          realtimeCommentEvent={liveCommentEvent}
          onConflict={(serverTask) => {
            if (serverTask) {
              updateTask(serverTask);
            }

            showToast(
              "This task changed elsewhere. Review the latest version before saving.",
              "error",
              null,
              5000
            );
          }}
        />
      )}

      <NewTaskModal open={showNewTask} onClose={() => setShowNewTask(false)} onCreate={createTask} />

      <DeleteConfirmModal
        task={deleteTarget}
        open={Boolean(deleteTarget)}
        deleting={deletingTask}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteTask}
      />

      <TrashDrawer
        projectId={id}
        open={showTrash}
        onClose={() => setShowTrash(false)}
        onRestored={(restoredTask) => {
          if (restoredTask) {
            upsertTask(restoredTask);
          }
        }}
        onToast={showToast}
      />

      {toast && (
        <div
          className={`app-toast ${toast.type || "success"}${toast.action ? " has-action" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="toast-icon">{toast.type === "error" ? "!" : "✓"}</span>
          <span className="toast-message">{toast.message}</span>

          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={async () => {
                const action = toast.action;
                setToast(null);
                await action.onClick?.();
              }}
            >
              {toast.action.label}
            </button>
          )}

          <button type="button" className="toast-dismiss" onClick={() => setToast(null)} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
    </>
  );
}