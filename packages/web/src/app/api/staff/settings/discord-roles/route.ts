import { NextResponse } from "next/server";
import { getStaffPrincipal } from "@/lib/auth";

interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

export async function GET() {
  const principal = await getStaffPrincipal();
  if (!principal?.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) {
    return NextResponse.json({ error: "Discord bot not configured" }, { status: 500 });
  }

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch guild roles" }, { status: 502 });
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
