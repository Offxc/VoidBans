"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";

interface Note {
  id: string;
  body: string;
  authorUsername: string;
  createdAt: string;
}

export function PlayerNotes({
  playerUuid,
  notes,
  canWrite,
}: {
  playerUuid: string;
  notes: Note[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/staff/players/${playerUuid}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {notes.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No notes.</p>}
      {notes.map((n) => (
        <div key={n.id} style={{ padding: "10px 0", borderTop: "1px solid rgba(168, 130, 255, 0.08)", fontSize: 14 }}>
          <div>{n.body}</div>
          <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 4 }}>
            {n.authorUsername} · <LocalTime iso={n.createdAt} relative />
          </div>
        </div>
      ))}

      {canWrite && (
        <form onSubmit={submit} style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <textarea
            className="vb-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note for other staff (not a punishment)…"
            rows={2}
            style={{ flex: 1, fontSize: 13 }}
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="vb-btn vb-btn-primary"
            style={{ alignSelf: "flex-start" }}
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
