"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { discordAvatarUrl } from "@/lib/discord-avatar";
import { APP_VERSION } from "@/lib/version";

interface NavItem {
  href: string;
  label: string;
}

interface NavUser {
  username: string;
  discordId: string;
  avatarHash: string | null;
  isOwner: boolean;
}

const ICON_PATHS: Record<string, React.ReactNode> = {
  "/staff/bans": (
    <>
      <path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9" />
      <path d="M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z" />
    </>
  ),
  "/staff/appeals": (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  "/staff/players": (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  "/staff/templates": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  "/staff/rules": (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  "/staff/audit": (
    <>
      <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  "/staff/settings": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};

function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function BrandMark({ iconUrl }: { iconUrl: string | null }) {
  return (
    <Link href="/staff" className="vb-brand">
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt="" className="vb-brand-mark" />
      ) : (
        <span className="vb-brand-mark vb-brand-fallback">V</span>
      )}
      VoidBans
    </Link>
  );
}

export function StaffNav({ items, iconUrl, user }: { items: NavItem[]; iconUrl: string | null; user: NavUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on every navigation, otherwise picking a page from
  // the mobile menu leaves the overlay covering the page it just opened.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="vb-topbar">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="vb-nav-toggle vb-btn vb-btn-quiet"
          aria-label="Open navigation"
          style={{ padding: 6 }}
        >
          <Icon size={20}>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </Icon>
        </button>
        <BrandMark iconUrl={iconUrl} />
      </div>

      <div className="vb-nav-backdrop" data-open={open} onClick={() => setOpen(false)} />

      <nav className="vb-nav" data-open={open}>
        <div className="vb-nav-brand" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BrandMark iconUrl={iconUrl} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="vb-nav-close vb-btn vb-btn-quiet"
            aria-label="Close navigation"
            style={{ padding: 6 }}
          >
            <Icon size={16}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </Icon>
          </button>
        </div>

        <div className="vb-nav-links">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="vb-nav-link" aria-current={active ? "page" : undefined}>
                <Icon>{ICON_PATHS[item.href]}</Icon>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="vb-nav-version">VoidBans v{APP_VERSION}</div>

        <div className="vb-nav-user">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={discordAvatarUrl(user.discordId, user.avatarHash, 64)} alt="" width={32} height={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="vb-nav-user-name">{user.username}</div>
            <div className="vb-nav-user-role">{user.isOwner ? "Owner" : "Staff"}</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="vb-btn vb-btn-quiet" aria-label="Log out" title="Log out" style={{ padding: 6 }}>
              <Icon size={17}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </Icon>
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
