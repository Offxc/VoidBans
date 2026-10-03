/**
 * The full set of permission keys the site understands. This list is the
 * actual authorization surface of the API, every route that guards a
 * sensitive action must check one of these server-side. The staff UI only
 * hides controls the viewer lacks; it never substitutes for this check.
 */
export const PERMISSION_KEYS = [
  "bans.view",
  "punish.ban",
  "punish.temp_ban",
  "punish.mute",
  "punish.temp_mute",
  "punish.kick",
  "punish.unban",
  "punish.unmute",
  "punish.unkick",
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
  "rules.view",
  "rules.create",
  "rules.edit",
  "audit.view",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "bans.view": "View the punishment list",
  "punish.ban": "Issue permanent bans",
  "punish.temp_ban": "Issue temporary bans",
  "punish.mute": "Issue permanent mutes",
  "punish.temp_mute": "Issue temporary mutes",
  "punish.kick": "Issue kicks",
  "punish.unban": "Revoke bans and temp bans",
  "punish.unmute": "Revoke mutes and temp mutes",
  "punish.unkick": "Remove kick and warn records",
  "bans.request": "Request a punishment they can't issue",
  "appeals.view": "View appeals",
  "appeals.resolve": "Accept or deny appeals",
  "players.view_roster": "View players and profiles",
  "players.view_sessions": "View sessions",
  "players.view_ip": "View IP addresses (needed for IP bans)",
  "players.notes": "View and add notes",
  "players.delete_notes": "Delete notes",
  "players.view_violations": "View anticheat violations",
  "players.view_attachments": "View attachments",
  "players.add_attachments": "Add attachments",
  "players.pre_ban": "Pre-register players who haven't joined",
  "templates.view": "View templates",
  "templates.create": "Create templates",
  "templates.edit": "Edit and delete templates",
  "rules.view": "View rules",
  "rules.create": "Create rules",
  "rules.edit": "Edit and delete rules",
  "audit.view": "View the audit log",
};

/** How the role editor groups the keys above. Every key must appear exactly once. */
export const PERMISSION_GROUPS: { title: string; keys: PermissionKey[] }[] = [
  {
    title: "Issue punishments",
    keys: ["punish.ban", "punish.temp_ban", "punish.mute", "punish.temp_mute", "punish.kick", "bans.request"],
  },
  { title: "Revoke punishments", keys: ["punish.unban", "punish.unmute", "punish.unkick"] },
  { title: "Punishment list and appeals", keys: ["bans.view", "appeals.view", "appeals.resolve"] },
  {
    title: "Players",
    keys: [
      "players.view_roster",
      "players.view_sessions",
      "players.view_ip",
      "players.view_violations",
      "players.notes",
      "players.delete_notes",
      "players.view_attachments",
      "players.add_attachments",
      "players.pre_ban",
    ],
  },
  { title: "Templates", keys: ["templates.view", "templates.create", "templates.edit"] },
  { title: "Rules", keys: ["rules.view", "rules.create", "rules.edit"] },
  { title: "Audit", keys: ["audit.view"] },
];

type PunishmentType = "BAN" | "MUTE" | "KICK" | "WARN";

/** The panel's action buttons, keyed the way PunishmentPanel names them. */
export const ISSUE_KEY_BY_ACTION = {
  ban: "punish.ban",
  temp_ban: "punish.temp_ban",
  mute: "punish.mute",
  temp_mute: "punish.temp_mute",
  kick: "punish.kick",
} as const satisfies Record<string, PermissionKey>;

export type PunishAction = keyof typeof ISSUE_KEY_BY_ACTION;

/**
 * Which permission issuing this punishment needs. A temporary ban and a
 * permanent ban are separate permissions, so what counts is whether a
 * duration was sent, not just the type. KICK and WARN have no duration.
 */
export function issueKeyFor(type: PunishmentType, hasDuration: boolean): PermissionKey {
  if (type === "BAN") return hasDuration ? "punish.temp_ban" : "punish.ban";
  if (type === "MUTE") return hasDuration ? "punish.temp_mute" : "punish.mute";
  return "punish.kick";
}

/** Which permission revoking an existing punishment of this type needs. */
export function revokeKeyFor(type: PunishmentType): PermissionKey {
  if (type === "BAN") return "punish.unban";
  if (type === "MUTE") return "punish.unmute";
  return "punish.unkick";
}

export const REVOKE_KEYS: PermissionKey[] = ["punish.unban", "punish.unmute", "punish.unkick"];

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
