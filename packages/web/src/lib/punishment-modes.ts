import { prisma } from "@/lib/prisma";

const TEMPLATES_ENABLED_KEY = "punishing.templates_enabled";
const RULES_ENABLED_KEY = "punishing.rules_enabled";

export interface PunishmentModes {
  templatesEnabled: boolean;
  rulesEnabled: boolean;
}

/**
 * Owner-controlled, site-wide toggles for which punishment-selection modes
 * show up in the punish panel (manual entry is always available). Both can
 * be on at once — templates and rules are allowed to overlap; the owner
 * decides what staff see. Templates defaults ON since it's the existing,
 * already-in-use behavior; rules defaults OFF since it's new and opt-in,
 * same "off until the owner turns it on" convention as the Vulcan toggle.
 */
export async function getPunishmentModes(): Promise<PunishmentModes> {
  const [templatesSetting, rulesSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: TEMPLATES_ENABLED_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: RULES_ENABLED_KEY } }),
  ]);

  return {
    templatesEnabled: templatesSetting ? templatesSetting.value === true : true,
    rulesEnabled: rulesSetting?.value === true,
  };
}

export async function setPunishmentModes(modes: PunishmentModes): Promise<void> {
  await prisma.$transaction([
    prisma.siteSetting.upsert({
      where: { key: TEMPLATES_ENABLED_KEY },
      create: { key: TEMPLATES_ENABLED_KEY, value: modes.templatesEnabled },
      update: { value: modes.templatesEnabled },
    }),
    prisma.siteSetting.upsert({
      where: { key: RULES_ENABLED_KEY },
      create: { key: RULES_ENABLED_KEY, value: modes.rulesEnabled },
      update: { value: modes.rulesEnabled },
    }),
  ]);
}
