"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Question {
  id: string;
  prompt: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
}

export function AppealQuestionEditor({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [newPrompt, setNewPrompt] = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!newPrompt.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/staff/settings/appeal-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: newPrompt.trim(), required: newRequired }),
      });
      setNewPrompt("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/staff/settings/appeal-questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    router.refresh();
  }

  return (
    <div style={{ marginTop: 16 }}>
      {questions.map((q) => (
        <div
          key={q.id}
          className="vb-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
            opacity: q.active ? 1 : 0.5,
          }}
        >
          <span style={{ flex: 1, fontSize: 14 }}>{q.prompt}</span>
          {q.required && <span className="vb-pill vb-pill-neutral">required</span>}
          <button onClick={() => toggleActive(q.id, q.active)} className="vb-btn vb-btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
            {q.active ? "Retire" : "Reactivate"}
          </button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <input
          className="vb-input"
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          placeholder="New question prompt"
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
          Required
        </label>
        <button onClick={add} disabled={busy} className="vb-btn vb-btn-primary" style={{ padding: "9px 14px", fontSize: 13 }}>
          Add
        </button>
      </div>
    </div>
  );
}
