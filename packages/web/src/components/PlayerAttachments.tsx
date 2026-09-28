"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";

interface Attachment {
  id: string;
  punishmentId: string | null;
  caption: string | null;
  authorUsername: string;
  createdAt: string;
}

export function PlayerAttachments({
  playerUuid,
  attachments,
  canWrite,
}: {
  playerUuid: string;
  attachments: Attachment[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (caption.trim()) form.set("caption", caption.trim());

      const res = await fetch(`/api/staff/players/${playerUuid}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Upload failed.");
        return;
      }
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/staff/attachments/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {attachments.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No attachments.</p>}

      {attachments.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {attachments.map((a) => (
            <div key={a.id} className="vb-card" style={{ padding: 8 }}>
              <img
                src={`/api/staff/attachments/${a.id}/image`}
                alt={a.caption ?? "Attachment"}
                style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6, display: "block" }}
              />
              {a.caption && <div style={{ fontSize: 13, marginTop: 6 }}>{a.caption}</div>}
              <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 4 }}>
                {a.authorUsername} · <LocalTime iso={a.createdAt} relative />
              </div>
              {canWrite && (
                <button
                  onClick={() => remove(a.id)}
                  className="vb-btn vb-btn-quiet"
                  style={{ marginTop: 6, fontSize: 11, padding: "3px 8px" }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <form onSubmit={upload} style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <input ref={fileRef} type="file" accept="image/png" required className="vb-input" style={{ maxWidth: 220 }} />
          <input
            className="vb-input"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            style={{ maxWidth: 200 }}
          />
          <button type="submit" disabled={submitting} className="vb-btn vb-btn-primary">
            {submitting ? "Uploading…" : "Upload"}
          </button>
          {error && <span style={{ color: "var(--danger)", fontSize: 13, alignSelf: "center" }}>{error}</span>}
        </form>
      )}
    </div>
  );
}
