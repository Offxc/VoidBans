"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeButton({ punishmentId }: { punishmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function revoke() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/staff/punishments/${punishmentId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeReason: reason.trim() || undefined }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="vb-btn vb-btn-ghost" style={{ padding: "3px 10px", fontSize: 12 }}>
        Revoke
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        className="vb-input"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        style={{ fontSize: 12, padding: "4px 8px", width: 160 }}
      />
      <button onClick={revoke} disabled={submitting} className="vb-btn vb-btn-danger" style={{ padding: "3px 10px", fontSize: 12 }}>
        {submitting ? "…" : "Confirm"}
      </button>
      <button onClick={() => setOpen(false)} className="vb-btn vb-btn-quiet" style={{ padding: "3px 10px", fontSize: 12 }}>
        Cancel
      </button>
    </div>
  );
}
