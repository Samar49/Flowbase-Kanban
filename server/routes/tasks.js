import { Router } from "express";
import * as c from "../controllers/tasks.js";

const r = Router();

r.get("/projects/:projectId/tasks", c.listTasks);
r.get("/projects/:projectId/trash", c.listTrash);

r.post("/projects/:projectId/tasks", c.createTask);
r.put("/tasks/:taskId", c.updateTask);
r.patch("/tasks/:taskId/move", c.moveTask);

r.delete("/tasks/:taskId", c.deleteTask);
r.patch("/tasks/:taskId/restore", c.restoreTask);

r.post("/tasks/:taskId/timer", c.timer);

export default r;
