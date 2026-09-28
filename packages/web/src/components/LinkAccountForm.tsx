"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LinkAccountForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only offered after a real, failed lookup — not a way to skip without
  // ever trying, since most staff have joined the server and should link
  // immediately.
  const [hasFailedAttempt, setHasFailedAttempt] = useState(false);
  const [skipping, setSkipping] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/link-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        setHasFailedAttempt(true);
        return;
      }
      router.push("/staff");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function skipForNow() {
    setSkipping(true);
    try {
      await fetch("/api/staff/link-account/skip", { method: "POST" });
      router.push("/staff");
      router.refresh();
    } finally {
      setSkipping(false);
    }
  }

  return (
    <div style={{ width: "100%" }}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <input
          className="vb-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your Minecraft username"
          style={{ padding: "12px 14px", fontSize: 15, textAlign: "center" }}
        />
        <p style={{ color: "var(--text-dim)", fontSize: 12, margin: 0 }}>
          On Bedrock (Geyser/Floodgate)? Put a <code>.</code> at the start — e.g. <code>.Steve</code>.
        </p>
        {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
        <button type="submit" disabled={submitting} className="vb-btn vb-btn-primary" style={{ padding: "12px 22px" }}>
          {submitting ? "Linking…" : "Link account"}
        </button>
      </form>

      {hasFailedAttempt && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--glass-border)" }}>
          <p style={{ color: "var(--text-dim)", fontSize: 12.5, margin: "0 0 8px" }}>
            Haven&apos;t joined the server yet? You can continue without linking for now and come
            back to this once you have.
          </p>
          <button onClick={skipForNow} disabled={skipping} className="vb-btn vb-btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }}>
            {skipping ? "…" : "I'll do this later"}
          </button>
        </div>
      )}
    </div>
  );
}
