import WebSocket from "ws";

/**
 * Keeps the Discord bot showing as online.
 *
 * The site only uses the bot token for plain REST calls (reading a member's
 * roles), and a bot is only shown as online while something holds a gateway
 * connection open for it. This holds one: it identifies with no intents (so it
 * receives almost nothing and needs no privileged permissions), sets a status,
 * and then just stays connected, resuming or reconnecting when Discord asks.
 * It gives the bot no new abilities.
 */

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

// Close codes after which reconnecting can never work, so we stop and say why.
const FATAL_CLOSE_CODES: Record<number, string> = {
  4004: "the bot token was rejected (check DISCORD_BOT_TOKEN)",
  4010: "invalid shard",
  4011: "sharding required",
  4012: "invalid gateway version",
  4013: "invalid intents",
  4014: "disallowed intents",
};

// Close codes where the session can't be resumed, only started again.
const RESET_SESSION_CODES = new Set([4007, 4009]);

export interface PresenceOptions {
  token: string;
  /** Text shown after "Watching". */
  activity?: string;
  url?: string;
  /** Test hooks. */
  randomizeFirstHeartbeat?: boolean;
  minBackoffMs?: number;
  maxBackoffMs?: number;
  log?: (message: string) => void;
}

type GatewayPayload = { op: number; d?: any; s?: number | null; t?: string | null };

export class BotPresence {
  private readonly token: string;
  private readonly activity: string | null;
  private readonly url: string;
  private readonly randomizeFirst: boolean;
  private readonly minBackoff: number;
  private readonly maxBackoff: number;
  private readonly log: (message: string) => void;

  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval = 0;
  private acked = true;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = false;
  private everReady = false;

  constructor(options: PresenceOptions) {
    this.token = options.token;
    this.activity = options.activity?.trim() || null;
    this.url = options.url ?? GATEWAY_URL;
    this.randomizeFirst = options.randomizeFirstHeartbeat ?? true;
    this.minBackoff = options.minBackoffMs ?? 1_000;
    this.maxBackoff = options.maxBackoffMs ?? 60_000;
    this.log = options.log ?? ((m) => console.log(`[bot-presence] ${m}`));
  }

  start(): void {
    this.stopped = false;
    this.connect(this.url);
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.clearHeartbeat();
    // 1000 ends the session cleanly, so the bot goes offline straight away.
    this.ws?.close(1000);
    this.ws = null;
  }

  private connect(url: string): void {
    if (this.stopped) return;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("message", (raw) => {
      let payload: GatewayPayload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return;
      }
      this.onPayload(ws, payload);
    });
    ws.on("close", (code) => this.onClose(ws, code));
    // A failed connection also emits "close"; this just keeps it from throwing.
    ws.on("error", (error) => this.log(`connection error: ${error.message}`));
  }

  private onPayload(ws: WebSocket, payload: GatewayPayload): void {
    if (ws !== this.ws) return;
    if (typeof payload.s === "number") this.sequence = payload.s;

    switch (payload.op) {
      case 10: // HELLO
        this.heartbeatInterval = payload.d.heartbeat_interval;
        this.startHeartbeat(ws);
        if (this.sessionId && this.sequence !== null) {
          this.send(ws, { op: 6, d: { token: this.token, session_id: this.sessionId, seq: this.sequence } });
        } else {
          this.identify(ws);
        }
        break;
      case 11: // HEARTBEAT_ACK
        this.acked = true;
        break;
      case 1: // Discord asks for a heartbeat right now
        this.sendHeartbeat(ws);
        break;
      case 7: // RECONNECT
        this.log("Discord asked us to reconnect");
        ws.close(4000);
        break;
      case 9: // INVALID_SESSION
        if (!payload.d) {
          this.sessionId = null;
          this.sequence = null;
        }
        // Discord asks for a short random wait before trying again.
        setTimeout(() => {
          if (ws !== this.ws || ws.readyState !== WebSocket.OPEN) return;
          if (this.sessionId && this.sequence !== null) {
            this.send(ws, { op: 6, d: { token: this.token, session_id: this.sessionId, seq: this.sequence } });
          } else {
            this.identify(ws);
          }
        }, 1_000 + Math.random() * 4_000).unref?.();
        break;
      case 0: // DISPATCH
        if (payload.t === "READY") {
          this.sessionId = payload.d.session_id;
          this.resumeUrl = payload.d.resume_gateway_url ? `${payload.d.resume_gateway_url}/?v=10&encoding=json` : null;
          this.attempts = 0;
          this.everReady = true;
          this.log(`online as ${payload.d.user?.username ?? "the bot"}`);
        } else if (payload.t === "RESUMED") {
          this.attempts = 0;
          this.log("session resumed");
        }
        break;
    }
  }

  private identify(ws: WebSocket): void {
    const presence: Record<string, unknown> = { status: "online", since: null, afk: false, activities: [] };
    if (this.activity) presence.activities = [{ name: this.activity, type: 3 }]; // 3 = Watching
    this.send(ws, {
      op: 2,
      d: {
        token: this.token,
        intents: 0,
        properties: { os: "linux", browser: "voidbans", device: "voidbans" },
        presence,
      },
    });
  }

  private startHeartbeat(ws: WebSocket): void {
    this.clearHeartbeat();
    this.acked = true;
    const first = this.randomizeFirst ? Math.random() * this.heartbeatInterval : 0;
    const beat = () => {
      if (ws !== this.ws || ws.readyState !== WebSocket.OPEN) return;
      if (!this.acked) {
        // The last heartbeat was never acknowledged: the connection is dead.
        this.log("heartbeat was not acknowledged, reconnecting");
        ws.close(4000);
        return;
      }
      this.sendHeartbeat(ws);
      this.heartbeatTimer = setTimeout(beat, this.heartbeatInterval);
    };
    this.heartbeatTimer = setTimeout(beat, first);
  }

  private sendHeartbeat(ws: WebSocket): void {
    this.acked = false;
    this.send(ws, { op: 1, d: this.sequence });
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private send(ws: WebSocket, payload: GatewayPayload): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }

  private onClose(ws: WebSocket, code: number): void {
    if (ws !== this.ws) return;
    this.clearHeartbeat();
    this.ws = null;
    if (this.stopped) return;

    const fatal = FATAL_CLOSE_CODES[code];
    if (fatal) {
      this.log(`stopped: ${fatal} (close code ${code})`);
      this.stopped = true;
      return;
    }
    if (RESET_SESSION_CODES.has(code)) {
      this.sessionId = null;
      this.sequence = null;
    }

    this.attempts += 1;
    const delay = Math.min(this.maxBackoff, this.minBackoff * 2 ** Math.min(this.attempts - 1, 10));
    if (this.attempts === 1 || this.attempts % 10 === 0) {
      this.log(`disconnected (code ${code}), reconnecting in ${Math.round(delay / 1000)}s`);
    }
    const target = this.sessionId && this.resumeUrl ? this.resumeUrl : this.url;
    this.reconnectTimer = setTimeout(() => this.connect(target), delay);
    this.reconnectTimer.unref?.();
  }

  /** For tests and diagnostics. */
  get state(): { ready: boolean; sessionId: string | null; stopped: boolean } {
    return { ready: this.everReady && this.ws !== null, sessionId: this.sessionId, stopped: this.stopped };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __voidbansPresence: BotPresence | undefined;
}

/**
 * Starts the connection once per process, from instrumentation.ts. Off in
 * development unless asked for, so a dev server doesn't compete with the real
 * one, and off if BOT_PRESENCE=false.
 */
export function startBotPresence(): void {
  const setting = process.env.BOT_PRESENCE?.toLowerCase();
  if (setting === "false" || setting === "0" || setting === "off") return;
  if (process.env.NODE_ENV !== "production" && setting !== "true") return;

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;
  if (globalThis.__voidbansPresence) return;

  let activity = process.env.BOT_ACTIVITY;
  if (activity === undefined || activity === "") {
    try {
      activity = new URL(process.env.SITE_URL ?? "").host;
    } catch {
      activity = "punishments";
    }
  }

  const presence = new BotPresence({ token, activity });
  globalThis.__voidbansPresence = presence;
  presence.start();

  // Go offline promptly on a restart instead of lingering until Discord times us out.
  const shutdown = () => presence.stop();
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
