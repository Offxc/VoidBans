import { NextResponse } from "next/server";
import { denyAccess } from "@/lib/audit";
import { getStaffPrincipal } from "@/lib/auth";

interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

export async function GET() {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return denyAccess(principal);

  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) {
    return NextResponse.json({ error: "Discord bot not configured" }, { status: 500 });
  }

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) {
    // Surface Discord's actual response (e.g. "50001 Missing Access" if the
    // bot was never invited to this guild, "401 Unauthorized" for a bad
    // token) instead of a generic message — this is exactly the kind of
    // credential mixup that's already bitten OAuth login twice.
    const detail = await res.text().catch(() => "");
    console.error(`Discord guild roles fetch failed: ${res.status} ${detail}`);
    return NextResponse.json(
      { error: `Discord API error ${res.status}`, detail },
      { status: 502 },
    );
  }

  const roles: DiscordRole[] = await res.json();
  return NextResponse.json(
    roles
      .filter((r) => r.name !== "@everyone")
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : null,
      })),
  );
}
