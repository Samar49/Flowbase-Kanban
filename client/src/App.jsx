import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";

function Guard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={<Auth />}
        />

        <Route
          path="/signup"
          element={<Auth mode="signup" />}
        />

        <Route
          path="/"
          element={
            <Guard>
              <Dashboard />
            </Guard>
          }
        />

        <Route
          path="/project/:id"
          element={
            <Guard>
              <Board />
            </Guard>
          }
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </AuthProvider>
  );
}