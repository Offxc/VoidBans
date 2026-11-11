"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

/**
 * Turns maintenance mode on or off. Either way it asks first: switching it
 * on removes every non-staff player from the server within a few seconds.
 */
export function LockdownControl({ enabled, serverConnected }: { enabled: boolean; serverConnected: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      triggerRef.current?.focus();
    };
  }, [open]);

  function close() {
    if (busy) return;
    setOpen(false);
    setError(null);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/lockdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) {
        setError("That didn't work. Try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const accent = enabled ? "success" : "warn";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`vb-btn ${enabled ? "vb-btn-success" : "vb-btn-warn"}`}
      >
        {enabled ? "End lockdown" : "Lock down server"}
      </button>

      {open &&
        createPortal(
          <div
            className="vb-modal-root"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              ref={dialogRef}
              className="vb-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="vb-lock-title"
              aria-describedby="vb-lock-body"
              tabIndex={-1}
              style={
                {
                  maxWidth: 460,
                  "--wiz-accent": `var(--${accent})`,
                  "--wiz-accent-soft": `var(--${accent}-soft)`,
                } as React.CSSProperties
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
            >
              <div className="vb-modal-head">
                <h2 id="vb-lock-title" className="vb-modal-title">
                  {enabled ? "End the lockdown?" : "Lock down the server?"}
                </h2>
              </div>
              <div className="vb-modal-body" id="vb-lock-body">
                {enabled ? (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>Players can join again straight away.</p>
                ) : (
                  <>
                    <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.55 }}>
                      Everyone except staff is kicked within a few seconds. Nobody else can join until you end it, and
                      they see a maintenance message.
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>
                      Staff are players with a Minecraft account linked here, or the{" "}
                      <code>voidbans.lockdown.bypass</code> permission.
                    </p>
                  </>
                )}
                {!serverConnected && (
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--warn)", lineHeight: 1.55 }}>
                    No server is connected right now. This takes effect when one connects.
                  </p>
                )}
                {error && (
                  <p className="vb-wiz-error" role="alert" style={{ marginTop: 12 }}>
                    {error}
                  </p>
                )}
              </div>
              <div className="vb-modal-foot">
                <button type="button" className="vb-btn vb-btn-quiet" onClick={close} disabled={busy}>
                  Cancel
                </button>
                <span className="vb-spacer" />
                <button
                  type="button"
                  className={`vb-btn ${enabled ? "vb-btn-success" : "vb-btn-warn"}`}
                  onClick={confirm}
                  disabled={busy}
                >
                  {busy ? "Working…" : enabled ? "End lockdown" : "Lock down"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
