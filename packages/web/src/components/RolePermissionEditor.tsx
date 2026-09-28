"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export function RolePermissionEditor({
  allPermissions,
  roles,
}: {
  allPermissions: readonly string[];
  roles: MappedRole[];
}) {
  const router = useRouter();
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[] | null>(null);
  const [selectedDiscordRoleId, setSelectedDiscordRoleId] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/staff/settings/discord-roles")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDiscordRoles)
      .catch(() => setDiscordRoles([]));
  }, []);

  function selectRole(discordRoleId: string) {
    setSelectedDiscordRoleId(discordRoleId);
    const existing = roles.find((r) => r.discordRoleId === discordRoleId);
    setChecked(new Set(existing?.permissions ?? []));
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
          style={{ minWidth: 240 }}
        >
          <option value="">
            {discordRoles === null ? "Loading Discord roles…" : "Select a Discord role"}
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

      {selectedDiscordRoleId && (
        <div>
          <div
            className="vb-panel"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 8,
              padding: 16,
            }}
          >
            {allPermissions.map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={checked.has(key)} onChange={() => toggle(key)} />
                <code style={{ fontFamily: "ui-monospace, monospace" }}>{key}</code>
              </label>
            ))}
          </div>
          <button onClick={save} disabled={saving} className="vb-btn vb-btn-primary" style={{ marginTop: 10 }}>
            {saving ? "Saving…" : "Save role"}
          </button>
        </div>
      )}

      <table className="vb-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.displayName}</td>
              <td style={{ color: "var(--text-dim)" }}>{r.permissions.join(", ") || "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
