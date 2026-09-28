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
  categoryName: string;
  code: string;
  title: string;
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

// Entry: which starting path (manual/template/rule). Rule and manual
// both flow into "action" -> "confirm"; template picks its action first
// since a template already has a fixed type, then goes straight to
// "confirm" once picked.
type Screen = "entry" | "template" | "ruleSelect" | "action" | "confirm";

// Ordered by severity, least to most: colour and icon both track it, so
// the buttons read as an escalation at a glance rather than five
// identical options.
const ACTIONS: Action[] = [
  { key: "warn", label: "Warn", type: "WARN", hasDuration: false, hasIpBan: false, icon: MuteIcon, buttonClass: "vb-btn-ghost" },
  { key: "mute", label: "Mute", type: "MUTE", hasDuration: false, hasIpBan: false, icon: MuteIcon, buttonClass: "vb-btn-muted" },
  { key: "temp_mute", label: "Temp mute", type: "MUTE", hasDuration: true, hasIpBan: false, icon: TempMuteIcon, buttonClass: "vb-btn-muted" },
  { key: "kick", label: "Kick", type: "KICK", hasDuration: false, hasIpBan: false, icon: KickIcon, buttonClass: "vb-btn-warn" },
  { key: "temp_ban", label: "Temp ban", type: "BAN", hasDuration: true, hasIpBan: true, icon: TempHammerIcon, buttonClass: "vb-btn-warn" },
  { key: "ban", label: "Ban", type: "BAN", hasDuration: false, hasIpBan: true, icon: HammerIcon, buttonClass: "vb-btn-danger" },
];

// Templates keep their own action list, since a template maps to exactly
// one fixed type/duration pairing and staff pick which template (which
// implies the action) rather than picking the action first.
const TEMPLATE_ACTIONS = ACTIONS.filter((a) => a.key !== "warn").concat(
  ACTIONS.filter((a) => a.key === "warn"),
);

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
  const [screen, setScreen] = useState<Screen>("entry");
  const [templateAction, setTemplateAction] = useState<Action | null>(null);
  const [active, setActive] = useState<Action | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [ruleIds, setRuleIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [appealable, setAppealable] = useState(false);
  const [ipBan, setIpBan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const rulesByCategory = rules.reduce<Map<string, Rule[]>>((map, r) => {
    const list = map.get(r.categoryName) ?? [];
    list.push(r);
    map.set(r.categoryName, list);
    return map;
  }, new Map());

  // Match on whether the template itself is permanent/temporary, not
  // just punishment type — a BAN template with no defaultDuration is
  // meant for the permanent "Ban" action, one with a defaultDuration
  // for "Temp ban".
  const relevantTemplates = templateAction
    ? templates.filter((t) => t.type === templateAction.type && Boolean(t.defaultDuration) === templateAction.hasDuration)
    : [];

  function reset() {
    setScreen("entry");
    setTemplateAction(null);
    setActive(null);
    setTemplateId("");
    setRuleIds([]);
    setReason("");
    setDurationSeconds(null);
    setAppealable(false);
    setIpBan(false);
    setResult(null);
  }

  function closePanel() {
    setOpen(false);
    reset();
  }

  function startTemplate() {
    setScreen("template");
  }

  function startRules() {
    setRuleIds([]);
    setScreen("ruleSelect");
  }

  function startManual() {
    setTemplateId("");
    setRuleIds([]);
    setReason("");
    setActive(null);
    setScreen("action");
  }

  function toggleRule(id: string) {
    setRuleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function continueFromRules() {
    const selected = rules.filter((r) => ruleIds.includes(r.id));
    const byCategory = new Map<string, Rule[]>();
    for (const r of selected) {
      const list = byCategory.get(r.categoryName) ?? [];
      list.push(r);
      byCategory.set(r.categoryName, list);
    }
    // Category prefix so the category shows up in the kick/mute screen,
    // not just the dashboard — e.g. "Chat Rules — C1: Harassment".
    const parts = [...byCategory.entries()].map(
      ([category, catRules]) =>
        `${category} — ${catRules.map((r) => `${r.code}: ${r.title}`).join(", ")}`,
    );
    setReason(selected.length === 1 ? `Violation of ${parts[0]}` : `Violation of rules — ${parts.join("; ")}`);
    setTemplateId("");
    setActive(null);
    setScreen("action");
  }

  function pickTemplate(t: Template) {
    if (!templateAction) return;
    setTemplateId(t.id);
    setRuleIds([]);
    setReason(t.defaultReason);
    setActive(templateAction);
    if (templateAction.hasDuration) setDurationSeconds(t.defaultDuration ?? null);
    setAppealable(t.defaultAppealable);
    setScreen("confirm");
  }

  function pickAction(action: Action) {
    setActive(action);
    setDurationSeconds(null);
    if (ruleIds.length === 0) setAppealable(false);
    setScreen("confirm");
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

  if (!open) {
    return (
      <div style={{ marginTop: 18 }}>
        <button onClick={() => setOpen(true)} className="vb-btn vb-btn-primary">
          {canIssueDirectly ? "Punish player" : "Request punishment"}
        </button>
      </div>
    );
  }

  if (screen === "entry") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>
          {canIssueDirectly ? "Punish player" : "Request punishment"}
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {rulesEnabled && (
            <button onClick={startRules} disabled={rules.length === 0} className="vb-btn vb-btn-primary">
              Rule(s)
            </button>
          )}
          {templatesEnabled && (
            <button onClick={startTemplate} disabled={templates.length === 0} className="vb-btn vb-btn-primary">
              Template
            </button>
          )}
          <button onClick={startManual} className="vb-btn vb-btn-ghost">
            Manual
          </button>
          <button onClick={closePanel} className="vb-btn vb-btn-quiet">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (screen === "ruleSelect") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Which rule(s) were broken?</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 420, overflowY: "auto" }}>
          {[...rulesByCategory.entries()].map(([category, catRules]) => (
            <div key={category}>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6, fontWeight: 600 }}>{category}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {catRules.map((r) => (
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
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {r.code} — {r.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={continueFromRules} disabled={ruleIds.length === 0} className="vb-btn vb-btn-primary">
            Continue
          </button>
          <button onClick={() => setScreen("entry")} className="vb-btn vb-btn-quiet">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (screen === "template") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Which action does this template use?</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {TEMPLATE_ACTIONS.map((a) => {
            const Icon = a.icon;
            const count = templates.filter((t) => t.type === a.type && Boolean(t.defaultDuration) === a.hasDuration).length;
            return (
              <button
                key={a.key}
                onClick={() => setTemplateAction(a)}
                disabled={count === 0}
                className={`vb-btn ${templateAction?.key === a.key ? "vb-btn-primary" : "vb-btn-ghost"}`}
              >
                <Icon size={15} />
                {a.label}
              </button>
            );
          })}
        </div>
        {templateAction && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {relevantTemplates.map((t) => (
              <button key={t.id} onClick={() => pickTemplate(t)} className="vb-card" style={{ textAlign: "left", color: "inherit" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{t.defaultReason}</div>
              </button>
            ))}
            {relevantTemplates.length === 0 && (
              <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No templates for {templateAction.label}.</p>
            )}
          </div>
        )}
        <button onClick={() => setScreen("entry")} className="vb-btn vb-btn-quiet" style={{ marginTop: 12 }}>
          Back
        </button>
      </div>
    );
  }

  if (screen === "action") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>
          {ruleIds.length > 0 ? "What action fits this?" : "Choose an action"}
        </h3>
        {reason && (
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0, marginBottom: 14 }}>{reason}</p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.key} onClick={() => pickAction(a)} className={`vb-btn ${a.buttonClass}`}>
                <Icon size={15} />
                {a.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setScreen(ruleIds.length > 0 ? "ruleSelect" : "entry")}
          className="vb-btn vb-btn-quiet"
          style={{ marginTop: 12 }}
        >
          Back
        </button>
      </div>
    );
  }

  if (screen === "confirm" && active) {
    return (
      <form onSubmit={submit} className="vb-panel" style={{ marginTop: 18, padding: 18, maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>
          {active.label}
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
          <button
            type="button"
            onClick={() => setScreen(templateId ? "template" : "action")}
            className="vb-btn vb-btn-quiet"
          >
            Back
          </button>
          <button type="button" onClick={closePanel} className="vb-btn vb-btn-quiet">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return null;
}
