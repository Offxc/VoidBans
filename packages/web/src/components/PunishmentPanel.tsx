"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // Drives the modal's accent colour so it matches the button that opened it.
  accent: string;
  accentSoft: string;
};

type Step = "method" | "rules" | "templates" | "details" | "done";
type Via = "rules" | "templates" | "manual";

// Ordered by severity, least to most: colour and icon both track it, so
// the buttons read as an escalation at a glance rather than five
// identical options.
const ACTIONS: Action[] = [
  { key: "mute", label: "Mute", type: "MUTE", hasDuration: false, hasIpBan: false, icon: MuteIcon, buttonClass: "vb-btn-muted", accent: "var(--info)", accentSoft: "var(--info-soft)" },
  { key: "temp_mute", label: "Temp mute", type: "MUTE", hasDuration: true, hasIpBan: false, icon: TempMuteIcon, buttonClass: "vb-btn-muted", accent: "var(--info)", accentSoft: "var(--info-soft)" },
  { key: "kick", label: "Kick", type: "KICK", hasDuration: false, hasIpBan: false, icon: KickIcon, buttonClass: "vb-btn-warn", accent: "var(--warn)", accentSoft: "var(--warn-soft)" },
  { key: "temp_ban", label: "Temp ban", type: "BAN", hasDuration: true, hasIpBan: true, icon: TempHammerIcon, buttonClass: "vb-btn-warn", accent: "var(--warn)", accentSoft: "var(--warn-soft)" },
  { key: "ban", label: "Ban", type: "BAN", hasDuration: false, hasIpBan: true, icon: HammerIcon, buttonClass: "vb-btn-danger", accent: "var(--danger)", accentSoft: "var(--danger-soft)" },
];

const CLOSE_MS = 180;

function formatDuration(seconds: number): string {
  const units: [string, number][] = [["w", 604800], ["d", 86400], ["h", 3600], ["m", 60]];
  for (const [label, size] of units) {
    if (seconds % size === 0) return `${seconds / size}${label}`;
  }
  return `${Math.round(seconds / 60)}m`;
}

function Svg({ size = 16, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ChevronDown = () => (
  <Svg size={16}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
const ChevronRight = () => (
  <Svg size={18}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export function PunishmentPanel({
  playerUuid,
  playerName,
  templates,
  rules,
  templatesEnabled,
  rulesEnabled,
  canIssueDirectly,
}: {
  playerUuid: string;
  playerName?: string;
  templates: Template[];
  rules: Rule[];
  templatesEnabled: boolean;
  rulesEnabled: boolean;
  canIssueDirectly: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState<Step>("method");
  const [dir, setDir] = useState<1 | -1>(1);
  const [via, setVia] = useState<Via>("manual");
  const [templateId, setTemplateId] = useState("");
  const [ruleIds, setRuleIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [appealable, setAppealable] = useState(false);
  const [ipBan, setIpBan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedId, setIssuedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const skipMethod = !rulesEnabled && !templatesEnabled;

  // Match on whether the template itself is permanent/temporary, not
  // just punishment type, a BAN template with no defaultDuration is
  // meant for the permanent "Ban" action, one with a defaultDuration
  // for "Temp ban".
  const relevantTemplates = useMemo(
    () => (active ? templates.filter((t) => t.type === active.type && Boolean(t.defaultDuration) === active.hasDuration) : []),
    [templates, active],
  );

  const categories = useMemo(() => Array.from(new Set(rules.map((r) => r.categoryName))), [rules]);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, Rule[]>();
    for (const r of rules) {
      if (category && r.categoryName !== category) continue;
      if (q && !`${r.code} ${r.title} ${r.categoryName} ${r.description ?? ""}`.toLowerCase().includes(q)) continue;
      const list = groups.get(r.categoryName) ?? [];
      list.push(r);
      groups.set(r.categoryName, list);
    }
    return Array.from(groups.entries());
  }, [rules, query, category]);

  const selectedRules = rules.filter((r) => ruleIds.includes(r.id));
  const selectedTemplate = templates.find((t) => t.id === templateId);

  // Lock page scroll behind the dialog and hand focus back to whatever
  // opened it once it's gone.
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      triggerRef.current?.focus?.();
    };
  }, [active]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Each step starts at the top rather than inheriting the last one's scroll.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  function go(next: Step, direction: 1 | -1 = 1) {
    setDir(direction);
    setStep(next);
  }

  function openAction(action: Action) {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActive(action);
    setClosing(false);
    setVia("manual");
    setTemplateId("");
    setRuleIds([]);
    setReason("");
    setDurationSeconds(null);
    setAppealable(false);
    setIpBan(false);
    setError(null);
    setIssuedId(null);
    setQuery("");
    setCategory("");
    setExpanded([]);
    setDir(1);
    setStep(skipMethod ? "details" : "method");
  }

  function requestClose() {
    if (submitting || closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setActive(null);
      setClosing(false);
    }, CLOSE_MS);
  }

  function back() {
    if (step === "details") {
      if (via === "rules") return go("rules", -1);
      if (via === "templates") return go("templates", -1);
      return skipMethod ? requestClose() : go("method", -1);
    }
    if (step === "rules" || step === "templates") return go("method", -1);
    requestClose();
  }

  function pickTemplate(t: Template) {
    setVia("templates");
    setTemplateId(t.id);
    setRuleIds([]);
    setReason(t.defaultReason);
    if (active?.hasDuration) setDurationSeconds(t.defaultDuration ?? null);
    setAppealable(t.defaultAppealable);
    go("details");
  }

  function applyRules() {
    // Reads like something a staff member would actually type, not a
    // generated log line, no category grouping or nested punctuation
    // baked in here, since the full rule text (with category) is already
    // shown separately on the ban ID page. Stays short and flat no
    // matter how many rules are picked: "Harassment (C1), Spam (C2)".
    setVia("rules");
    setTemplateId("");
    setReason(selectedRules.map((r) => `${r.title} (${r.code})`).join(", "));
    go("details");
  }

  function startManual() {
    setVia("manual");
    setTemplateId("");
    setRuleIds([]);
    setReason("");
    setDurationSeconds(null);
    setAppealable(false);
    go("details");
  }

  function toggleRule(id: string) {
    setRuleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/punishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerUuid,
          type: active.type,
          reason,
          templateId: templateId || undefined,
          ruleIds: via === "rules" && ruleIds.length > 0 ? ruleIds : undefined,
          durationSeconds: active.hasDuration && durationSeconds ? durationSeconds : undefined,
          appealable,
          ipBanned: active.hasIpBan ? ipBan : false,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Something went wrong. Try again.");
        return;
      }
      setIssuedId(body.requested ? "" : String(body.publicBanId ?? ""));
      go("done");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Escape closes; Tab is kept inside the dialog.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const launchers = (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.key}
            type="button"
            onClick={() => openAction(action)}
            className={`vb-btn ${action.buttonClass}`}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            <Icon size={15} />
            {canIssueDirectly ? action.label : `Request ${action.label.toLowerCase()}`}
          </button>
        );
      })}
    </div>
  );

  if (!active) return launchers;

  const Icon = active.icon;
  const title = canIssueDirectly ? active.label : `Request ${active.label.toLowerCase()}`;
  const titleId = "vb-wiz-title";

  // Progress: Method -> (Rules | Template) -> Details. Manual skips the
  // middle step, and a lone Details step (both modes off) needs no bar.
  const path: Via = step === "rules" ? "rules" : step === "templates" ? "templates" : via;
  const middleLabel = path === "templates" ? "Template" : "Rules";
  const labels = skipMethod
    ? []
    : step === "method"
      ? ["Method", "Reason", "Details"]
      : path === "manual"
        ? ["Method", "Details"]
        : ["Method", middleLabel, "Details"];
  const currentIndex =
    step === "method" ? 0 : step === "rules" || step === "templates" ? 1 : step === "details" || step === "done" ? labels.length - 1 : 0;
  const showProgress = labels.length > 0 && step !== "done";

  const modal = (
    <div
      className="vb-modal-root"
      data-closing={closing}
      onMouseDown={(e) => {
        // Only a click that starts on the dim backdrop dismisses; typing a
        // reason and dragging a text selection out of the box must not.
        if (e.target === e.currentTarget && (step === "method" || step === "done")) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="vb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{ "--wiz-accent": active.accent, "--wiz-accent-soft": active.accentSoft } as React.CSSProperties}
      >
        <div className="vb-modal-head">
          <span className="vb-modal-icon">
            <Icon size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="vb-modal-title">
              {title}
            </h2>
            {playerName && <p className="vb-modal-sub">{playerName}</p>}
          </div>
          <button type="button" onClick={requestClose} className="vb-btn vb-btn-quiet vb-modal-close" aria-label="Close" style={{ padding: 8 }}>
            <Svg size={18}>
              <path d="M18 6 6 18M6 6l12 12" />
            </Svg>
          </button>
        </div>

        {showProgress && (
          <div className="vb-prog">
            <div className="vb-prog-bar" aria-hidden="true">
              {labels.map((l, i) => (
                <span key={l} className="vb-prog-seg" data-state={i < currentIndex ? "done" : i === currentIndex ? "current" : "todo"} />
              ))}
            </div>
            <p className="vb-prog-label">
              Step {currentIndex + 1} of {labels.length} · <strong>{labels[currentIndex]}</strong>
            </p>
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div ref={bodyRef} className="vb-modal-body">
            <div key={step} className="vb-wiz-step" data-dir={dir}>
              {step === "method" && (
                <>
                  <p className="vb-step-heading">How do you want to fill in the reason?</p>
                  {rulesEnabled && (
                    <button type="button" className="vb-method" disabled={rules.length === 0} onClick={() => go("rules")}>
                      <span className="vb-method-icon">
                        <Svg size={20}>
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </Svg>
                      </span>
                      <span>
                        <span className="vb-method-title">
                          Rulebook <span className="vb-pill vb-pill-neutral">Recommended</span>
                        </span>
                        <span className="vb-method-hint" style={{ display: "block" }}>
                          {rules.length === 0 ? "No rules set up yet" : "Pick the rules that were broken"}
                        </span>
                      </span>
                      <span className="vb-method-arrow">
                        <ChevronRight />
                      </span>
                    </button>
                  )}
                  {templatesEnabled && (
                    <button type="button" className="vb-method" disabled={relevantTemplates.length === 0} onClick={() => go("templates")}>
                      <span className="vb-method-icon">
                        <Svg size={20}>
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </Svg>
                      </span>
                      <span>
                        <span className="vb-method-title">Template</span>
                        <span className="vb-method-hint" style={{ display: "block" }}>
                          {relevantTemplates.length === 0 ? "None saved for this action" : "Use a saved reason and duration"}
                        </span>
                      </span>
                      <span className="vb-method-arrow">
                        <ChevronRight />
                      </span>
                    </button>
                  )}
                  <button type="button" className="vb-method" onClick={startManual}>
                    <span className="vb-method-icon">
                      <Svg size={20}>
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </Svg>
                    </span>
                    <span>
                      <span className="vb-method-title">Write it yourself</span>
                      <span className="vb-method-hint" style={{ display: "block" }}>
                        Type the reason and set the length
                      </span>
                    </span>
                    <span className="vb-method-arrow">
                      <ChevronRight />
                    </span>
                  </button>
                </>
              )}

              {step === "rules" && (
                <>
                  <div className="vb-wiz-tools">
                    <input
                      type="search"
                      className="vb-input"
                      placeholder="Search rules"
                      aria-label="Search rules"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {categories.length > 1 && (
                      <div className="vb-chips">
                        <button type="button" className="vb-chip" aria-pressed={category === ""} onClick={() => setCategory("")}>
                          All
                        </button>
                        {categories.map((c) => (
                          <button key={c} type="button" className="vb-chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? "" : c)}>
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {visibleGroups.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>No rules match that search.</p>}

                  {visibleGroups.map(([name, list]) => (
                    <div key={name}>
                      {(categories.length > 1 && !category) && <div className="vb-rule-group-label">{name}</div>}
                      {list.map((r) => {
                        const selected = ruleIds.includes(r.id);
                        const open = expanded.includes(r.id);
                        return (
                          <div key={r.id} className="vb-rule" data-selected={selected}>
                            <label className="vb-rule-main">
                              <input type="checkbox" className="vb-sr" checked={selected} onChange={() => toggleRule(r.id)} />
                              <span className="vb-rule-check" aria-hidden="true">
                                <Svg size={13}>
                                  <path d="m5 12 5 5 9-10" />
                                </Svg>
                              </span>
                              <span className="vb-rule-code">{r.code}</span>
                              <span className="vb-rule-title">{r.title}</span>
                            </label>
                            {r.description && (
                              <button
                                type="button"
                                className="vb-rule-info"
                                aria-expanded={open}
                                aria-label={`${open ? "Hide" : "Show"} the full text of ${r.code}`}
                                onClick={() => toggleExpanded(r.id)}
                              >
                                <ChevronDown />
                              </button>
                            )}
                            {r.description && (
                              <div className="vb-rule-desc" data-open={open}>
                                <div>
                                  <p>{r.description}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}

              {step === "templates" && (
                <>
                  <p className="vb-step-heading">Choose a template</p>
                  {relevantTemplates.map((t) => (
                    <button key={t.id} type="button" className="vb-template" onClick={() => pickTemplate(t)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</span>
                        {t.defaultDuration && <span className="vb-pill vb-pill-neutral">{formatDuration(t.defaultDuration)}</span>}
                        {t.defaultAppealable && <span className="vb-pill vb-pill-neutral">Appealable</span>}
                      </div>
                      <div className="vb-template-reason">{t.defaultReason}</div>
                    </button>
                  ))}
                </>
              )}

              {step === "details" && (
                <>
                  <div className="vb-source">
                    {via === "rules" && (
                      <>
                        <span>From</span>
                        {selectedRules.map((r) => (
                          <span key={r.id} className="vb-pill vb-pill-neutral" style={{ fontFamily: "ui-monospace, monospace" }}>
                            {r.code}
                          </span>
                        ))}
                      </>
                    )}
                    {via === "templates" && <span>From template: {selectedTemplate?.name}</span>}
                    {via === "manual" && <span>Written manually</span>}
                  </div>

                  <label className="vb-field">
                    Reason
                    <textarea className="vb-textarea" required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={2000} />
                  </label>

                  {active.hasDuration && <DurationInput label="Duration" seconds={durationSeconds} onChange={setDurationSeconds} required />}

                  {active.type === "BAN" && (
                    <label className="vb-option">
                      <span>
                        <span className="vb-option-title">Appealable</span>
                        <span className="vb-option-hint" style={{ display: "block" }}>
                          The player can submit an appeal
                        </span>
                      </span>
                      <input type="checkbox" className="vb-sr" checked={appealable} onChange={(e) => setAppealable(e.target.checked)} />
                      <span className="vb-switch" aria-hidden="true" />
                    </label>
                  )}

                  {active.hasIpBan && (
                    <label className="vb-option">
                      <span>
                        <span className="vb-option-title">Also ban their IP</span>
                        <span className="vb-option-hint" style={{ display: "block" }}>
                          Blocks any account on that network
                        </span>
                      </span>
                      <input type="checkbox" className="vb-sr" checked={ipBan} onChange={(e) => setIpBan(e.target.checked)} />
                      <span className="vb-switch" aria-hidden="true" />
                    </label>
                  )}

                  {error && (
                    <p className="vb-wiz-error" role="alert">
                      {error}
                    </p>
                  )}
                </>
              )}

              {step === "done" && (
                <div className="vb-done">
                  <span className="vb-done-ring">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  <h3>{issuedId ? `${active.label} issued` : "Request sent"}</h3>
                  {issuedId ? (
                    <p>
                      Ban ID <span className="vb-pill vb-pill-neutral" style={{ fontFamily: "ui-monospace, monospace" }}>{issuedId}</span>
                    </p>
                  ) : (
                    <p>It&apos;s waiting for review.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="vb-modal-foot">
            {step === "done" ? (
              <>
                <span className="vb-spacer" />
                <button type="button" className="vb-btn vb-btn-primary" onClick={requestClose}>
                  Done
                </button>
              </>
            ) : (
              <>
                {step !== "method" || skipMethod ? (
                  <button type="button" className="vb-btn vb-btn-quiet" onClick={back} disabled={submitting}>
                    Back
                  </button>
                ) : (
                  <button type="button" className="vb-btn vb-btn-quiet" onClick={requestClose}>
                    Cancel
                  </button>
                )}
                <span className="vb-spacer" />
                {step === "rules" && (
                  <button type="button" className="vb-btn vb-btn-primary" onClick={applyRules} disabled={ruleIds.length === 0}>
                    {ruleIds.length > 0 ? `Continue (${ruleIds.length})` : "Continue"}
                  </button>
                )}
                {step === "details" && (
                  <button type="submit" className="vb-btn vb-btn-primary" disabled={submitting}>
                    {submitting ? "Submitting…" : canIssueDirectly ? `Confirm ${active.label.toLowerCase()}` : "Send request"}
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {launchers}
      {createPortal(modal, document.body)}
    </>
  );
}
