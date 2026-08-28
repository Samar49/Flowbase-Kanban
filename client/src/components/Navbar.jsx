import React from "react";
import {
  Bell,
  Download,
  LogOut,
  Moon,
  Sun,
  BarChart3,
  UsersRound,
  ChevronDown,
  Trash2,
} from "lucide-react";

const getInitials = (user) => {
  const name = user?.name || user?.username || "User";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

export default function Navbar({
  user,
  onLogout,
  onAnalytics,
  onTheme,
  onExport,
  onTrash,
  onNotifications,
  onCollaboration,
  dark,
  notifications = [],
  onlineUsers = [],
  progress = 0,
}) {
  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  return (
    <nav className="nav">
      <div className="brand" aria-label="Flowbase">
        <b>Flowbase</b>
      </div>

      <div
        className="nav-progress"
        aria-label="Project progress"
      >
        <span>Progress</span>

        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
          aria-label={`Project progress: ${progress}%`}
        >
          <i style={{ width: `${progress}%` }} />
        </div>

        <strong>{progress}%</strong>
      </div>

      <div className="nav-actions">
        <button
          className="icon-btn"
          type="button"
          onClick={onAnalytics}
          title="Analytics"
          aria-label="Open analytics"
        >
          <BarChart3 size={19} />
        </button>

        <button
          className="icon-btn"
          type="button"
          onClick={onTheme}
          title={
            dark
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
          aria-label={
            dark
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <button
          className="icon-btn"
          type="button"
          onClick={onExport}
          title="Export project"
          aria-label="Export project"
        >
          <Download size={19} />
        </button>

        <button
          className={`icon-btn bell${
            unreadCount > 0 ? " has-unread" : ""
          }`}
          type="button"
          onClick={onNotifications}
          title="Notifications"
          aria-label={`Notifications${
            unreadCount ? `, ${unreadCount} unread` : ""
          }`}
          aria-haspopup="dialog"
        >
          <Bell size={19} />

          {unreadCount > 0 && (
            <em>
              {unreadCount > 9 ? "9+" : unreadCount}
            </em>
          )}
        </button>

        <button
          className="icon-btn trash-nav-btn"
          type="button"
          onClick={onTrash}
          title="Trash"
          aria-label="Open Trash"
        >
          <Trash2 size={18} />
        </button>

        <button
          className="icon-btn collaboration-btn"
          type="button"
          title={`${onlineUsers.length} collaborators online`}
          aria-label={`${onlineUsers.length} collaborators online`}
          onClick={onCollaboration}
        >
          <UsersRound size={18} />

          {onlineUsers.length > 0 && (
            <span
              className="online-dot"
              aria-hidden="true"
            />
          )}
        </button>

        <div
          className="user-menu"
          title={user?.name || user?.username || "User"}
        >
          <span className="avatar">{getInitials(user)}</span>

          <span className="user-chip">
            {user?.name || user?.username || "User"}
          </span>

          <ChevronDown size={15} className="user-chevron" />
        </div>

        <button
          className="icon-btn logout-btn"
          type="button"
          onClick={onLogout}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={19} />
        </button>
      </div>
    </nav>
  );
}
