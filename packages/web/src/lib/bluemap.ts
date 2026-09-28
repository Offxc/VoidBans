import { prisma } from "@/lib/prisma";

const BLUEMAP_ENABLED_KEY = "bluemap.enabled";
const BLUEMAP_URL_KEY = "bluemap.url";

export interface BlueMapConfig {
  enabled: boolean;
  url: string | null;
}

/**
 * BlueMap embed config, editable from Settings instead of BLUEMAP_URL in
 * .env — changing it no longer needs a container restart, and it's now an
 * explicit owner-controlled toggle (same pattern as the Vulcan integration
 * toggle) rather than "tab shows up whenever bluemap.view is granted,
 * regardless of whether a URL is actually set".
 */
export async function getBlueMapConfig(): Promise<BlueMapConfig> {
  const [enabledSetting, urlSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: BLUEMAP_ENABLED_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: BLUEMAP_URL_KEY } }),
  ]);

  const url = typeof urlSetting?.value === "string" ? urlSetting.value : null;
  const enabled = enabledSetting?.value === true && !!url;

  return { enabled, url };
}

export async function setBlueMapConfig(input: { enabled: boolean; url: string | null }): Promise<void> {
  const url = input.url?.trim() || null;
  if (url) {
    try {
      new URL(url);
    } catch {
      throw new Error("BlueMap URL must be a valid absolute URL.");
    }
  }

  await prisma.$transaction([
    prisma.siteSetting.upsert({
      where: { key: BLUEMAP_ENABLED_KEY },
      create: { key: BLUEMAP_ENABLED_KEY, value: input.enabled },
      update: { value: input.enabled },
    }),
    url
      ? prisma.siteSetting.upsert({
          where: { key: BLUEMAP_URL_KEY },
          create: { key: BLUEMAP_URL_KEY, value: url },
          update: { value: url },
        })
      : prisma.siteSetting.deleteMany({ where: { key: BLUEMAP_URL_KEY } }),
  ]);
}
