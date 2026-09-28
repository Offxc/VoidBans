export function discordAvatarUrl(discordId: string, avatarHash: string | null, size = 64): string {
  if (!avatarHash) {
    // Discord's default avatar, keyed off a hash of the user id for variety.
    const index = Number(BigInt(discordId) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=${size}`;
}
