import React, { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const getInitial = (user) => {
  return (user?.name || user?.username || "U")
    .slice(0, 1)
    .toUpperCase();
};

export default function WorkspaceNavbar({ user }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  return (
    <nav className="workspace-navbar">
      <div className="workspace-navbar-brand">
        <strong>Flowbase</strong>
      </div>

      <div className="workspace-navbar-right">
        <div className="workspace-profile-wrap">
          <button
            type="button"
            className="workspace-profile"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <span className="workspace-avatar">
              {getInitial(user)}
            </span>

            <span className="workspace-profile-name">
              {user?.name || user?.username || "User"}
            </span>

            <ChevronDown
              size={16}
              className={
                profileOpen
                  ? "profile-chevron open"
                  : "profile-chevron"
              }
            />
          </button>

          {profileOpen && (
            <>
              <button
                type="button"
                className="profile-backdrop"
                aria-label="Close profile menu"
                onClick={() => setProfileOpen(false)}
              />

              <div
                className="workspace-profile-menu"
                role="menu"
              >
                <div className="profile-menu-user">
                  <span className="workspace-avatar large">
                    {getInitial(user)}
                  </span>

                  <div>
                    <strong>
                      {user?.name || user?.username || "User"}
                    </strong>

                    <span>
                      @{user?.username || "user"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="profile-logout"
                  onClick={handleLogout}
                  role="menuitem"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}