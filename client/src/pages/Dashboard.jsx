import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderKanban, Trash2 } from "lucide-react";

import InvitationInbox from "../components/InvitationInbox";
import DeleteProjectModal from "../components/DeleteProjectModal";
import WorkspaceNavbar from "../components/WorkspaceNavbar";

import { useAuth } from "../context/AuthContext";
import { projectApi } from "../services/api";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const navigate = useNavigate();
  const { user } = useAuth();


  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await projectApi.list();

        setProjects(response.data.projects || []);
      } catch (err) {
        console.error("Failed to load projects:", err);

        setError(
          err?.response?.data?.error ||
            "Failed to load projects."
        );
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const createProject = async () => {
    const projectName = name.trim();

    if (!projectName || creating) {
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response = await projectApi.create({
        name: projectName,
      });

      const project = response.data.project;

      if (!project?._id) {
        throw new Error(
          "Project was not created correctly."
        );
      }

      setName("");

      navigate(`/project/${project._id}`);
    } catch (err) {
      console.error(
        "Failed to create project:",
        err
      );

      setError(
        err?.response?.data?.error ||
          "Failed to create project."
      );
    } finally {
      setCreating(false);
    }
  };

  // DELETE PROJECT
 
  const deleteProject = async () => {
    if (!deleteTarget?._id || deletingId) {
      return;
    }

    try {
      setDeletingId(deleteTarget._id);
      setError("");

      await projectApi.remove(deleteTarget._id);

      setProjects((currentProjects) =>
        currentProjects.filter(
          (project) =>
            String(project._id) !==
            String(deleteTarget._id)
        )
      );

      setDeleteTarget(null);
    } catch (err) {
      console.error(
        "Failed to delete project:",
        err
      );

      setError(
        err?.response?.data?.error ||
          "Failed to delete project."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ENTER KEY
  
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      createProject();
    }
  };

  // OPEN PROJECT
  
  const openProject = (projectId) => {
    if (!projectId) {
      return;
    }

    navigate(`/project/${projectId}`);
  };

  // RENDER
  
  return (
    <>
      {/* TOP NAVBAR */}

      <WorkspaceNavbar user={user} />

      {/* WORKSPACE PAGE */}

      <div className="page dashboard">

        {/*  PAGE HEADER */}

        <div className="page-head">

          {/* Workspace title */}

          <div className="workspace-heading">
            <div>
              <h1>Workspace</h1>

              <p>
                Your projects and team workspaces.
              </p>
            </div>
          </div>

          {/* CREATE PROJECT */}

          <div className="create-project">
            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="New project name"
              disabled={creating}
            />

            <button
              type="button"
              onClick={createProject}
              disabled={
                !name.trim() || creating
              }
            >
              <Plus size={16} />

              {creating
                ? "Creating..."
                : "Create"}
            </button>
          </div>
        </div>

        {/* INVITATIONS */}

        <InvitationInbox
          onOpenProject={openProject}
        />

        {/* ERROR MESSAGE */}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {/* PROJECT CONTENT */}

        {loading ? (

          /* Loading */

          <div className="loading">
            Loading projects...
          </div>

        ) : projects.length === 0 ? (

          /* Empty state */

          <div className="empty-state">
            <FolderKanban size={32} />

            <h3>No projects yet</h3>

            <p>
              Create your first project to get
              started.
            </p>
          </div>

        ) : (

          /* Project grid */

          <div className="project-grid">

            {projects.map((project) => {

              const ownerId =
                project.owner?._id ||
                project.owner;

              const isOwner =
                String(ownerId) ===
                String(user?._id);

              return (
                <article
                  className="project-card"
                  key={project._id}
                >

                  {/* PROJECT CARD */}

                  <button
                    type="button"
                    className="project-card-main"
                    onClick={() =>
                      openProject(
                        project._id
                      )
                    }
                    aria-label={`Open ${project.name}`}
                  >
                    <FolderKanban />

                    <h3>
                      {project.name}
                    </h3>

                    <span>
                      {project.description ||
                        "Collaborative Flowbase project"}
                    </span>

                    <small>
                      3 columns
                    </small>
                  </button>

                  {/* DELETE PROJECT */}

                  {isOwner && (
                    <button
                      type="button"
                      className="project-delete-btn"
                      onClick={() =>
                        setDeleteTarget(
                          project
                        )
                      }
                      title={`Delete ${project.name}`}
                      aria-label={`Delete ${project.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/*DELETE PROJECT MODAL */}

        <DeleteProjectModal
          project={deleteTarget}
          open={Boolean(deleteTarget)}
          deleting={Boolean(deletingId)}
          onClose={() => {
            if (!deletingId) {
              setDeleteTarget(null);
            }
          }}
          onConfirm={deleteProject}
        />
      </div>
    </>
  );
}