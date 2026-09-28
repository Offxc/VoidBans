import { prisma } from "@/lib/prisma";

const RULES_ENABLED_KEY = "rules.enabled";
const RULES_MARKDOWN_KEY = "rules.markdown";

export interface RulesConfig {
  enabled: boolean;
  markdown: string;
}

/**
 * Server rules, owner-editable Markdown stored in site_settings — same
 * pattern as the Vulcan integration toggle. Disabled by default so a
 * fresh deploy doesn't show an empty "Rules" button before the owner has
 * written anything.
 */
export async function getRulesConfig(): Promise<RulesConfig> {
  const [enabledSetting, markdownSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: RULES_ENABLED_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: RULES_MARKDOWN_KEY } }),
  ]);

  return {
    enabled: enabledSetting?.value === true,
    markdown: typeof markdownSetting?.value === "string" ? markdownSetting.value : "",
  };
}

export async function setRulesConfig(config: RulesConfig): Promise<void> {
  await prisma.$transaction([
    prisma.siteSetting.upsert({
      where: { key: RULES_ENABLED_KEY },
      create: { key: RULES_ENABLED_KEY, value: config.enabled },
      update: { value: config.enabled },
    }),
    prisma.siteSetting.upsert({
      where: { key: RULES_MARKDOWN_KEY },
      create: { key: RULES_MARKDOWN_KEY, value: config.markdown },
      update: { value: config.markdown },
    }),
  ]);
}
