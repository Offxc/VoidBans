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

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Your appeal is pending review.",
  ACCEPTED: "Your appeal was accepted.",
  DENIED: "Your appeal was denied.",
};

export function AppealPanel({ banId, existingAppeal }: Props) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<AppealQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingAppeal) {
    return (
      <div className="vb-panel" style={{ marginTop: 24, padding: 20 }}>
        <strong>{STATUS_LABEL[existingAppeal.status]}</strong>
        {existingAppeal.staffResponse && (
          <p style={{ marginTop: 8, color: "var(--text-dim)" }}>{existingAppeal.staffResponse}</p>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="vb-panel" style={{ marginTop: 24, padding: 20 }}>
        <strong>Appeal submitted.</strong>
        <p style={{ marginTop: 8, color: "var(--text-dim)" }}>
          Staff will review it. Check back on this page for a response.
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
      <button onClick={openForm} className="vb-btn vb-btn-primary" style={{ marginTop: 24 }}>
        Appeal this punishment
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="vb-panel" style={{ marginTop: 24, padding: 20 }}>
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
