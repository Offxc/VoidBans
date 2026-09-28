import { prisma } from "@/lib/prisma";

const RULES_PAGE_ENABLED_KEY = "rules.page_enabled";

/**
 * Whether the public /rules page shows a "Server Rules" button on the
 * homepage — independent of punishing.rules_enabled (whether staff can
 * cite a rule when punishing), since a server might want one without the
 * other. Off by default so a fresh deploy doesn't show an empty page
 * before any rules exist.
 */
export async function isRulesPageEnabled(): Promise<boolean> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: RULES_PAGE_ENABLED_KEY } });
  return setting?.value === true;
}

export async function setRulesPageEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: RULES_PAGE_ENABLED_KEY },
    create: { key: RULES_PAGE_ENABLED_KEY, value: enabled },
    update: { value: enabled },
  });
}

/**
 * Rules grouped by category, in display order — the single source both
 * the public /rules page and the staff punish-panel rule picker render
 * from. Only active rules and only within their category's sortOrder,
 * then each rule's own sortOrder.
 */
export async function getRulesByCategory() {
  return prisma.ruleCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      rules: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}
