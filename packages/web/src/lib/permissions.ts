/**
 * The full set of permission keys the site understands. This list is the
 * actual authorization surface of the API — every route that guards a
 * sensitive action must check one of these server-side. The staff UI only
 * hides controls the viewer lacks; it never substitutes for this check.
 */
export const PERMISSION_KEYS = [
  "bans.view",
  "bans.issue",
  "bans.revoke",
  "bans.request",
  "appeals.view",
  "appeals.resolve",
  "players.view_roster",
  "players.view_sessions",
  "players.view_ip",
  "players.notes",
  "players.delete_notes",
  "players.view_violations",
  "players.view_attachments",
  "players.add_attachments",
  "players.pre_ban",
  "templates.view",
  "templates.create",
  "templates.edit",
  "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/**
 * A signed-in staff member's resolved identity + effective permission set,
 * as computed fresh on every login and periodically refreshed. Owner status
 * bypasses the permission set entirely rather than being modeled as a key,
 * per the plan: it is tied to a Discord ID, not a reassignable role.
 */
export interface StaffPrincipal {
  discordId: string;
  username: string;
  avatarHash: string | null;
  isOwner: boolean;
  permissions: Set<PermissionKey>;
}

export function hasPermission(principal: StaffPrincipal, key: PermissionKey): boolean {
  return principal.isOwner || principal.permissions.has(key);
}

export function requirePermission(principal: StaffPrincipal | null, key: PermissionKey): void {
  if (!principal || !hasPermission(principal, key)) {
    throw new PermissionError(key);
  }
}

export class PermissionError extends Error {
  constructor(public readonly key: PermissionKey) {
    super(`Missing permission: ${key}`);
    this.name = "PermissionError";
  }
}
