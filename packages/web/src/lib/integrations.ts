import { prisma } from "@/lib/prisma";

const VULCAN_SETTING_KEY = "integrations.vulcan.enabled";

/**
 * Whether the Vulcan violation-history UI should render at all. This is a
 * site-wide, owner-controlled toggle stored in site_settings — separate
 * from any per-staff permission (players.view_violations), which controls
 * who can see it once it's on. Disabling this hides the UI everywhere;
 * it does not delete already-recorded ViolationEvent rows.
 */
export async function isVulcanIntegrationEnabled(): Promise<boolean> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: VULCAN_SETTING_KEY } });
  if (!setting) return false; // opt-in: off until the owner turns it on
  return setting.value === true;
}

export async function setVulcanIntegrationEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: VULCAN_SETTING_KEY },
    create: { key: VULCAN_SETTING_KEY, value: enabled },
    update: { value: enabled },
  });
}
