"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

export function StaffNav({ items, iconUrl }: { items: NavItem[]; iconUrl: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on every navigation — otherwise picking a page from
  // the mobile menu leaves the overlay covering the page it just opened.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="vb-nav-toggle vb-btn vb-btn-ghost"
        aria-label="Open navigation"
        style={{ margin: "12px 0 0 12px", padding: "8px 10px" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="vb-nav-backdrop" data-open={open} onClick={() => setOpen(false)} />

      <nav
        className="vb-panel vb-nav"
        data-open={open}
        style={{
          width: 216,
          flexShrink: 0,
          margin: "16px 0 16px 16px",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
          height: "fit-content",
          position: "sticky",
          top: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {iconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt="" width={22} height={22} style={{ borderRadius: 6, flexShrink: 0 }} />
            )}
            <span
              style={{
                fontWeight: 700,
                fontFamily: "var(--font-sora)",
                fontSize: 15,
                background: "linear-gradient(135deg, var(--text), var(--accent-2))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              VoidBans
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="vb-nav-toggle vb-btn vb-btn-quiet"
            aria-label="Close navigation"
            style={{ padding: "4px 6px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "9px 12px",
                borderRadius: 9,
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                textDecoration: "none",
                color: active ? "var(--text)" : "var(--text-dim)",
                background: active ? "var(--accent-soft)" : "transparent",
                border: active ? "1px solid var(--glass-border-strong)" : "1px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
