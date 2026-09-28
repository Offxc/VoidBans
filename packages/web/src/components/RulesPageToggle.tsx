"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RulesPageToggle({ enabled: initialEnabled }: { enabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle(next: boolean) {
    setEnabled(next);
    setSaving(true);
    try {
      await fetch("/api/staff/settings/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
      <input type="checkbox" checked={enabled} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
      Show a public &quot;Server Rules&quot; page, built from the categories and rules below
    </label>
  );
}
