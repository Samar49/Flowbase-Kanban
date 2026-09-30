import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export function useSocket(projectId, handlers = {}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!projectId) return undefined;

    const nextSocket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      withCredentials: true,
    });

    socketRef.current = nextSocket;

    const eventNames = [
      "task:created",
      "task:updated",
      "task:moved",
      "task:deleted",
      "task:restored",
      "column:changed",
      "project:updated",
      "project:member:joined",
      "presence:snapshot",
      "presence:joined",
      "presence:left",
      "task:typing",
      "comment:added",
      "comment:updated",
      "comment:deleted",
      "invitation:received",
      "invitation:updated",
      "notification:received",
      "project:error",
    ];

    const dispatchers = new Map();

    eventNames.forEach((eventName) => {
      const dispatcher = (...args) => {
        const handler = handlersRef.current[eventName];

        if (typeof handler === "function") {
          handler(...args);
        }
      };

      dispatchers.set(eventName, dispatcher);
      nextSocket.on(eventName, dispatcher);
    });

    nextSocket.on("connect", () => {
      setSocket(nextSocket);
      nextSocket.emit("project:join", projectId);
    });

    nextSocket.on("disconnect", () => {
      setSocket(null);
    });

    nextSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    return () => {
      nextSocket.emit("project:leave", projectId);

      dispatchers.forEach((dispatcher, eventName) => {
        nextSocket.off(eventName, dispatcher);
      });

      nextSocket.disconnect();

      if (socketRef.current === nextSocket) {
        socketRef.current = null;
      }

      setSocket(null);
    };
  }, [projectId]);

  return socket;
}