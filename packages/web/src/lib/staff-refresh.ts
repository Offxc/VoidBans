import { prisma } from "@/lib/prisma";
import { fetchGuildMember } from "@/lib/discord";

/**
 * Keeps every staff member's cached Discord roles current in the background.
 *
 * The site already re-reads a person's roles while they browse it, but the plugin decides what a staff member may do
 * in game from the same cached roles. Without this, someone who is promoted, demoted or leaves keeps their old
 * permissions in game until they next visit the site.
 */

const EVERY_MS = 5 * 60 * 1000;
// Spaced out so a full pass never comes near Discord's rate limits.
const BETWEEN_MS = 1000;

const state = globalThis as unknown as { staffRefresh?: ReturnType<typeof setInterval>; staffRefreshing?: boolean };

export async function refreshAllStaff(): Promise<void> {
  const staff = await prisma.staffUser.findMany({ select: { discordId: true, username: true } });
  for (const user of staff) {
    try {
      // Someone who has left the server comes back with no roles. Anything else that goes wrong throws, and the
      // cached roles are kept rather than taking access away because Discord had a bad moment.
      const member = await fetchGuildMember(user.discordId);
      await prisma.staffUser.update({
        where: { discordId: user.discordId },
        data: { discordRoles: member.roles, username: member.nick ?? user.username },
      });
    } catch (err) {
      console.error(`Couldn't refresh the Discord roles of ${user.username}:`, err instanceof Error ? err.message : err);
    }
    await new Promise((resolve) => setTimeout(resolve, BETWEEN_MS));
  }
}

export function startStaffRefresh(): void {
  if (state.staffRefresh) return;
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) return;

  const run = async () => {
    if (state.staffRefreshing) return;
    state.staffRefreshing = true;
    try {
      await refreshAllStaff();
    } catch (err) {
      console.error("Staff role refresh failed:", err instanceof Error ? err.message : err);
    } finally {
      state.staffRefreshing = false;
    }
  };

  state.staffRefresh = setInterval(run, EVERY_MS);
  // Shortly after startup, once the database connection has had a chance to come up.
  setTimeout(run, 15_000);
}
