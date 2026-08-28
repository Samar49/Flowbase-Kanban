import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check whether the user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authApi.me();

        setUser(response.data.user);
      } catch (error) {
        // User is not authenticated
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login
  const login = async (data) => {
    const response = await authApi.login(data);

    setUser(response.data.user);

    return response.data;
  };

  // Signup
  const signup = async (data) => {
    const response = await authApi.signup(data);

    setUser(response.data.user);

    return response.data;
  };

  // Logout
  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}