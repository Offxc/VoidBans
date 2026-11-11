import { prisma } from "@/lib/prisma";

const SERVER_INFO_KEY = "site.server_info";

export interface ServerInfo {
  name: string;
  address: string;
  discordInvite: string;
}

const EMPTY: ServerInfo = { name: "", address: "", discordInvite: "" };

/** Only real Discord invite links, so the home page can't be made to link anywhere else. */
export function isValidDiscordInvite(url: string): boolean {
  return /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,64}$/.test(url);
}

/** A hostname or IP, with an optional port. Shown as text and copied, never linked. */
export function isValidServerAddress(address: string): boolean {
  return /^[A-Za-z0-9.-]{1,120}(:\d{1,5})?$/.test(address);
}

/**
 * What the public home page says about the server: its name, the address
 * to join, and a Discord invite. All optional, set by the owner in Settings.
 * Anything left blank simply isn't shown.
 */
export async function getServerInfo(): Promise<ServerInfo> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: SERVER_INFO_KEY } });
  const value = (setting?.value ?? {}) as Partial<Record<keyof ServerInfo, unknown>>;
  return {
    name: typeof value.name === "string" ? value.name : EMPTY.name,
    address: typeof value.address === "string" ? value.address : EMPTY.address,
    discordInvite: typeof value.discordInvite === "string" ? value.discordInvite : EMPTY.discordInvite,
  };
}

export async function setServerInfo(info: ServerInfo): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: SERVER_INFO_KEY },
    create: { key: SERVER_INFO_KEY, value: { ...info } },
    update: { value: { ...info } },
  });
}
