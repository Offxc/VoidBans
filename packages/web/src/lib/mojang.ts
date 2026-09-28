const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export function normalizeUuid(raw: string): string {
  const hex = raw.replace(/-/g, "").toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface MojangProfile {
  uuid: string;
  username: string;
}

/**
 * Resolves a Minecraft username to its UUID via Mojang's public API, for
 * pre-banning a player who has never joined this server (so there's no
 * local players row to look up). Returns null for an unknown/invalid name
 * rather than throwing — "not found" is an expected, common result here,
 * not an error condition.
 */
export async function resolveMojangUsername(username: string): Promise<MojangProfile | null> {
  if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) return null;

  const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mojang API returned ${res.status}`);

  const body: { id: string; name: string } = await res.json();
  return { uuid: normalizeUuid(body.id), username: body.name };
}

/**
 * Resolves a raw UUID (with or without dashes) to its current username via
 * Mojang's profile API, so staff searching by UUID still get a username to
 * confirm against before pre-banning. Returns null if Mojang doesn't
 * recognize the UUID (e.g. a typo, or an account that no longer exists).
 */
export async function resolveMojangUuid(rawUuid: string): Promise<MojangProfile | null> {
  const hex = rawUuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  const uuid = normalizeUuid(hex);

  const res = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${hex}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mojang API returned ${res.status}`);

  const body: { id: string; name: string } = await res.json();
  return { uuid, username: body.name };
}

export function isUuidLike(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}
