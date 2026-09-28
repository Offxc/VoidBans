import { discordAvatarUrl } from "@/lib/discord-avatar";

export function StaffHeader({
  username,
  discordId,
  avatarHash,
  isOwner,
}: {
  username: string;
  discordId: string;
  avatarHash: string | null;
  isOwner: boolean;
}) {
  return (
    <header
      className="vb-panel"
      style={{
        display: "flex",
        justifyContent: "flex-end",
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
        style={{ borderRadius: "50%", boxShadow: "0 0 0 2px var(--glass-border-strong)" }}
      />
      <div style={{ fontSize: 13.5, lineHeight: 1.3 }}>
        <div style={{ fontWeight: 600 }}>{username}</div>
        {isOwner && <div style={{ fontSize: 11, color: "var(--accent-2)" }}>Owner</div>}
      </div>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="vb-btn vb-btn-ghost" style={{ marginLeft: 8, padding: "6px 12px", fontSize: 12.5 }}>
          Log out
        </button>
      </form>
    </header>
  );
}
