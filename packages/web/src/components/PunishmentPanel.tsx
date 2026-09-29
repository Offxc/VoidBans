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
  description: string | null;
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
  const relevantTemplates = active
    ? templates.filter((t) => t.type === active.type && Boolean(t.defaultDuration) === active.hasDuration)
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
    const selected = rules.filter((r) => ruleIds.includes(r.id));
    // Reads like something a staff member would actually type, not a
    // generated log line — no category grouping or nested punctuation
    // baked in here, since the full rule text (with category) is already
    // shown separately on the ban ID page. Stays short and flat no
    // matter how many rules are picked: "Harassment (C1), Spam (C2)".
    setTemplateId("");
    setReason(selected.map((r) => `${r.title} (${r.code})`).join(", "));
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
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, width: "100%" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{title}</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-dim)" }}>
          How should the reason for this be filled in?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rulesEnabled && (
            <button
              onClick={() => {
                setRuleIds([]);
                setMode("rule");
              }}
              disabled={rules.length === 0}
              className="vb-card"
              style={{ textAlign: "left", color: "inherit", cursor: rules.length === 0 ? "not-allowed" : "pointer", opacity: rules.length === 0 ? 0.5 : 1 }}
              title={rules.length === 0 ? "No rules set up yet" : undefined}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>Pick from the rulebook</span>
                <span className="vb-pill vb-pill-neutral" style={{ fontSize: 10.5 }}>Recommended</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                Select one or more rules the player broke, and the reason is filled in for you.
              </div>
            </button>
          )}
          {templatesEnabled && (
            <button
              onClick={() => setMode("template")}
              disabled={relevantTemplates.length === 0}
              className="vb-card"
              style={{ textAlign: "left", color: "inherit", cursor: relevantTemplates.length === 0 ? "not-allowed" : "pointer", opacity: relevantTemplates.length === 0 ? 0.5 : 1 }}
              title={relevantTemplates.length === 0 ? "No templates for this action type yet" : undefined}
            >
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Use a saved template</div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                Pick a preset reason and duration staff have saved for this action.
              </div>
            </button>
          )}
          <button onClick={startManual} className="vb-card" style={{ textAlign: "left", color: "inherit" }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Write it manually</div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
              Type your own reason and set the duration yourself.
            </div>
          </button>
        </div>
        <button onClick={closePanel} className="vb-btn vb-btn-quiet" style={{ marginTop: 12 }}>
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "rule") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, width: "100%" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{title}: which rule(s) were broken?</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 460, overflowY: "auto" }}>
          {[...rulesByCategory.entries()].map(([category, catRules]) => (
            <div key={category}>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6, fontWeight: 600 }}>{category}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {catRules.map((r) => (
                  <label
                    key={r.id}
                    className="vb-card"
                    style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 10, cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={ruleIds.includes(r.id)}
                      onChange={() => toggleRule(r.id)}
                      style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {r.code} — {r.title}
                      </span>
                      {r.description && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 12.5,
                            color: "var(--text-dim)",
                            marginTop: 3,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {r.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
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

  if (mode === "template") {
    return (
      <div className="vb-panel" style={{ marginTop: 18, padding: 18, width: "100%" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{title}: choose a template</h3>
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
    <form onSubmit={submit} className="vb-panel" style={{ marginTop: 18, padding: 18, width: "100%" }}>
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
