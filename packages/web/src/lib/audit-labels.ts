/**
 * Display names for audit actions. Kept free of server-only imports so both
 * the viewer page and the CSV export can share it. An action missing from
 * here still renders, it just falls back to its raw key.
 */
export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Sign-in failed",
  "auth.logout": "Signed out",
  "access.denied": "Access denied",
  "ratelimit.exceeded": "Rate limit hit",
  "punishment.issue": "Punishment issued",
  "punishment.revoke": "Punishment revoked",
  "appeal.submit": "Appeal submitted",
  "appeal.accepted": "Appeal accepted",
  "appeal.denied": "Appeal denied",
  "player.note.create": "Note added",
  "player.note.delete": "Note deleted",
  "player.attachment.create": "Attachment added",
  "player.attachment.delete": "Attachment deleted",
  "player.pre_ban.create": "Player pre-registered",
  "staff.link_account": "Minecraft account linked",
  "staff.link_skip": "Account linking skipped",
  "template.create": "Template created",
  "template.update": "Template edited",
  "template.delete": "Template deleted",
  "rule.create": "Rule created",
  "rule.update": "Rule edited",
  "rule.delete": "Rule deleted",
  "rule_category.create": "Rule category created",
  "rule_category.update": "Rule category edited",
  "rule_category.delete": "Rule category deleted",
  "appeal_question.create": "Appeal question created",
  "appeal_question.update": "Appeal question edited",
  "appeal_question.delete": "Appeal question deleted",
  "role.permissions.update": "Role permissions changed",
  "settings.punishment_modes.update": "Punishment modes changed",
  "settings.rules_page.update": "Rules page toggled",
  "settings.integrations.update": "Integrations changed",
  "settings.discord_webhook.update": "Discord webhook changed",
  "settings.icon.update": "Site icon changed",
  "audit.export": "Audit log exported",
};

/** The first dotted segment, used as the filter group ("punishment", "auth"…). */
export function actionArea(action: string): string {
  return action.split(".")[0] ?? action;
}

export const ACTION_AREAS = [
  "auth",
  "access",
  "punishment",
  "appeal",
  "player",
  "staff",
  "template",
  "rule",
  "rule_category",
  "appeal_question",
  "role",
  "settings",
  "ratelimit",
  "audit",
] as const;
