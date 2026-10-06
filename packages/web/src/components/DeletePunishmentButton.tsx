"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

/**
 * Owner-only permanent delete for one punishment record. Asks first and
 * says what goes with it, because there is no undo.
 */
export function DeletePunishmentButton({
  punishmentId,
  banId,
  playerName,
  stillInForce,
}: {
  punishmentId: string;
  banId: string;
  playerName: string;
  stillInForce: boolean;
}) {
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

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/punishments/${punishmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Couldn't delete it. Try again.");
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

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="vb-btn vb-btn-quiet"
        style={{ padding: "3px 10px", fontSize: 12, color: "var(--danger)" }}
      >
        Delete
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
              aria-labelledby="vb-del-title"
              aria-describedby="vb-del-body"
              tabIndex={-1}
              style={{ maxWidth: 460, "--wiz-accent": "var(--danger)", "--wiz-accent-soft": "var(--danger-soft)" } as React.CSSProperties}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
            >
              <div className="vb-modal-head">
                <div style={{ minWidth: 0 }}>
                  <h2 id="vb-del-title" className="vb-modal-title">
                    Delete {banId}?
                  </h2>
                  <p className="vb-modal-sub">{playerName}</p>
                </div>
              </div>
              <div className="vb-modal-body" id="vb-del-body">
                <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.55 }}>
                  This removes it from their history for good, along with its appeal and any attachments on it. There is
                  no undo.
                </p>
                {stillInForce && (
                  <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.55, color: "var(--warn)" }}>
                    It is still in force. Deleting it lifts it straight away.
                  </p>
                )}
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>The audit log keeps a record that it was deleted.</p>
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
                <button type="button" className="vb-btn vb-btn-danger" onClick={remove} disabled={busy}>
                  {busy ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
