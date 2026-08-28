# Kanban MERN SaaS

A production-style collaborative Kanban project evolved from the original HTML/CSS/vanilla-JS board.

## Implemented phases
1. React + Vite migration
2. Express + MongoDB backend
3. JWT authentication
4. MongoDB task persistence and REST CRUD
5. Projects + customizable columns + WIP limits
6. Activity history
7. Analytics dashboard
8. Global command palette (Ctrl/Cmd + K)
9. Socket.IO architecture and project rooms
10. Task details, subtasks, comments, assignment-ready schema, dependencies, time tracking, notifications

## Run
1. Copy `server/.env.example` to `server/.env` and fill in `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`.
2. Copy `client/.env.example` to `client/.env` if API/socket URLs differ.
3. Run `npm run install:all`.
4. Run `npm run dev`.
5. Open `http://localhost:5173`.

## Important
- MongoDB is the source of truth; localStorage is only used for theme preference.
- Socket authentication expects a JWT token in the socket handshake. For a production deployment, expose a short-lived socket token endpoint or share the authenticated cookie with server-side socket middleware.
- The original files are preserved as `legacy-index.html`, `legacy-script.js`, and `legacy-style.css` for reference.
