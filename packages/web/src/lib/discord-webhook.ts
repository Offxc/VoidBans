import { prisma } from "@/lib/prisma";

const WEBHOOK_URL_KEY = "discord_webhook.url";
const WEBHOOK_EVENTS_KEY = "discord_webhook.events";

export const WEBHOOK_EVENT_KEYS = [
  "punishment_issued",
  "punishment_lifted",
  "note_added",
  "attachment_added",
  "appeal_submitted",
  "appeal_resolved",
] as const;

export type WebhookEventKey = (typeof WEBHOOK_EVENT_KEYS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventKey, string> = {
  punishment_issued: "Player punished",
  punishment_lifted: "Punishment lifted (revoked or appeal accepted)",
  note_added: "Note added to a player",
  attachment_added: "Attachment added to a player",
  appeal_submitted: "Appeal submitted",
  appeal_resolved: "Appeal resolved (accepted or denied)",
};

export interface DiscordWebhookConfig {
  url: string | null;
  events: Record<WebhookEventKey, boolean>;
}

function defaultEvents(): Record<WebhookEventKey, boolean> {
  return Object.fromEntries(WEBHOOK_EVENT_KEYS.map((k) => [k, true])) as Record<WebhookEventKey, boolean>;
}

/**
 * Discord webhook config (URL + which events post to it), owner-editable
 * in Settings. Stored in site_settings like every other toggle in this
 * app — never exposed through any non-owner-gated route, same trust
 * boundary as DISCORD_BOT_TOKEN, since the URL alone grants posting
 * rights to whatever channel it points at.
 */
export async function getDiscordWebhookConfig(): Promise<DiscordWebhookConfig> {
  const [urlSetting, eventsSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: WEBHOOK_URL_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: WEBHOOK_EVENTS_KEY } }),
  ]);

  const url = typeof urlSetting?.value === "string" ? urlSetting.value : null;
  const storedEvents = (eventsSetting?.value as Record<string, boolean> | undefined) ?? {};
  const events = defaultEvents();
  for (const key of WEBHOOK_EVENT_KEYS) {
    if (typeof storedEvents[key] === "boolean") events[key] = storedEvents[key];
  }

  return { url, events };
}

export async function setDiscordWebhookConfig(config: DiscordWebhookConfig): Promise<void> {
  const url = config.url?.trim() || null;
  if (url && !isValidDiscordWebhookUrl(url)) {
    throw new Error("Must be a discord.com or discordapp.com webhook URL.");
  }

  await prisma.$transaction([
    url
      ? prisma.siteSetting.upsert({
          where: { key: WEBHOOK_URL_KEY },
          create: { key: WEBHOOK_URL_KEY, value: url },
          update: { value: url },
        })
      : prisma.siteSetting.deleteMany({ where: { key: WEBHOOK_URL_KEY } }),
    prisma.siteSetting.upsert({
      where: { key: WEBHOOK_EVENTS_KEY },
      create: { key: WEBHOOK_EVENTS_KEY, value: config.events },
      update: { value: config.events },
    }),
  ]);
}

export function isValidDiscordWebhookUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    (url.hostname === "discord.com" || url.hostname === "discordapp.com") &&
    url.pathname.startsWith("/api/webhooks/")
  );
}

interface NotifyOptions {
  title: string;
  description: string;
  color: number;
  url?: string;
}

/**
 * Fire-and-forget: posts a Discord embed for a given event, if a webhook
 * URL is configured and that event is enabled. Never throws — a webhook
 * failure (bad URL, Discord outage, rate limit) must never break the
 * staff action that triggered it, so every call site can just await this
 * without a try/catch of its own.
 */
export async function notifyDiscordWebhook(event: WebhookEventKey, options: NotifyOptions): Promise<void> {
  try {
    const config = await getDiscordWebhookConfig();
    if (!config.url || !config.events[event]) return;

    await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: options.title,
            description: options.description,
            color: options.color,
            url: options.url,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (err) {
    console.error(`Discord webhook notification failed for event "${event}":`, err);
  }
}
