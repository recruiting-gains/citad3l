"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { Rook } from "@/components/Rook";

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type DialogState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; project: Project }
  | { kind: "delete"; project: Project };

type Toast = { id: number; text: string; tone: "ok" | "error" };

const NAME_MAX = 80;
const INSTR_MAX = 4000;

async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    if (typeof j.error === "string") return j.error;
    return j.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function relTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ProjectsView({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const close = useCallback(() => {
    if (busy) return;
    setDialog({ kind: "none" });
    setFormError(null);
  }, [busy]);

  useEffect(() => {
    if (dialog.kind === "none") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    if (dialog.kind !== "delete") window.setTimeout(() => nameRef.current?.focus(), 30);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  const openCreate = () => {
    setName("");
    setInstructions("");
    setFormError(null);
    setDialog({ kind: "create" });
  };
  const openEdit = (p: Project) => {
    setName(p.name);
    setInstructions(p.instructions);
    setFormError(null);
    setDialog({ kind: "edit", project: p });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setFormError("Give the project a name.");
      return;
    }
    if (n.length > NAME_MAX || instructions.length > INSTR_MAX) {
      setFormError("Name or instructions are too long.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (dialog.kind === "create") {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, instructions }),
        });
        if (!res.ok) throw new Error(await readError(res));
        const j = (await res.json()) as { project: Project };
        setProjects((p) => [j.project, ...p]);
        toast("Project created");
      } else if (dialog.kind === "edit") {
        const id = dialog.project.id;
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, instructions }),
        });
        if (!res.ok) throw new Error(await readError(res));
        let updated: Project = { ...dialog.project, name: n, instructions, updatedAt: new Date().toISOString() };
        try {
          const j = (await res.json()) as { project?: Project };
          if (j.project) updated = j.project;
        } catch {
          /* no body */
        }
        setProjects((p) => p.map((x) => (x.id === id ? updated : x)));
        toast("Project saved");
      }
      setDialog({ kind: "none" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (dialog.kind !== "delete") return;
    const id = dialog.project.id;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      setProjects((p) => p.filter((x) => x.id !== id));
      setDialog({ kind: "none" });
      toast("Project deleted");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container projects-page page-main">
      <header className="page-head">
        <h1 className="page-title">Projects</h1>
        <p className="page-sub">
          Group related chats and give Citad3L standing instructions — a brief it reads before every reply in that project.
        </p>
      </header>

      <div className="page-toolbar">
        <span className="tiny">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          <IconPlus /> New project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="state empty-state">
          <div className="state-emblem">
            <Rook size={32} />
          </div>
          <h2 className="state-title">No projects yet</h2>
          <p className="state-body">
            Create a project for a research thread, a codebase or a recurring brief. Its instructions apply to every chat inside it.
          </p>
          <div className="state-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <IconPlus /> Create a project
            </button>
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <article key={p.id} className="project-card">
              <div className="project-card-head">
                <span className="project-icon">
                  <IconFolder />
                </span>
                <div className="project-actions">
                  <button type="button" className="icon-btn icon-btn-sm" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}>
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => {
                      setFormError(null);
                      setDialog({ kind: "delete", project: p });
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
              <h2 className="project-name">
                <a href={`/chat?project=${encodeURIComponent(p.id)}`}>{p.name}</a>
              </h2>
              <p className={`project-instructions${p.instructions.trim() ? "" : " is-empty"}`}>
                {p.instructions.trim() || "No instructions"}
              </p>
              <div className="project-meta">
                <span className="tnum">
                  {p.conversationCount} {p.conversationCount === 1 ? "chat" : "chats"}
                </span>
                <span aria-hidden="true">·</span>
                <span>Updated {relTime(p.updatedAt)}</span>
              </div>
            </article>
          ))}
          <button type="button" className="project-new" onClick={openCreate}>
            <IconPlus /> New project
          </button>
        </div>
      )}

      {(dialog.kind === "create" || dialog.kind === "edit") && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog dialog-lg" role="dialog" aria-modal="true" aria-labelledby="proj-dialog-title">
            <h2 id="proj-dialog-title" className="dialog-title">
              {dialog.kind === "create" ? "New project" : "Edit project"}
            </h2>
            <p className="dialog-body">Instructions are sent with every message in this project.</p>
            <form className="form dialog-form" onSubmit={submit}>
              <div className="field">
                <label className="label" htmlFor="proj-name">Name</label>
                <input
                  ref={nameRef}
                  id="proj-name"
                  className="input"
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Robotics reading list"
                  aria-invalid={formError !== null && !name.trim()}
                />
              </div>
              <div className="field">
                <div className="label-row">
                  <label className="label" htmlFor="proj-instr">Instructions</label>
                  <span className="char-count">
                    {instructions.length.toLocaleString()} / {INSTR_MAX.toLocaleString()}
                  </span>
                </div>
                <textarea
                  id="proj-instr"
                  className="textarea"
                  rows={6}
                  value={instructions}
                  maxLength={INSTR_MAX}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Tone, context, constraints. e.g. Answer as a security reviewer; cite assumptions; keep it under 300 words."
                />
                <span className="field-hint">Optional. You can change this any time.</span>
              </div>
              {formError && <p className="field-error" role="alert">{formError}</p>}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy && <span className="spinner" />}
                  {dialog.kind === "create" ? "Create project" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dialog.kind === "delete" && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-body">
            <h2 id="del-title" className="dialog-title">Delete “{dialog.project.name}”?</h2>
            <p id="del-body" className="dialog-body">
              The project and its instructions will be removed. This can’t be undone.
            </p>
            {formError && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={close} disabled={busy} autoFocus>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={busy}>
                {busy && <span className="spinner" />} Delete project
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "error" ? "toast-error" : "toast-ok"}`}>
            <span className="toast-dot" />
            <span>{t.text}</span>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

export default ProjectsView;
