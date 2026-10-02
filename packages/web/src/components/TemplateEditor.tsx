"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DurationInput, formatDuration } from "@/components/DurationInput";

interface Template {
  id: string;
  name: string;
  type: "BAN" | "MUTE" | "KICK" | "WARN";
  defaultReason: string;
  defaultDuration: number | null;
  defaultAppealable: boolean;
}

// Mirrors PunishmentPanel's ACTIONS, templates are stored by raw
// PunishmentType + an optional duration, but staff pick "Temp Ban" vs
// "Ban" explicitly here rather than a bare type dropdown plus an implied
// "blank duration means permanent" convention, which wasn't discoverable
// and made temp-ban/temp-mute templates look like they didn't exist.
const ACTION_KINDS = [
  { key: "mute", label: "Mute", type: "MUTE" as const, hasDuration: false },
  { key: "temp_mute", label: "Temp mute", type: "MUTE" as const, hasDuration: true },
  { key: "kick", label: "Kick", type: "KICK" as const, hasDuration: false },
  { key: "warn", label: "Warn", type: "WARN" as const, hasDuration: false },
  { key: "temp_ban", label: "Temp ban", type: "BAN" as const, hasDuration: true },
  { key: "ban", label: "Ban", type: "BAN" as const, hasDuration: false },
];

function actionKeyFor(type: Template["type"], hasDuration: boolean): string {
  return ACTION_KINDS.find((a) => a.type === type && a.hasDuration === hasDuration)?.key ?? ACTION_KINDS[0]!.key;
}

interface FormState {
  name: string;
  actionKey: string;
  reason: string;
  durationSeconds: number | null;
  appealable: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  actionKey: ACTION_KINDS[0]!.key,
  reason: "",
  durationSeconds: null,
  appealable: false,
};

export function TemplateEditor({
  templates,
  canCreate,
  canEdit,
}: {
  templates: Template[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  // "new" opens the create form; an id string opens that template for
  // editing (pre-filled); null means the form is closed.
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const action = ACTION_KINDS.find((a) => a.key === form.actionKey)!;

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function openEdit(t: Template) {
    setForm({
      name: t.name,
      actionKey: actionKeyFor(t.type, Boolean(t.defaultDuration)),
      reason: t.defaultReason,
      durationSeconds: t.defaultDuration,
      appealable: t.defaultAppealable,
    });
    setEditingId(t.id);
  }

  function close() {
    setEditingId(null);
  }

  async function save() {
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name,
        type: action.type,
        defaultReason: form.reason,
        defaultDurationSeconds: action.hasDuration ? form.durationSeconds ?? undefined : undefined,
        defaultAppealable: form.appealable,
      });

      if (editingId === "new") {
        await fetch("/api/staff/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      } else if (editingId) {
        await fetch(`/api/staff/templates/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
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
      await fetch(`/api/staff/templates/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {templates.map((t) => (
          <div key={t.id} className="vb-card">
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{t.type}</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>{t.defaultReason}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
              {t.defaultDuration ? formatDuration(t.defaultDuration) : "Permanent"} ·{" "}
              {t.defaultAppealable ? "Appealable" : "Not appealable"}
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => openEdit(t)} className="vb-btn vb-btn-quiet" style={{ fontSize: 12, padding: "3px 10px" }}>
                  Edit
                </button>
                <button
                  onClick={() => remove(t.id)}
                  disabled={deletingId === t.id}
                  className="vb-btn vb-btn-quiet"
                  style={{ fontSize: 12, padding: "3px 10px" }}
                >
                  {deletingId === t.id ? "Removing…" : "Delete"}
                </button>
              </div>
            )}
          </div>
        ))}
        {templates.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No templates yet.</p>}
      </div>

      {canCreate && editingId === null && (
        <button onClick={openCreate} className="vb-btn vb-btn-primary" style={{ marginTop: 16 }}>
          New template
        </button>
      )}

      {editingId !== null && (
        <div className="vb-panel" style={{ padding: 18, marginTop: 14, maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="vb-input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
          <textarea
            className="vb-textarea"
            placeholder="Default reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            rows={3}
          />
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
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={save}
              disabled={saving || !form.name || !form.reason || (action.hasDuration && !form.durationSeconds)}
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
