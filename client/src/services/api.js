import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(
      "API Error:",
      error.response?.status,
      error.response?.data || error.message
    );

    return Promise.reject(error);
  }
);

// AUTH
export const authApi = {
  signup: (data) => api.post("/auth/signup", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
};

// PROJECTS
export const projectApi = {
  list: () => api.get("/projects"),

  get: (id) =>
    api.get(`/projects/${id}`),

  create: (data) =>
    api.post("/projects", data),

  update: (id, data) =>
    api.put(`/projects/${id}`, data),

  remove: (id) =>
    api.delete(`/projects/${id}`),

  addColumn: (id, data) =>
    api.post(`/projects/${id}/columns`, data),

  updateColumn: (id, columnId, data) =>
    api.put(
      `/projects/${id}/columns/${columnId}`,
      data
    ),

  removeColumn: (id, columnId) =>
    api.delete(
      `/projects/${id}/columns/${columnId}`
    ),
};

// TASKS
export const taskApi = {
  list: (projectId) =>
    api.get(`/projects/${projectId}/tasks`),

  create: (projectId, data) =>
    api.post(
      `/projects/${projectId}/tasks`,
      data
    ),

  update: (taskId, data) =>
    api.put(`/tasks/${taskId}`, data),

  move: (taskId, data) =>
    api.patch(`/tasks/${taskId}/move`, data),

  remove: (taskId) =>
    api.delete(`/tasks/${taskId}`),

  trash: (projectId) =>
    api.get(`/projects/${projectId}/trash`),

  restore: (taskId) =>
    api.patch(`/tasks/${taskId}/restore`),

  timer: (taskId) =>
    api.post(`/tasks/${taskId}/timer`),
};

// COMMENTS
export const commentApi = {
  list: (taskId) =>
    api.get(`/tasks/${taskId}/comments`),

  add: (taskId, data) =>
    api.post(`/tasks/${taskId}/comments`, data),

  update: (commentId, data) =>
    api.put(`/comments/${commentId}`, data),

  remove: (commentId) =>
    api.delete(`/comments/${commentId}`),
};

// COLLABORATION
export const collaborationApi = {
  members: (projectId) =>
    api.get(
      `/collaboration/projects/${projectId}/members`
    ),

  invite: (projectId, identifier) =>
    api.post(
      `/collaboration/projects/${projectId}/invitations`,
      { identifier }
    ),

  invitations: () =>
    api.get("/collaboration/invitations"),

  accept: (invitationId) =>
    api.patch(
      `/collaboration/invitations/${invitationId}/accept`
    ),

  decline: (invitationId) =>
    api.patch(
      `/collaboration/invitations/${invitationId}/decline`
    ),
};

// ANALYTICS
export const analyticsApi = {
  get: (projectId) =>
    api.get(`/projects/${projectId}/analytics`),
};

// ACTIVITY
export const activityApi = {
  project: (projectId) =>
    api.get(`/projects/${projectId}/activity`),

  task: (taskId) =>
    api.get(`/tasks/${taskId}/activity`),
};

// NOTIFICATIONS
export const notificationApi = {
  list: () =>
    api.get("/notifications"),

  read: (notificationId) =>
    api.patch(
      `/notifications/${notificationId}/read`
    ),

  readAll: () =>
    api.patch("/notifications/read-all"),
};