"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MuteIcon, TempMuteIcon, KickIcon, HammerIcon, TempHammerIcon } from "@/components/PunishmentIcons";
import { DurationInput } from "@/components/DurationInput";

interface Template {
  id: string;
  name: string;
  type: "BAN" | "MUTE" | "KICK" | "WARN";
  defaultReason: string;
  defaultDuration: number | null;
  defaultAppealable: boolean;
}

interface Rule {
  id: string;
  code: string;
  title: string;
  type: "BAN" | "MUTE" | "KICK" | "WARN";
  defaultDuration: number | null;
  defaultAppealable: boolean;
}

type Action = {
  key: string;
  label: string;
  type: Template["type"];
  hasDuration: boolean;
  hasIpBan: boolean;
  icon: React.ComponentType<{ size?: number }>;
  buttonClass: string;
};

type Mode = "choose" | "template" | "rule" | "manual";

// Ordered by severity, least to most: colour and icon both track it, so
// the buttons read as an escalation at a glance rather than five
// identical options.
const ACTIONS: Action[] = [
  { key: "mute", label: "Mute", type: "MUTE", hasDuration: false, hasIpBan: false, icon: MuteIcon, buttonClass: "vb-btn-muted" },
  { key: "temp_mute", label: "Temp mute", type: "MUTE", hasDuration: true, hasIpBan: false, icon: TempMuteIcon, buttonClass: "vb-btn-muted" },
  { key: "kick", label: "Kick", type: "KICK", hasDuration: false, hasIpBan: false, icon: KickIcon, buttonClass: "vb-btn-warn" },
  { key: "temp_ban", label: "Temp ban", type: "BAN", hasDuration: true, hasIpBan: true, icon: TempHammerIcon, buttonClass: "vb-btn-warn" },
  { key: "ban", label: "Ban", type: "BAN", hasDuration: false, hasIpBan: true, icon: HammerIcon, buttonClass: "vb-btn-danger" },
];

export function PunishmentPanel({
  playerUuid,
  templates,
  rules,
  templatesEnabled,
  rulesEnabled,
  canIssueDirectly,
}: {
  playerUuid: string;
  templates: Template[];
  rules: Rule[];
  templatesEnabled: boolean;
  rulesEnabled: boolean;
  canIssueDirectly: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [mode, setMode] = useState<Mode>("choose");
  const [templateId, setTemplateId] = useState<string>("");
  const [ruleIds, setRuleIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [appealable, setAppealable] = useState(false);
  const [ipBan, setIpBan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Match on whether the template/rule itself is permanent/temporary, not
  // just punishment type — a BAN template with no defaultDuration is meant
  // for the permanent "Ban" action, one with a defaultDuration for "Temp
  // ban". Without this, e.g. a permanent ban template showed up under
  // "Temp ban" too, and picking it there left duration blank with nothing
  // to fill it in from, since a permanent template legitimately has none.
  const relevantTemplates = active
    ? templates.filter((t) => t.type === active.type && Boolean(t.defaultDuration) === active.hasDuration)
    : [];
  const relevantRules = active
    ? rules.filter((r) => r.type === active.type && Boolean(r.defaultDuration) === active.hasDuration)
    : [];

  function openAction(action: Action) {
    setActive(action);
    setMode("choose");
    setTemplateId("");
    setRuleIds([]);
    setReason("");
    setDurationSeconds(null);
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
    setRuleIds([]);
    setReason(t.defaultReason);
    if (active?.hasDuration) setDurationSeconds(t.defaultDuration ?? null);
    setAppealable(t.defaultAppealable);
    setMode("manual"); // reuse the same confirm form, now pre-filled
  }

  function toggleRule(id: string) {
    setRuleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function applyRules() {
    const selected = relevantRules.filter((r) => ruleIds.includes(r.id));
    setTemplateId("");
    setReason(
      selected.length === 1
        ? `Violation of rule ${selected[0]!.code}: ${selected[0]!.title}`
        : `Violation of rules: ${selected.map((r) => `${r.code} (${r.title})`).join(", ")}`,
    );
    // Multiple selected rules can carry different default durations —
    // the longest one wins, on the basis that the most severe applicable
    // rule should set the punishment length rather than an arbitrary
    // last-picked one.
    if (active?.hasDuration) {
      const longest = selected.reduce<number | null>((max, r) => {
        if (!r.defaultDuration) return max;
        return max === null || r.defaultDuration > max ? r.defaultDuration : max;
      }, null);
      setDurationSeconds(longest);
    }
    setAppealable(selected.some((r) => r.defaultAppealable));
    setMode("manual");
  }

  function startManual() {
    setTemplateId("");
    setRuleIds([]);
    setReason("");
    setDurationSeconds(null);
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
          ruleIds: ruleIds.length > 0 ? ruleIds : undefined,
          durationSeconds: active.hasDuration && durationSeconds ? durationSeconds : undefined,
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
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.key} onClick={() => openAction(action)} className={`vb-btn ${action.buttonClass}`}>
              <Icon size={15} />
              {canIssueDirectly ? action.label : `Request ${action.label.toLowerCase()}`}
            </button>
          );
        })}
      </div>
    );
  }

  const title = canIssueDirectly ? active.label : `Request: ${active.label}`;

  if (mode === "choose") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>{title}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {templatesEnabled && (
            <button
              onClick={() => setMode("template")}
              disabled={relevantTemplates.length === 0}
              className="vb-btn vb-btn-primary"
              title={relevantTemplates.length === 0 ? "No templates for this action type yet" : undefined}
            >
              Use a template
            </button>
          )}
          {rulesEnabled && (
            <button
              onClick={() => setMode("rule")}
              disabled={relevantRules.length === 0}
              className="vb-btn vb-btn-primary"
              title={relevantRules.length === 0 ? "No rules for this action type yet" : undefined}
            >
              Use rule(s)
            </button>
          )}
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

  if (mode === "rule") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{title} — choose rule(s) broken</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {relevantRules.map((r) => (
            <label
              key={r.id}
              className="vb-card"
              style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={ruleIds.includes(r.id)}
                onChange={() => toggleRule(r.id)}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {r.code} — {r.title}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={applyRules} disabled={ruleIds.length === 0} className="vb-btn vb-btn-primary">
            Continue
          </button>
          <button onClick={() => setMode("choose")} className="vb-btn vb-btn-quiet">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>
        {title}
        {templateId && " — from template"}
        {ruleIds.length > 0 && ` — from ${ruleIds.length === 1 ? "rule" : "rules"}`}
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
        <DurationInput label="Duration" seconds={durationSeconds} onChange={setDurationSeconds} required />
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
