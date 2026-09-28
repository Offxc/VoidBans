import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { fetchGuildMemberRoles } from "@/lib/discord";
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
 */
export async function syncStaffUserOnLogin(discordId: string, username: string, avatarHash: string | null) {
  const roles = await fetchGuildMemberRoles(discordId);
  const ownerExists = await prisma.staffUser.findFirst({ where: { isOwner: true } });

  await prisma.staffUser.upsert({
    where: { discordId },
    create: {
      discordId,
      username,
      avatarHash,
      discordRoles: roles,
      isOwner: !ownerExists,
      lastLoginAt: new Date(),
    },
    update: {
      username,
      avatarHash,
      discordRoles: roles,
      lastLoginAt: new Date(),
    },
  });
}
