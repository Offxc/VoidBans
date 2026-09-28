import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { LivePlayerRoster } from "@/components/LivePlayerRoster";
import { PreBanLookup } from "@/components/PreBanLookup";

export default async function PlayersPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.view_roster")) redirect("/staff");

  const [online, offline] = await Promise.all([
    prisma.player.findMany({
      where: { isOnline: true },
      orderBy: { username: "asc" },
      select: { uuid: true, username: true, lastLogout: true },
    }),
    prisma.player.findMany({
      where: { isOnline: false },
      orderBy: { lastLogout: "desc" },
      take: 100,
      select: { uuid: true, username: true, lastLogout: true },
    }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Players</h1>

      {hasPermission(principal, "players.pre_ban") && <PreBanLookup canCreate />}

      <LivePlayerRoster
        initialOnline={online.map((p) => ({ ...p, lastLogout: p.lastLogout?.toISOString() ?? null }))}
        initialOffline={offline.map((p) => ({ ...p, lastLogout: p.lastLogout?.toISOString() ?? null }))}
      />
    </div>
  );
}
