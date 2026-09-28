import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { fetchGuildMember } from "@/lib/discord";
import { isPermissionKey, type PermissionKey, type StaffPrincipal } from "@/lib/permissions";

/**
 * Resolves the current request's staff principal from the session cookie,
 * re-deriving permissions from the *current* Discord role -> permission
 * mapping every call (cheap DB reads, no caching of authorization data)
 * so a role change or removal in Discord takes effect immediately.
 */
export async function getStaffPrincipal(): Promise<StaffPrincipal | null> {
  const session = await readSession();
  if (!session) return null;

  const staffUser = await prisma.staffUser.findUnique({
    where: { discordId: session.discordId },
  });
  if (!staffUser) return null;

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
