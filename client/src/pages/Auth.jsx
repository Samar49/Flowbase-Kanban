import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Auth({ mode = "login" }) {
  const [signup, setSignup] = useState(mode === "signup");

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, signup: register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      if (signup) {
        await register({
          name: form.name,
          username: form.username,
          email: form.email,
          password: form.password,
        });
      } else {
        await login({ email: form.email, password: form.password });
      }

      navigate("/");
    } catch (err) {
      console.error("Authentication error:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setSignup((current) => !current);
    setError("");

    setForm({
      name: "",
      username: "",
      email: "",
      password: "",
    });
  };

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand big">Flowbase</div>

        <h1>{signup ? "Create account" : "Welcome back"}</h1>
        <p>{signup ? "Build with your team." : "Continue your projects."}</p>

        {signup && (
          <>
            <input
              name="name"
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              required
            />

            <input
              name="username"
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
          </>
        )}

        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          required
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          autoComplete={signup ? "new-password" : "current-password"}
          required
        />

        {error && <div className="error">{error}</div>}

        <button type="submit" className="save-btn" disabled={loading}>
          {loading ? "Please wait..." : signup ? "Sign up" : "Log in"}
        </button>

        <button type="button" className="link-btn" onClick={toggleMode}>
          {signup ? "Already have an account? Log in" : "Create a new account"}
        </button>
      </form>
    </div>
  );
}