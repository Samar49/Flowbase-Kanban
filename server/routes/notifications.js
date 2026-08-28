import { Router } from "express";
import {
  listNotifications,
  unreadNotifications,
  readNotification,
  readAllNotifications,
} from "../controllers/notifications.js";

const r = Router();

r.get("/", listNotifications);
r.get("/unread-count", unreadNotifications);
r.patch("/read-all", readAllNotifications);
r.patch("/:id/read", readNotification);

export default r;
