"use client";

import { useState } from "react";

interface AppealQuestion {
  id: string;
  prompt: string;
  required: boolean;
}

interface Props {
  banId: string;
  existingAppeal: { status: "PENDING" | "ACCEPTED" | "DENIED"; staffResponse: string | null } | null;
}

const STATUS: Record<string, { label: string; pill: string }> = {
  PENDING: { label: "Pending review", pill: "vb-pill-warn" },
  ACCEPTED: { label: "Accepted", pill: "vb-pill-success" },
  DENIED: { label: "Denied", pill: "vb-pill-danger" },
};

export function AppealPanel({ banId, existingAppeal }: Props) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<AppealQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingAppeal) {
    const status = STATUS[existingAppeal.status]!;
    return (
      <div className="vb-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 14.5 }}>Your appeal</strong>
          <span className={`vb-pill ${status.pill}`}>{status.label}</span>
        </div>
        {existingAppeal.staffResponse && (
          <p style={{ margin: "12px 0 0", color: "var(--text-dim)", fontSize: 14 }}>
            <span style={{ color: "var(--text-faint)" }}>Staff response: </span>
            {existingAppeal.staffResponse}
          </p>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="vb-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 14.5 }}>Appeal submitted</strong>
          <span className="vb-pill vb-pill-warn">Pending review</span>
        </div>
        <p style={{ margin: "10px 0 0", color: "var(--text-dim)", fontSize: 14 }}>
          Check back on this page for a response.
        </p>
      </div>
    );
  }

  async function openForm() {
    setOpen(true);
    if (questions) return;
    const res = await fetch("/api/appeal-questions");
    if (res.ok) setQuestions(await res.json());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bans/${banId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong.");
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="vb-panel" style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <span style={{ color: "var(--text-dim)", fontSize: 14 }}>You can appeal this once.</span>
        <button onClick={openForm} className="vb-btn vb-btn-primary">
          Start appeal
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="vb-panel" style={{ padding: 20 }}>
      {!questions && <p style={{ color: "var(--text-dim)" }}>Loading questions…</p>}
      {questions?.map((q) => (
        <label key={q.id} style={{ display: "block", marginBottom: 14, fontSize: 14 }}>
          <span>
            {q.prompt} {q.required && <span style={{ color: "var(--danger)" }}>*</span>}
          </span>
          <textarea
            className="vb-textarea"
            required={q.required}
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
            rows={3}
            style={{ marginTop: 6 }}
          />
        </label>
      ))}
      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
      <button type="submit" disabled={submitting || !questions} className="vb-btn vb-btn-primary">
        {submitting ? "Submitting…" : "Submit appeal"}
      </button>
    </form>
  );
}
