"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DurationInput, formatDuration } from "@/components/DurationInput";

interface Rule {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: "BAN" | "MUTE" | "KICK" | "WARN";
  defaultDuration: number | null;
  defaultAppealable: boolean;
  active: boolean;
}

// Same action list as TemplateEditor — a rule carries the same
// default-punishment shape a template does (type + optional duration),
// picked the same explicit Manual/Temp Ban/Ban way rather than a bare
// type dropdown.
const ACTION_KINDS = [
  { key: "mute", label: "Mute", type: "MUTE" as const, hasDuration: false },
  { key: "temp_mute", label: "Temp mute", type: "MUTE" as const, hasDuration: true },
  { key: "kick", label: "Kick", type: "KICK" as const, hasDuration: false },
  { key: "warn", label: "Warn", type: "WARN" as const, hasDuration: false },
  { key: "temp_ban", label: "Temp ban", type: "BAN" as const, hasDuration: true },
  { key: "ban", label: "Ban", type: "BAN" as const, hasDuration: false },
];

function actionKeyFor(type: Rule["type"], hasDuration: boolean): string {
  return ACTION_KINDS.find((a) => a.type === type && a.hasDuration === hasDuration)?.key ?? ACTION_KINDS[0]!.key;
}

interface FormState {
  code: string;
  title: string;
  description: string;
  actionKey: string;
  durationSeconds: number | null;
  appealable: boolean;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  code: "",
  title: "",
  description: "",
  actionKey: ACTION_KINDS[0]!.key,
  durationSeconds: null,
  appealable: false,
  active: true,
};

export function PunishmentRuleEditor({
  rules,
  canCreate,
  canEdit,
}: {
  rules: Rule[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const action = ACTION_KINDS.find((a) => a.key === form.actionKey)!;

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setEditingId("new");
  }

  function openEdit(r: Rule) {
    setForm({
      code: r.code,
      title: r.title,
      description: r.description ?? "",
      actionKey: actionKeyFor(r.type, Boolean(r.defaultDuration)),
      durationSeconds: r.defaultDuration,
      appealable: r.defaultAppealable,
      active: r.active,
    });
    setError(null);
    setEditingId(r.id);
  }

  function close() {
    setEditingId(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        code: form.code,
        title: form.title,
        description: form.description.trim() || undefined,
        type: action.type,
        defaultDurationSeconds: action.hasDuration ? form.durationSeconds ?? undefined : undefined,
        defaultAppealable: form.appealable,
        active: form.active,
      });

      const res =
        editingId === "new"
          ? await fetch("/api/staff/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body })
          : await fetch(`/api/staff/rules/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(typeof errBody.error === "string" ? errBody.error : "Failed to save.");
        return;
      }

      setEditingId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/staff/rules/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {rules.map((r) => (
          <div key={r.id} className="vb-card" style={{ opacity: r.active ? 1 : 0.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="vb-pill vb-pill-neutral">{r.code}</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
            </div>
            {r.description && <div style={{ fontSize: 13, marginTop: 8 }}>{r.description}</div>}
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
              {r.type} · {r.defaultDuration ? formatDuration(r.defaultDuration) : "Permanent"} ·{" "}
              {r.defaultAppealable ? "Appealable" : "Not appealable"}
              {!r.active && " · Retired"}
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => openEdit(r)} className="vb-btn vb-btn-quiet" style={{ fontSize: 12, padding: "3px 10px" }}>
                  Edit
                </button>
                <button
                  onClick={() => remove(r.id)}
                  disabled={deletingId === r.id}
                  className="vb-btn vb-btn-quiet"
                  style={{ fontSize: 12, padding: "3px 10px" }}
                >
                  {deletingId === r.id ? "Removing…" : "Delete"}
                </button>
              </div>
            )}
          </div>
        ))}
        {rules.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No rules yet.</p>}
      </div>

      {canCreate && editingId === null && (
        <button onClick={openCreate} className="vb-btn vb-btn-primary" style={{ marginTop: 16 }}>
          New rule
        </button>
      )}

      {editingId !== null && (
        <div className="vb-panel" style={{ padding: 18, marginTop: 14, maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="vb-input"
            placeholder="Code (e.g. C1)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          />
          <input
            className="vb-input"
            placeholder="Title (e.g. Harassment)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="vb-textarea"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
          />
          <select
            className="vb-select"
            value={form.actionKey}
            onChange={(e) => setForm((f) => ({ ...f, actionKey: e.target.value, durationSeconds: null }))}
          >
            {ACTION_KINDS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          {action.hasDuration && (
            <DurationInput
              label="Default duration"
              seconds={form.durationSeconds}
              onChange={(durationSeconds) => setForm((f) => ({ ...f, durationSeconds }))}
              required
            />
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
            <input
              type="checkbox"
              checked={form.appealable}
              onChange={(e) => setForm((f) => ({ ...f, appealable: e.target.checked }))}
            />
            Appealable by default
          </label>
          {editingId !== "new" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active (shown when punishing)
            </label>
          )}
          {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={save}
              disabled={saving || !form.code || !form.title || (action.hasDuration && !form.durationSeconds)}
              className="vb-btn vb-btn-primary"
            >
              {saving ? "Saving…" : editingId === "new" ? "Create" : "Save"}
            </button>
            <button onClick={close} className="vb-btn vb-btn-quiet">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
