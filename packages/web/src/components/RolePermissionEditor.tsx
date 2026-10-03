"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_GROUPS, PERMISSION_LABELS, type PermissionKey } from "@/lib/permissions";

interface DiscordRole {
  id: string;
  name: string;
  color: string | null;
}

interface MappedRole {
  id: string;
  discordRoleId: string;
  displayName: string;
  permissions: string[];
}

function labelFor(key: string): string {
  return PERMISSION_LABELS[key as PermissionKey] ?? key;
}

export function RolePermissionEditor({ roles }: { roles: MappedRole[] }) {
  const router = useRouter();
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDiscordRoleId, setSelectedDiscordRoleId] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/staff/settings/discord-roles")
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.detail || body.error || `HTTP ${r.status}`);
        return body as DiscordRole[];
      })
      .then(setDiscordRoles)
      .catch((err) => setLoadError(String(err.message || err)));
  }, []);

  function selectRole(discordRoleId: string) {
    setSelectedDiscordRoleId(discordRoleId);
    const existing = roles.find((r) => r.discordRoleId === discordRoleId);
    setChecked(new Set(existing?.permissions ?? []));
    // Clicking "Edit" on a row further down the already-mapped-roles
    // table otherwise leaves the checkbox editor off-screen above it.
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function toggleGroup(keys: readonly string[]) {
    setChecked((prev) => {
      const next = new Set(prev);
      const allOn = keys.every((k) => next.has(k));
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function save() {
    const discordRole = discordRoles?.find((r) => r.id === selectedDiscordRoleId);
    if (!discordRole) return;
    setSaving(true);
    try {
      await fetch("/api/staff/settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordRoleId: discordRole.id,
          discordRoleName: discordRole.name,
          displayName: discordRole.name,
          color: discordRole.color,
          permissions: Array.from(checked),
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select
          className="vb-select"
          value={selectedDiscordRoleId}
          onChange={(e) => selectRole(e.target.value)}
          disabled={!!loadError}
          style={{ minWidth: 240 }}
        >
          <option value="">
            {loadError
              ? "Failed to load Discord roles"
              : discordRoles === null
                ? "Loading Discord roles…"
                : "Select a Discord role"}
          </option>
          {discordRoles?.map((r) => {
            const mapped = roles.find((role) => role.discordRoleId === r.id);
            return (
              <option key={r.id} value={r.id}>
                {r.name} {mapped ? `(${mapped.permissions.length} perms)` : ""}
              </option>
            );
          })}
        </select>
      </div>

      {loadError && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>
          Couldn&apos;t load Discord roles: {loadError}. Check <code>DISCORD_BOT_TOKEN</code> and{" "}
          <code>DISCORD_GUILD_ID</code>, and that the bot is actually a member of the server.
        </p>
      )}

      {selectedDiscordRoleId && (
        <div ref={editorRef}>
          <div className="vb-panel" style={{ display: "flex", flexDirection: "column", gap: 20, padding: 16 }}>
            {PERMISSION_GROUPS.map((group) => {
              const allOn = group.keys.every((k) => checked.has(k));
              return (
                <section key={group.title}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{group.title}</h3>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.keys)}
                      className="vb-btn vb-btn-quiet"
                      style={{ padding: "2px 8px", fontSize: 12 }}
                    >
                      {allOn ? "Clear" : "Select all"}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 4 }}>
                    {group.keys.map((key) => (
                      <label
                        key={key}
                        style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, padding: "6px 4px", minHeight: 36, cursor: "pointer" }}
                      >
                        <input type="checkbox" checked={checked.has(key)} onChange={() => toggle(key)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                        <span>{labelFor(key)}</span>
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <button onClick={save} disabled={saving} className="vb-btn vb-btn-primary" style={{ marginTop: 10 }}>
            {saving ? "Saving…" : "Save role"}
          </button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
      <table className="vb-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Permissions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.displayName}</td>
              <td style={{ color: "var(--text-dim)", maxWidth: 420 }}>
                {r.permissions.length === 0 ? (
                  "none"
                ) : (
                  <span title={r.permissions.map(labelFor).join("\n")}>
                    {r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"}
                  </span>
                )}
              </td>
              <td>
                <button
                  onClick={() => selectRole(r.discordRoleId)}
                  className="vb-btn vb-btn-quiet"
                  style={{ fontSize: 12, padding: "3px 10px" }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {roles.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: "var(--text-dim)" }}>
                No roles mapped yet. Select one above to grant it permissions.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
