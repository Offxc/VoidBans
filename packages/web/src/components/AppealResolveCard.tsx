"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  appealId: string;
  banId: string;
  playerUsername: string;
  reason: string;
  answers: { prompt: string; text: string }[];
  canResolve: boolean;
}

export function AppealResolveCard({ appealId, banId, playerUsername, reason, answers, canResolve }: Props) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [autoRevoke, setAutoRevoke] = useState(true);
  const [submitting, setSubmitting] = useState<"ACCEPTED" | "DENIED" | null>(null);

  async function resolve(decision: "ACCEPTED" | "DENIED") {
    setSubmitting(decision);
    try {
      const res = await fetch(`/api/staff/appeals/${appealId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          staffResponse: response,
          autoRevoke: decision === "ACCEPTED" ? autoRevoke : false,
        }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="vb-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
        <strong>{playerUsername}</strong>
        <a href={`/${banId}`} className="vb-pill" style={{ textDecoration: "none" }}>
          {banId}
        </a>
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>Banned for: {reason}</div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {answers.map((a, i) => (
          <div key={i} style={{ fontSize: 13 }}>
            <div style={{ color: "var(--text-dim)" }}>{a.prompt}</div>
            <div>{a.text}</div>
          </div>
        ))}
      </div>

      {canResolve && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(168, 130, 255, 0.1)" }}>
          <textarea
            className="vb-textarea"
            placeholder="Response to the player (optional)"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={2}
            style={{ fontSize: 13 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
            <input type="checkbox" checked={autoRevoke} onChange={(e) => setAutoRevoke(e.target.checked)} />
            Revoke the punishment if accepted
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => resolve("ACCEPTED")} disabled={submitting !== null} className="vb-btn vb-btn-success">
              {submitting === "ACCEPTED" ? "…" : "Accept"}
            </button>
            <button onClick={() => resolve("DENIED")} disabled={submitting !== null} className="vb-btn vb-btn-danger">
              {submitting === "DENIED" ? "…" : "Deny"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
