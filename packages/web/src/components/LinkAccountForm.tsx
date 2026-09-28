"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LinkAccountForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        return;
      }
      router.push("/staff");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      <input
        className="vb-input"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Your Minecraft username"
        style={{ padding: "12px 14px", fontSize: 15, textAlign: "center" }}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button type="submit" disabled={submitting} className="vb-btn vb-btn-primary" style={{ padding: "12px 22px" }}>
        {submitting ? "Linking…" : "Link account"}
      </button>
    </form>
  );
}
