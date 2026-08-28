import Notification from "../models/Notification.js";

export async function listNotifications(req, res) {
  try {
    const notifications = await Notification.find({
      user: req.user._id,
    })
      .populate("task", "title")
      .populate("project", "name")
      .sort("-createdAt")
      .limit(100);

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    return res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Failed to load notifications:", error);
    return res.status(500).json({
      error: "Failed to load notifications",
    });
  }
}

export async function unreadNotifications(req, res) {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    return res.json({ unreadCount });
  } catch (error) {
    console.error("Failed to count notifications:", error);
    return res.status(500).json({
      error: "Failed to count notifications",
    });
  }
}

export async function readNotification(req, res) {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found",
      });
    }

    return res.json({ notification });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return res.status(500).json({
      error: "Failed to update notification",
    });
  }
}

export async function readAllNotifications(req, res) {
  try {
    await Notification.updateMany(
      {
        user: req.user._id,
        read: false,
      },
      {
        $set: { read: true },
      }
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return res.status(500).json({
      error: "Failed to update notifications",
    });
  }
}
