"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BanLookupForm() {
  const [value, setValue] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, width: "100%" }}>
      <input
        id="ban-id-input"
        className="vb-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter Ban ID"
        aria-label="Ban ID"
        style={{ padding: "12px 14px", fontSize: 15 }}
      />
      <button type="submit" className="vb-btn vb-btn-primary" style={{ padding: "12px 22px", fontSize: 15 }}>
        View
      </button>
    </form>
  );
}
