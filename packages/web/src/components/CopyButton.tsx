"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (old browser, no permission). The text is on screen to select by hand.
    }
  }

  return (
    <button type="button" onClick={copy} className="vb-btn vb-btn-ghost" style={{ padding: "5px 12px", fontSize: 13 }}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
