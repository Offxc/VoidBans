import Link from "next/link";
import { discordAvatarUrl } from "@/lib/discord-avatar";

export function StaffHeader({
  username,
  discordId,
  avatarHash,
  isOwner,
  needsMinecraftLink,
}: {
  username: string;
  discordId: string;
  avatarHash: string | null;
  isOwner: boolean;
  needsMinecraftLink: boolean;
}) {
  return (
    <header
      className="vb-panel vb-header"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 18px",
        margin: "16px 16px 0",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={discordAvatarUrl(discordId, avatarHash, 64)}
        alt=""
        width={32}
        height={32}
        style={{ borderRadius: "50%", boxShadow: "0 0 0 2px var(--glass-border-strong)", flexShrink: 0 }}
      />
      <div style={{ fontSize: 13.5, lineHeight: 1.3, marginRight: "auto" }}>
        <div style={{ fontWeight: 600 }}>{username}</div>
        {isOwner && <div style={{ fontSize: 11, color: "var(--accent-2)" }}>Owner</div>}
      </div>
      {needsMinecraftLink && (
        <Link href="/staff/link-account" className="vb-pill vb-pill-warn" style={{ textDecoration: "none" }}>
          Set your Minecraft username
        </Link>
      )}
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="vb-btn vb-btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5, flexShrink: 0 }}>
          Log out
        </button>
      </form>
    </header>
  );
}
