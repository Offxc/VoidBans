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
    <form onSubmit={handleSubmit} className="vb-lookup">
      <input
        id="ban-id-input"
        className="vb-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter your ID"
        aria-label="Punishment ID"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="vb-btn vb-btn-primary">
        Look up
      </button>
    </form>
  );
}
