"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LookupResult =
  | { found: "local" | "mojang"; uuid: string; username: string }
  | { found: "none"; hint?: string }
  | null;

/**
 * Lets staff find (or, for a Bedrock player, manually specify) a player
 * who has never joined this server, then creates a placeholder players
 * row so a punishment can be issued against them ahead of their first
 * connection. Search accepts a Java username (resolved via Mojang), a raw
 * UUID (Java via Mojang, or a Floodgate UUID staff already has on hand —
 * Mojang won't recognize those, so username must be typed in manually),
 * or a Bedrock ".name" (which can only ever match a local row, since
 * there's no public API to resolve a not-yet-joined Bedrock player's name
 * to a UUID).
 */
export function PreBanLookup({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<LookupResult>(null);
  const [manualUsername, setManualUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/staff/players/lookup?q=${encodeURIComponent(query.trim())}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Lookup failed.");
        return;
      }
      setResult(body);
      setManualUsername("");
    } finally {
      setSearching(false);
    }
  }

  async function createAndGo(uuid: string, username: string) {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/players/pre-ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid, username }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to create player.");
        return;
      }
      router.push(`/staff/players/${body.uuid}`);
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="vb-btn vb-btn-ghost" style={{ marginBottom: 16 }}>
        Find a player who hasn&apos;t joined
      </button>
    );
  }

  return (
    <div className="vb-panel" style={{ padding: 18, marginBottom: 16, maxWidth: 480 }}>
      <form onSubmit={search} style={{ display: "flex", gap: 8 }}>
        <input
          className="vb-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Username, .BedrockName, or UUID"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={searching || !query.trim()} className="vb-btn vb-btn-primary">
          {searching ? "Searching…" : "Search"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="vb-btn vb-btn-quiet">
          Close
        </button>
      </form>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{error}</p>}

      {result?.found === "local" && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <p style={{ margin: "0 0 8px" }}>
            {result.username} has already been seen on this server — go to their existing profile.
          </p>
          <button onClick={() => router.push(`/staff/players/${result.uuid}`)} className="vb-btn vb-btn-primary">
            Open profile
          </button>
        </div>
      )}

      {result?.found === "mojang" && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <p style={{ margin: "0 0 8px" }}>
            Found on Mojang: <strong>{result.username}</strong> ({result.uuid}) — hasn&apos;t joined this server
            yet.
          </p>
          {canCreate ? (
            <button
              onClick={() => createAndGo(result.uuid, result.username)}
              disabled={creating}
              className="vb-btn vb-btn-primary"
            >
              {creating ? "Creating…" : "Create profile & punish"}
            </button>
          ) : (
            <p style={{ color: "var(--text-dim)", margin: 0 }}>Missing players.pre_ban permission.</p>
          )}
        </div>
      )}

      {result?.found === "none" && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <p style={{ margin: "0 0 8px", color: "var(--text-dim)" }}>
            {result.hint ?? "No Mojang account found with that name."}
          </p>
          {canCreate && query.trim() && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="vb-input"
                placeholder="Username to record for this UUID"
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => createAndGo(query.trim(), manualUsername.trim())}
                disabled={creating || !manualUsername.trim()}
                className="vb-btn vb-btn-primary"
                title="Only works if what you searched was a UUID — a username can't be pre-created without a Mojang match"
              >
                {creating ? "Creating…" : "Create with this UUID"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
