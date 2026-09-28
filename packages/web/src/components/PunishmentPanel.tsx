"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  name: string;
  type: "BAN" | "MUTE" | "KICK" | "WARN";
  defaultReason: string;
  defaultDuration: number | null;
  defaultAppealable: boolean;
}

type Action = {
  key: string;
  label: string;
  type: Template["type"];
  hasDuration: boolean;
  hasIpBan: boolean;
};

type Mode = "choose" | "template" | "manual";

const ACTIONS: Action[] = [
  { key: "mute", label: "Mute", type: "MUTE", hasDuration: false, hasIpBan: false },
  { key: "temp_mute", label: "Temp mute", type: "MUTE", hasDuration: true, hasIpBan: false },
  { key: "kick", label: "Kick", type: "KICK", hasDuration: false, hasIpBan: false },
  { key: "temp_ban", label: "Temp ban", type: "BAN", hasDuration: true, hasIpBan: true },
  { key: "ban", label: "Ban", type: "BAN", hasDuration: false, hasIpBan: true },
];

export function PunishmentPanel({
  playerUuid,
  templates,
  canIssueDirectly,
}: {
  playerUuid: string;
  templates: Template[];
  canIssueDirectly: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [mode, setMode] = useState<Mode>("choose");
  const [templateId, setTemplateId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState<string>("");
  const [appealable, setAppealable] = useState(false);
  const [ipBan, setIpBan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const relevantTemplates = active ? templates.filter((t) => t.type === active.type) : [];

  function openAction(action: Action) {
    setActive(action);
    setMode("choose");
    setTemplateId("");
    setReason("");
    setDurationHours("");
    setAppealable(false);
    setIpBan(false);
    setResult(null);
  }

  function closePanel() {
    setActive(null);
    setMode("choose");
  }

  function pickTemplate(t: Template) {
    setTemplateId(t.id);
    setReason(t.defaultReason);
    if (active?.hasDuration) setDurationHours(t.defaultDuration ? String(t.defaultDuration / 3600) : "");
    setAppealable(t.defaultAppealable);
    setMode("manual"); // reuse the same confirm form, now pre-filled
  }

  function startManual() {
    setTemplateId("");
    setReason("");
    setDurationHours("");
    setAppealable(false);
    setMode("manual");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/staff/punishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerUuid,
          type: active.type,
          reason,
          templateId: templateId || undefined,
          durationSeconds: active.hasDuration && durationHours ? Number(durationHours) * 3600 : undefined,
          appealable,
          ipBanned: active.hasIpBan ? ipBan : false,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setResult(typeof body.error === "string" ? body.error : "Failed.");
        return;
      }
      setResult(body.requested ? "Request submitted for review." : `Issued: ${body.publicBanId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!active) {
    return (
      <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ACTIONS.map((action) => (
          <button key={action.key} onClick={() => openAction(action)} className="vb-btn vb-btn-primary">
            {canIssueDirectly ? action.label : `Request ${action.label.toLowerCase()}`}
          </button>
        ))}
      </div>
    );
  }

  const title = canIssueDirectly ? active.label : `Request: ${active.label}`;

  if (mode === "choose") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>{title}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setMode("template")}
            disabled={relevantTemplates.length === 0}
            className="vb-btn vb-btn-primary"
            title={relevantTemplates.length === 0 ? "No templates for this action type yet" : undefined}
          >
            Use a template
          </button>
          <button onClick={startManual} className="vb-btn vb-btn-ghost">
            Manual entry
          </button>
          <button onClick={closePanel} className="vb-btn vb-btn-quiet">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "template") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{title} — choose a template</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {relevantTemplates.map((t) => (
            <button key={t.id} onClick={() => pickTemplate(t)} className="vb-card" style={{ textAlign: "left", color: "inherit" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{t.defaultReason}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setMode("choose")} className="vb-btn vb-btn-quiet" style={{ marginTop: 12 }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>
        {title}
        {templateId && " — from template"}
      </h3>

      <label className="vb-field">
        Reason
        <textarea
          className="vb-textarea"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </label>

      {active.hasDuration && (
        <label className="vb-field">
          Duration (hours)
          <input
            className="vb-input"
            type="number"
            min={1}
            required
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
          />
        </label>
      )}

      {active.type === "BAN" && (
        <label className="vb-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={appealable} onChange={(e) => setAppealable(e.target.checked)} />
          Appealable
        </label>
      )}

      {active.hasIpBan && (
        <label className="vb-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={ipBan} onChange={(e) => setIpBan(e.target.checked)} />
          Also ban this player&apos;s IP address (blocks any account connecting from it)
        </label>
      )}

      {result && <p style={{ fontSize: 13, color: "var(--text-dim)" }}>{result}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="submit" disabled={submitting} className="vb-btn vb-btn-primary">
          {submitting ? "Submitting…" : canIssueDirectly ? "Confirm" : "Submit request"}
        </button>
        <button type="button" onClick={() => setMode("choose")} className="vb-btn vb-btn-quiet">
          Back
        </button>
        <button type="button" onClick={closePanel} className="vb-btn vb-btn-quiet">
          Cancel
        </button>
      </div>
    </form>
  );
}
