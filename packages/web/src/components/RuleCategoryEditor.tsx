"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DurationInput, formatDuration } from "@/components/DurationInput";

interface Rule {
  id: string;
  code: string;
  title: string;
  description: string | null;
  suggestedType: "BAN" | "MUTE" | "KICK" | "WARN" | null;
  defaultDuration: number | null;
  defaultAppealable: boolean;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  rules: Rule[];
}

// "None" is the default: most real rules don't dictate a fixed
// punishment, severity is a staff judgment call made after seeing the
// player's history, so a rule only suggests a type if the owner
// deliberately picks one.
const SUGGESTED_KINDS = [
  { key: "none", label: "No suggestion", type: null, hasDuration: false },
  { key: "warn", label: "Warn", type: "WARN" as const, hasDuration: false },
  { key: "mute", label: "Mute", type: "MUTE" as const, hasDuration: false },
  { key: "temp_mute", label: "Temp mute", type: "MUTE" as const, hasDuration: true },
  { key: "kick", label: "Kick", type: "KICK" as const, hasDuration: false },
  { key: "temp_ban", label: "Temp ban", type: "BAN" as const, hasDuration: true },
  { key: "ban", label: "Ban", type: "BAN" as const, hasDuration: false },
];

function suggestedKeyFor(type: Rule["suggestedType"], hasDuration: boolean): string {
  if (!type) return "none";
  return SUGGESTED_KINDS.find((k) => k.type === type && k.hasDuration === hasDuration)?.key ?? "none";
}

interface RuleFormState {
  code: string;
  title: string;
  description: string;
  suggestedKey: string;
  durationSeconds: number | null;
  appealable: boolean;
  active: boolean;
}

const EMPTY_RULE_FORM: RuleFormState = {
  code: "",
  title: "",
  description: "",
  suggestedKey: "none",
  durationSeconds: null,
  appealable: false,
  active: true,
};

export function RuleCategoryEditor({
  categories,
  canCreate,
  canEdit,
}: {
  categories: Category[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();

  // Category create/edit
  const [editingCategoryId, setEditingCategoryId] = useState<string | "new" | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Rule create/edit, ruleFormFor tracks which category a new/edited rule belongs to
  const [ruleFormCategoryId, setRuleFormCategoryId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | "new" | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const suggested = SUGGESTED_KINDS.find((k) => k.key === ruleForm.suggestedKey)!;

  function openNewCategory() {
    setCategoryName("");
    setCategoryDescription("");
    setCategoryError(null);
    setEditingCategoryId("new");
  }

  function openEditCategory(c: Category) {
    setCategoryName(c.name);
    setCategoryDescription(c.description ?? "");
    setCategoryError(null);
    setEditingCategoryId(c.id);
  }

  async function saveCategory() {
    setCategorySaving(true);
    setCategoryError(null);
    try {
      const body = JSON.stringify({
        name: categoryName,
        description: categoryDescription.trim() || undefined,
        sortOrder: 0,
      });
      const res =
        editingCategoryId === "new"
          ? await fetch("/api/staff/rule-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body })
          : await fetch(`/api/staff/rule-categories/${editingCategoryId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body,
            });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setCategoryError(typeof errBody.error === "string" ? errBody.error : "Failed to save.");
        return;
      }
      setEditingCategoryId(null);
      router.refresh();
    } finally {
      setCategorySaving(false);
    }
  }

  async function removeCategory(id: string) {
    setDeletingCategoryId(id);
    try {
      const res = await fetch(`/api/staff/rule-categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(typeof body.error === "string" ? body.error : "Failed to delete.");
      }
      router.refresh();
    } finally {
      setDeletingCategoryId(null);
    }
  }

  function openNewRule(categoryId: string) {
    setRuleForm(EMPTY_RULE_FORM);
    setRuleError(null);
    setRuleFormCategoryId(categoryId);
    setEditingRuleId("new");
  }

  function openEditRule(categoryId: string, r: Rule) {
    setRuleForm({
      code: r.code,
      title: r.title,
      description: r.description ?? "",
      suggestedKey: suggestedKeyFor(r.suggestedType, Boolean(r.defaultDuration)),
      durationSeconds: r.defaultDuration,
      appealable: r.defaultAppealable,
      active: r.active,
    });
    setRuleError(null);
    setRuleFormCategoryId(categoryId);
    setEditingRuleId(r.id);
  }

  function closeRuleForm() {
    setEditingRuleId(null);
    setRuleFormCategoryId(null);
  }

  async function saveRule() {
    if (!ruleFormCategoryId) return;
    setRuleSaving(true);
    setRuleError(null);
    try {
      const body = JSON.stringify({
        categoryId: ruleFormCategoryId,
        code: ruleForm.code,
        title: ruleForm.title,
        description: ruleForm.description.trim() || undefined,
        suggestedType: suggested.type ?? undefined,
        defaultDurationSeconds: suggested.hasDuration ? ruleForm.durationSeconds ?? undefined : undefined,
        defaultAppealable: ruleForm.appealable,
        active: ruleForm.active,
      });

      const res =
        editingRuleId === "new"
          ? await fetch("/api/staff/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body })
          : await fetch(`/api/staff/rules/${editingRuleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setRuleError(typeof errBody.error === "string" ? errBody.error : "Failed to save.");
        return;
      }
      closeRuleForm();
      router.refresh();
    } finally {
      setRuleSaving(false);
    }
  }

  async function removeRule(id: string) {
    setDeletingRuleId(id);
    try {
      await fetch(`/api/staff/rules/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingRuleId(null);
    }
  }

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      {categories.map((c) => (
        <div key={c.id} className="vb-section" style={{ margin: 0 }}>
          <div
            className="vb-section-label"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span>{c.name}</span>
            {canEdit && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => openEditCategory(c)} className="vb-btn vb-btn-quiet" style={{ fontSize: 11, padding: "2px 8px" }}>
                  Edit
                </button>
                <button
                  onClick={() => removeCategory(c.id)}
                  disabled={deletingCategoryId === c.id}
                  className="vb-btn vb-btn-quiet"
                  style={{ fontSize: 11, padding: "2px 8px" }}
                >
                  {deletingCategoryId === c.id ? "Removing…" : "Delete"}
                </button>
              </div>
            )}
          </div>

          {editingCategoryId === c.id && (
            <CategoryForm
              name={categoryName}
              description={categoryDescription}
              saving={categorySaving}
              error={categoryError}
              onNameChange={setCategoryName}
              onDescriptionChange={setCategoryDescription}
              onSave={saveCategory}
              onCancel={() => setEditingCategoryId(null)}
            />
          )}

          {c.description && editingCategoryId !== c.id && (
            <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 10px" }}>{c.description}</p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {c.rules.map((r) => (
              <div key={r.id} className="vb-card" style={{ opacity: r.active ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="vb-pill vb-pill-neutral">{r.code}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                </div>
                {r.description && <div style={{ fontSize: 13, marginTop: 8 }}>{r.description}</div>}
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                  {r.suggestedType
                    ? `${r.suggestedType} suggested · ${r.defaultDuration ? formatDuration(r.defaultDuration) : "Permanent"}`
                    : "No suggested action"}
                  {r.defaultAppealable && " · Appealable"}
                  {!r.active && " · Retired"}
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={() => openEditRule(c.id, r)} className="vb-btn vb-btn-quiet" style={{ fontSize: 12, padding: "3px 10px" }}>
                      Edit
                    </button>
                    <button
                      onClick={() => removeRule(r.id)}
                      disabled={deletingRuleId === r.id}
                      className="vb-btn vb-btn-quiet"
                      style={{ fontSize: 12, padding: "3px 10px" }}
                    >
                      {deletingRuleId === r.id ? "Removing…" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {c.rules.length === 0 && editingRuleId !== "new" && (
              <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No rules in this category yet.</p>
            )}
          </div>

          {canCreate && editingRuleId === null && (
            <button onClick={() => openNewRule(c.id)} className="vb-btn vb-btn-ghost" style={{ marginTop: 10 }}>
              New rule in {c.name}
            </button>
          )}

          {editingRuleId !== null && ruleFormCategoryId === c.id && (
            <RuleForm
              form={ruleForm}
              setForm={setRuleForm}
              suggested={suggested}
              saving={ruleSaving}
              error={ruleError}
              isNew={editingRuleId === "new"}
              onSave={saveRule}
              onCancel={closeRuleForm}
            />
          )}
        </div>
      ))}

      {categories.length === 0 && editingCategoryId !== "new" && (
        <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No categories yet.</p>
      )}

      {canCreate && editingCategoryId === null && (
        <button onClick={openNewCategory} className="vb-btn vb-btn-primary" style={{ alignSelf: "flex-start" }}>
          New category
        </button>
      )}

      {editingCategoryId === "new" && (
        <div className="vb-panel" style={{ padding: 18, maxWidth: 360 }}>
          <CategoryForm
            name={categoryName}
            description={categoryDescription}
            saving={categorySaving}
            error={categoryError}
            onNameChange={setCategoryName}
            onDescriptionChange={setCategoryDescription}
            onSave={saveCategory}
            onCancel={() => setEditingCategoryId(null)}
          />
        </div>
      )}
    </div>
  );
}

function CategoryForm({
  name,
  description,
  saving,
  error,
  onNameChange,
  onDescriptionChange,
  onSave,
  onCancel,
}: {
  name: string;
  description: string;
  saving: boolean;
  error: string | null;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="vb-panel" style={{ padding: 14, marginBottom: 12, maxWidth: 360, display: "flex", flexDirection: "column", gap: 8 }}>
      <input className="vb-input" placeholder="Category name (e.g. Chat Rules)" value={name} onChange={(e) => onNameChange(e.target.value)} />
      <textarea
        className="vb-textarea"
        placeholder="Description shown under the heading (optional)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        rows={2}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving || !name.trim()} className="vb-btn vb-btn-primary" style={{ fontSize: 13 }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="vb-btn vb-btn-quiet" style={{ fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function RuleForm({
  form,
  setForm,
  suggested,
  saving,
  error,
  isNew,
  onSave,
  onCancel,
}: {
  form: RuleFormState;
  setForm: React.Dispatch<React.SetStateAction<RuleFormState>>;
  suggested: (typeof SUGGESTED_KINDS)[number];
  saving: boolean;
  error: string | null;
  isNew: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="vb-panel" style={{ padding: 18, marginTop: 10, maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        className="vb-input"
        placeholder="Code (e.g. C1)"
        value={form.code}
        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
      />
      <input
        className="vb-input"
        placeholder="Title (short, shown on the kick and mute screen)"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />
      <textarea
        className="vb-textarea"
        placeholder="Description (full detail, shown on the dashboard and public rules page only)"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        rows={2}
      />
      <select
        className="vb-select"
        value={form.suggestedKey}
        onChange={(e) => setForm((f) => ({ ...f, suggestedKey: e.target.value, durationSeconds: null }))}
      >
        {SUGGESTED_KINDS.map((k) => (
          <option key={k.key} value={k.key}>
            {k.label}
          </option>
        ))}
      </select>
      {suggested.hasDuration && (
        <DurationInput
          label="Suggested duration"
          seconds={form.durationSeconds}
          onChange={(durationSeconds) => setForm((f) => ({ ...f, durationSeconds }))}
          required
        />
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
        <input type="checkbox" checked={form.appealable} onChange={(e) => setForm((f) => ({ ...f, appealable: e.target.checked }))} />
        Appealable by default
      </label>
      {!isNew && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
          Active (shown when punishing and on the public rules page)
        </label>
      )}
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={onSave}
          disabled={saving || !form.code || !form.title || (suggested.hasDuration && !form.durationSeconds)}
          className="vb-btn vb-btn-primary"
        >
          {saving ? "Saving…" : isNew ? "Create" : "Save"}
        </button>
        <button onClick={onCancel} className="vb-btn vb-btn-quiet">
          Cancel
        </button>
      </div>
    </div>
  );
}
