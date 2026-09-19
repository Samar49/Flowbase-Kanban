import React from "react";
import { Bell, CheckCheck, Inbox, X } from "lucide-react";
import { notificationApi } from "../services/api";
import { timeAgo } from "../utils/format";

export default function NotificationPanel({
  notifications = [],
  onClose,
  onUpdated,
}) {
  const markRead = async (notification) => {
    if (!notification?._id || notification.read) return;

    try {
      await notificationApi.read(notification._id);

      onUpdated?.((current) =>
        current.map((item) =>
          String(item._id) === String(notification._id)
            ? { ...item, read: true }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllRead = async () => {
    const unreadCount = notifications.filter(
      (notification) => !notification.read
    ).length;

    if (!unreadCount) return;

    try {
      await notificationApi.readAll();

      onUpdated?.((current) =>
        current.map((notification) => ({
          ...notification,
          read: true,
        }))
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  return (
    <div className="notification-popover" role="dialog" aria-label="Notifications">
      <div className="notification-head">
        <div>
          <span className="modal-eyebrow">ACTIVITY</span>
          <h2>Notifications</h2>
          <p>
            {notifications.length
              ? "Updates from your projects."
              : "You're all caught up."}
          </p>
        </div>

        <button
          type="button"
          className="panel-close"
          onClick={onClose}
          aria-label="Close notifications"
        >
          <X size={17} />
        </button>
      </div>
      {notifications.some((notification) => !notification.read) && (
        <button
          type="button"
          className="mark-all-btn"
          onClick={markAllRead}
        >
          <CheckCheck size={15} />
          Mark all as read
        </button>
      )}
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <div className="notification-empty-icon">
              <Inbox size={22} />
            </div>
            <strong>No notifications</strong>
            <span>New assignments and project updates will appear here.</span>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              type="button"
              className={`notification-item${
                notification.read ? "" : " unread"
              }`}
              key={notification._id}
              onClick={() => markRead(notification)}
            >
              <span className="notification-icon">
                <Bell size={16} />
              </span>
              <span className="notification-copy">
                <strong>{notification.message || "Project update"}</strong>
                <small>
                  {notification.project?.name
                    ? `${notification.project.name} · `
                    : ""}
                  {timeAgo(notification.createdAt)}
                </small>
              </span>
              {!notification.read && (
                <span className="notification-unread-dot" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
