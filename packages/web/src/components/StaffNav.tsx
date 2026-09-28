"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

export function StaffNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="vb-panel"
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
      <div
        style={{
          padding: "0 8px 18px",
          fontWeight: 700,
          fontFamily: "var(--font-sora)",
          fontSize: 15,
          background: "linear-gradient(135deg, var(--text), var(--accent-2))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        VoidBans
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
  );
}
