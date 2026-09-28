import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { fetchGuildMember } from "@/lib/discord";
import { isPermissionKey, type PermissionKey, type StaffPrincipal } from "@/lib/permissions";

// How long a cached Discord nickname/role list is trusted before this
// re-fetches it from Discord. Role -> permission-key *mappings* are always
// read fresh (see below); this only bounds staleness of role membership
// and the nickname itself, which previously only refreshed at login —
// meaning a nickname change in Discord wouldn't show up here until the
// staff member's next 12h session expired and they signed in again.
const IDENTITY_REFRESH_MS = 5 * 60 * 1000;

/**
 * Resolves the current request's staff principal from the session cookie,
 * re-deriving permissions from the *current* Discord role -> permission
 * mapping every call (cheap DB reads, no caching of authorization data)
 * so a role change or removal in Discord takes effect immediately.
 */
export async function getStaffPrincipal(): Promise<StaffPrincipal | null> {
  const session = await readSession();
  if (!session) return null;

  let staffUser = await prisma.staffUser.findUnique({
    where: { discordId: session.discordId },
  });
  if (!staffUser) return null;

  const lastSynced = staffUser.lastLoginAt?.getTime() ?? 0;
  if (Date.now() - lastSynced > IDENTITY_REFRESH_MS) {
    // Best-effort: this now runs on every dashboard page load (not just
    // login, which already had its own try/catch around the whole OAuth
    // flow), so a transient Discord API hiccup here must not take down
    // every staff page — fall back to the still-valid cached row instead.
    try {
      staffUser = await refreshStaffIdentity(staffUser.discordId, staffUser.username);
    } catch (err) {
      console.error("Failed to refresh staff identity from Discord, using cached values:", err);
    }
  }

  if (staffUser.isOwner) {
    return {
      discordId: staffUser.discordId,
      username: staffUser.username,
      avatarHash: staffUser.avatarHash,
      isOwner: true,
      permissions: new Set(),
    };
  }

  const roleIds = Array.isArray(staffUser.discordRoles)
    ? (staffUser.discordRoles as string[])
    : [];

  if (roleIds.length === 0) return null;

  const grants = await prisma.staffPermission.findMany({
    where: { role: { discordRoleId: { in: roleIds } } },
    select: { permissionKey: true },
  });

  const permissions = new Set<PermissionKey>();
  for (const grant of grants) {
    if (isPermissionKey(grant.permissionKey)) permissions.add(grant.permissionKey);
  }

  if (permissions.size === 0) return null;

  return {
    discordId: staffUser.discordId,
    username: staffUser.username,
    avatarHash: staffUser.avatarHash,
    isOwner: false,
    permissions,
  };
}

/**
 * Called once per login after Discord identity is confirmed. Refreshes the
 * cached role list and, on a fresh install with no owner yet, promotes this
 * account to owner — the one-time implicit bootstrap the README must call
 * out loudly, since whoever logs in first on a new deploy owns the panel.
 *
 * `globalUsername` is the account's global Discord handle (from
 * `/users/@me`, always present); the guild member lookup's `nick` — the
 * server-specific nickname staff actually recognize each other by — takes
 * priority whenever the member has set one, since that's what shows up
 * everywhere `StaffUser.username` is used (header, audit log, punishment
 * records, appeal resolutions).
 */
export async function syncStaffUserOnLogin(discordId: string, globalUsername: string, avatarHash: string | null) {
  const member = await fetchGuildMember(discordId);
  const displayUsername = member.nick ?? globalUsername;
  const ownerExists = await prisma.staffUser.findFirst({ where: { isOwner: true } });

  await prisma.staffUser.upsert({
    where: { discordId },
    create: {
      discordId,
      username: displayUsername,
      avatarHash,
      discordRoles: member.roles,
      isOwner: !ownerExists,
      lastLoginAt: new Date(),
    },
    update: {
      username: displayUsername,
      avatarHash,
      discordRoles: member.roles,
      lastLoginAt: new Date(),
    },
  });
}

/**
 * Re-checks nickname + role membership against Discord outside of login,
 * so a nickname or role change in Discord shows up within
 * IDENTITY_REFRESH_MS instead of waiting for the staff member's next
 * sign-in (sessions last 12h — that's a long time to keep showing a
 * renamed/departed member's stale identity). No fresh OAuth token is
 * available here, so this can't re-check the global Discord username —
 * only the guild member lookup (nick + roles), which is exactly the part
 * that goes stale. Falls back to the currently stored username if the
 * member has no server nickname set, same priority order as login.
 */
async function refreshStaffIdentity(discordId: string, currentUsername: string) {
  const member = await fetchGuildMember(discordId);
  return prisma.staffUser.update({
    where: { discordId },
    data: {
      username: member.nick ?? currentUsername,
      discordRoles: member.roles,
      lastLoginAt: new Date(),
    },
  });
}
