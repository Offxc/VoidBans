<h1 align="center">VoidBans</h1>

<p align="center">
  <strong>Self-hosted ban lookup and staff moderation dashboard for a Minecraft server.</strong>
</p>

<p align="center">
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-black.svg">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6.svg">
  <img alt="Java 17" src="https://img.shields.io/badge/Java-17-ED8B00.svg">
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8-4479A1.svg">
  <img alt="Self-hosted" src="https://img.shields.io/badge/deploy-Docker%20Compose-2496ED.svg">
</p>

---

Two pieces sharing one MySQL database: a Paper plugin that runs on the Minecraft server, and a
Next.js app that serves the public ban-lookup site and the staff dashboard. They don't talk to
each other directly — everything goes through the shared schema.

```
Paper server + plugin ──▶ MySQL (shared schema) ◀── Next.js app (public site + staff dashboard)
```

The plugin tracks sessions, enforces bans/mutes in-game, and writes punishments issued with
`/vban`. The web app owns Discord OAuth, permissions, and the public lookup UI. The web app's
Prisma schema is the source of truth for the database — the plugin reads and writes rows but
never runs migrations.

## Features

**Public site**
- Ban ID lookup (`/VB-XXXXXXXX`), linked directly from the in-game kick/mute message
- Appeals — one per ban, owner-configurable questions, staff accept/deny with a response and
  optional auto-revoke
- Optional `/rules` page (Markdown, owner-written)

**Staff dashboard**
- Discord OAuth login; first account in becomes the owner
- Punishment list, online/offline roster, per-player profile (sticky identity/status panel,
  punishment history, sessions, IPs, notes, PNG attachments)
- Issue a ban/mute/kick/warn manually, from a template, or by selecting one or more rulebook
  entries — reason, duration, and appealability get filled in either way; templates and
  rule-based punishing are independent toggles and can both be on
- Pre-ban a player who's never joined, by UUID or username (Mojang-resolved) — the punishment
  takes effect the moment they connect
- Revoke or edit any punishment, template, or rule after the fact
- Per-Discord-role permissions, checked server-side on every request — not "op or not"
- Discord webhook notifications (punishment issued/lifted, note or attachment added, appeal
  submitted/resolved), each event toggled independently

**In-game (plugin)**
- Bans and mutes are actually enforced: checked on login and on every chat message against the
  live `punishments` table, no restart needed for a ban/unban to take effect
- IP bans block reconnection from the same network on a different account
- `/vban` and `/vunban`
- Chat alert to staff on any punishment, in-game or dashboard-issued
- Bedrock (Geyser/Floodgate) players work the same as Java — enforcement keys off UUID, which
  Floodgate already normalizes before the plugin sees it

**Optional**
- Vulcan Anticheat integration (violation history, detected client) — reflection-only, zero
  build dependency on Vulcan, off until enabled in Settings

## Tech stack

| Layer | Choice |
| --- | --- |
| Web | Next.js 14 (App Router), TypeScript, React 18 |
| Database | MySQL/MariaDB + Prisma |
| Auth | Discord OAuth2, signed session cookies |
| Plugin | Java 17, Paper API, HikariCP |
| Proxy/TLS | Caddy |
| Deploy | Docker Compose |

No Redis, no queue, no search service. The plugin and web app only ever meet at the database.

## Quick start

Needs Node 20+, pnpm, a MySQL/MariaDB instance, and a Discord application.

```bash
git clone git@github.com:Offxc/VoidBans.git
cd VoidBans
pnpm install
cp packages/web/.env.example packages/web/.env
```

Fill in `packages/web/.env`: `DATABASE_URL`, `SESSION_SECRET` (`openssl rand -base64 48`), the
four `DISCORD_*` values.

```bash
cd packages/web
pnpm exec prisma migrate dev
pnpm dev
```

Open <http://localhost:3000>, sign in via Staff Login — that first login becomes the owner.

Build the plugin separately:

```bash
cd packages/plugin
JAVA_HOME=<path-to-jdk-17> mvn package
```

Jar lands at `target/VoidBans.jar` — drop it in the Paper server's `plugins/` folder and point its
generated `config.yml` at the same database.

## Self-hosting

[`deploy/DEPLOYMENT.md`](deploy/DEPLOYMENT.md) covers the Discord app/bot setup, DNS, Docker on a
fresh box, first boot, dropping into an existing Caddy instance, installing the plugin, and
post-deploy checks.

Short version:

```bash
cp .env.example .env     # fill in, then:
docker compose build
docker compose up -d db
docker compose run --rm migrate
docker compose up -d web
```

`db`, a one-shot `migrate`, and `web`. Neither `web` nor `db` is published on a public interface —
put a reverse proxy in front for TLS.

## Configuration

| Variable | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `packages/web/.env` | MySQL connection string |
| `SESSION_SECRET` | `packages/web/.env` | 32+ random chars, signs staff session cookies |
| `SITE_URL` | `packages/web/.env` | Public URL — must match `site-url` in the plugin config |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | `packages/web/.env` | Discord OAuth app |
| `DISCORD_REDIRECT_URI` | `packages/web/.env` | `${SITE_URL}/api/auth/callback` |
| `DISCORD_BOT_TOKEN` / `DISCORD_GUILD_ID` | `packages/web/.env` | Reads a logging-in user's guild roles |
| `database.*` | `packages/plugin/config.yml` | Same DB as `DATABASE_URL` |
| `site-url` | `packages/plugin/config.yml` | Must match `SITE_URL` |
| `chat-prefix` | `packages/plugin/config.yml` | Prefix for messages the plugin sends in chat |
| `messages.*` | `packages/plugin/config.yml` | Ban/mute/kick messages — `{reason}` `{ban_id}` `{site_url}` `{duration}` `{expires_at}` |
| `staff-alerts.*` | `packages/plugin/config.yml` | In-game staff alert on punishment |

Moving domains is a two-line change (`SITE_URL`, `site-url`) — nothing else hardcodes it.

## Project layout

```
packages/
  web/
    prisma/                       Schema + migrations
    src/app/                      Pages and API routes
    src/app/staff/(dashboard)/    Guarded staff route group
    src/components/
    src/lib/                      Auth, permissions, session, rate limiting, integrations
  plugin/
    src/main/java/…/listener/     Sessions, ban/mute enforcement
    src/main/java/…/command/      /vban, /vunban
    src/main/java/…/integration/  Vulcan (reflection-only)
    src/main/java/…/task/         Staff alert + integration-settings polling
deploy/
  DEPLOYMENT.md
  Caddyfile.example
```

## Permissions

Every route checks a permission key server-side — the UI hiding a button is a convenience, not
the boundary. Full list in
[`packages/web/src/lib/permissions.ts`](packages/web/src/lib/permissions.ts).

**First Discord login on a fresh deploy becomes the owner**, automatically, with full access.
Log in yourself right after deploying, before telling anyone the URL exists.

Everyone else's access comes from the owner mapping Discord roles to permissions in Settings.
Holding a role in Discord grants nothing on its own.

**Every staff member, owner included, links their Minecraft account** at `/staff/link-account`
before the dashboard works — checked on every load, not just first login. This is what lets the
punishment API recognize "this target is staff" and block the action; non-owner staff can't
punish a linked staff account, the owner can.

## IP logging

The plugin logs the IP of every session, for every player, so IP bans can actually block
reconnection from a different account on the same network. Cover this in your privacy policy.
`players.view_ip` gates who on staff can see it — dashboard access alone doesn't.

## Punishment enforcement

A ban or mute is enforced by the plugin, not just recorded:

- **Ban** — checked on `PlayerLoginEvent`, before the connection completes. Kick message renders
  the real reason, ban ID, and `{site_url}/{ban_id}` from `messages.ban`/`messages.temp-ban`.
- **Mute** — checked on every chat message; cancelled with `messages.mute`/`messages.temp-mute`.
- Both hit the live `punishments` table on every attempt, no caching — a ban or unban from the
  dashboard takes effect on the next login or message, no restart.

**Bedrock (Geyser/Floodgate)** needs no separate code path — Floodgate substitutes its own UUID
before the login event fires, and that's what everything here keys off. Their username carries
the `.` prefix Floodgate adds, and the kick/mute link is plain text instead of clickable (Geyser's
disconnect screen doesn't render Java's link component) but still fully readable. One real gap: a
Bedrock player who's never joined can't be found by name in the pre-ban lookup — no public API
for that — so pre-banning one needs their UUID already in hand.

## Staff chat alerts

Any punishment — `/vban` or dashboard — triggers a chat alert to staff holding
`voidbans.alerts.punishments`. The plugin polls the `punishments` table every
`staff-alerts.poll-interval-seconds` (default 5s) to catch dashboard-issued ones; `/vban` alerts
are instant. Grant the permission per-rank via LuckPerms, not the Bukkit default:

```
/lp group <rankname> permission set voidbans.alerts.punishments true
```

Message text and prefix are both in `config.yml` (`chat-prefix`, `staff-alerts.message`).

## Optional integrations

Reflection-only — zero compile-time dependency, checked at runtime, no-op if the plugin isn't
installed.

**Vulcan Anticheat** — flag/punish events and detected client, shown on a player's profile. Off
by default, enable in Settings → Integrations. Polled every 20s, no restart needed to flip it.
`packages/plugin/pom.xml` has no reference to Vulcan and its jar is never bundled here (paid,
licensed plugin).

AntiSpoof Pro was evaluated for detected-plugin data and dropped — its jar exposes no API, Bukkit
events, or PlaceholderAPI hooks to read from.

## Security

- Permissions checked server-side on every route, not just hidden in the UI
- Public ban IDs (`VB-XXXXXXXX`) are non-sequential 8-char base32 — not enumerable. UUIDs and
  internal IDs never leave an unauthenticated endpoint
- OAuth CSRF protection via signed `state`
- Session cookies: `httpOnly`, `Secure` in production, signed (`jose`)
- Rate limiting on public lookup/appeal endpoints, keyed off real client IP
- Parameterized queries throughout (Prisma) — no raw string-built SQL
- CSP and other security headers on every response (`packages/web/src/middleware.ts`)
- Audit log on punishment issue/revoke, permission changes, template/rule changes, appeal
  resolution

Report a vulnerability via a security advisory on the repo, not a public issue.

## Known gaps

- No automated test suite — `tsc`, `eslint`, `next build`, and manual testing against a seeded DB
- `bans.request` (staff without issue rights) returns 202 with nothing queued yet — the
  permission branch exists, the request queue doesn't

## Not included

No AntiSpoof integration (nothing to read from it). No analytics or telemetry. No billing or
multi-tenancy — one deployment for one server.

## Contributing

```bash
pnpm install
cp packages/web/.env.example packages/web/.env
cd packages/web
pnpm exec prisma migrate dev
pnpm dev
```

No CI yet — run before pushing:

```bash
cd packages/web
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm run build
```

Schema changes need a migration (`pnpm exec prisma migrate dev --name …`) committed with the code
that needs it — only the web app runs migrations, so a schema change without one passes locally
and throws `P2022: column does not exist` on deploy. `SessionListener.java`'s
`UPDATE … ORDER BY … LIMIT` is MySQL-specific, not standard SQL.

## License

TBD.
