const DISCORD_API = "https://discord.com/api/v10";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function buildAuthorizeUrl(state: string): string {
  const clientId = requiredEnv("DISCORD_CLIENT_ID");
  const redirectUri = requiredEnv("DISCORD_REDIRECT_URI");

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const clientId = requiredEnv("DISCORD_CLIENT_ID");
  const clientSecret = requiredEnv("DISCORD_CLIENT_SECRET");
  const redirectUri = requiredEnv("DISCORD_REDIRECT_URI");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch Discord user: ${res.status}`);
  return res.json();
}

/**
 * Role IDs for this user within the configured guild. A bare `identify`
 * scope token cannot see guild roles, so this calls the guild member
 * endpoint with the bot token instead — the bot must be a member of
 * DISCORD_GUILD_ID with permission to view members.
 */
export async function fetchGuildMemberRoles(discordUserId: string): Promise<string[]> {
  const botToken = requiredEnv("DISCORD_BOT_TOKEN");
  const guildId = requiredEnv("DISCORD_GUILD_ID");

  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (res.status === 404) return []; // not a member of the guild -> no staff roles
  if (!res.ok) {
    throw new Error(`Failed to fetch guild member: ${res.status} ${await res.text()}`);
  }

  const member: { roles: string[] } = await res.json();
  return member.roles;
}
