import { prisma } from "@/lib/prisma";

// The plugin reads ENABLED_KEY every couple of seconds, so it has to stay a
// plain boolean. Who switched it on, and when, lives beside it for the site.
const ENABLED_KEY = "lockdown.enabled";
const META_KEY = "lockdown.meta";

export interface LockdownState {
  enabled: boolean;
  by: string | null;
  at: string | null;
}

/**
 * Maintenance mode. While it is on, the plugin kicks everyone who isn't
 * staff and turns away anyone else who tries to join.
 */
export async function getLockdown(): Promise<LockdownState> {
  const [enabledSetting, metaSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: ENABLED_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: META_KEY } }),
  ]);

  const enabled = enabledSetting?.value === true;
  const meta = (metaSetting?.value ?? {}) as { by?: unknown; at?: unknown };
  return {
    enabled,
    by: enabled && typeof meta.by === "string" ? meta.by : null,
    at: enabled && typeof meta.at === "string" ? meta.at : null,
  };
}

export async function setLockdown(enabled: boolean, by: string): Promise<void> {
  const meta = { by, at: new Date().toISOString() };
  await prisma.$transaction([
    prisma.siteSetting.upsert({
      where: { key: ENABLED_KEY },
      create: { key: ENABLED_KEY, value: enabled },
      update: { value: enabled },
    }),
    prisma.siteSetting.upsert({
      where: { key: META_KEY },
      create: { key: META_KEY, value: meta },
      update: { value: meta },
    }),
  ]);
}
