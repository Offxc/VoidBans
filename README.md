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
each other directly: everything goes through the shared schema.

```
Paper server + plugin ──▶ MySQL (shared schema) ◀── Next.js app (public site + staff dashboard)
```

The plugin tracks sessions, enforces bans/mutes in-game, and writes punishments issued with
`/vban`. The web app owns Discord OAuth, permissions, and the public lookup UI. The web app's
Prisma schema is the source of truth for the database. The plugin reads and writes rows but
never runs migrations.

## Features

**Public site**
- Ban ID lookup (`/VB-XXXXXXXX`), linked directly from the in-game kick/mute message
- Appeals: one per ban, owner-configurable questions, staff accept/deny with a response and
  optional auto-revoke
- Optional `/rules` page: built from the same categories/rules staff pick from when punishing,
  not separately maintained

**Staff dashboard**
- Discord OAuth login; first account in becomes the owner
- Punishment list, online/offline roster, per-player profile (sticky identity/status panel,
  punishment history, sessions, IPs, notes, PNG attachments)
- Issue a ban/mute/kick/warn manually, from a template, or by selecting one or more rulebook
  entries: reason, duration, and appealability get filled in either way; templates and
  rule-based punishing are independent toggles and can both be on
- Pre-ban a player who's never joined, by UUID or username (Mojang-resolved). The punishment
  takes effect the moment they connect
- Revoke or edit any punishment, template, or rule after the fact
- Per-Discord-role permissions, checked server-side on every request. Not "op or not"
- Audit log (`audit.view`): filterable, paginated, CSV export. See [Audit log](#audit-log)
- Discord webhook notifications (punishment issued/lifted, note or attachment added, appeal
  submitted/resolved), each event toggled independently

**In-game (plugin)**
- Bans and mutes are actually enforced: checked on login and on every chat message against the
  live `punishments` table, no restart needed for a ban/unban to take effect
- IP bans block reconnection from the same network on a different account
- `/vban` and `/vunban`
- Chat alert to staff on any punishment, in-game or dashboard-issued
- Bedrock (Geyser/Floodgate) players work the same as Java. Enforcement keys off UUID, which
  Floodgate already normalizes before the plugin sees it

**Optional**
- Vulcan Anticheat integration (violation history, detected client). Reflection-only, zero
  build dependency on Vulcan, off until enabled in Settings

## Tech stack

| Layer | Choice |
| --- | --- |
| Web | Next.js 14 (App Router), TypeScript, React 18 |
| Database | MySQL/MariaDB + Prisma |
| Auth | Discord OAuth2, signed session cookies |
| Plugin | Java 17, Paper API, HikariCP |
| Deploy | Docker Compose |

No Redis, no queue, no search service. The plugin and web app only ever meet at the database.

## Build and run

You need Node 20+ and pnpm, MySQL 8 or MariaDB (Docker Compose runs one for you), JDK 17 and
Maven for the plugin, and a Discord application.

### Discord application

1. In the [Developer Portal](https://discord.com/developers/applications) create an application.
   Under OAuth2, copy the Client ID and Client Secret and add
   `https://your-domain.example/api/auth/callback` as a redirect.
2. Under Bot, turn on **Server Members Intent** and copy the bot token.
3. Invite the bot to your Discord server (scope `bot`, no permissions needed).
4. In Discord, turn on Developer Mode, right-click your server and copy the Server ID.

### Site (Docker)

```bash
git clone git@github.com:Offxc/VoidBans.git
cd VoidBans
cp .env.example .env     # fill in the secrets, the Discord values and SITE_URL
docker compose build
docker compose up -d db
docker compose run --rm migrate
docker compose up -d web
```

Generate the secrets with `openssl rand -base64 48`. The site listens on `127.0.0.1:3300`, so
point a reverse proxy that handles TLS at it. The database is published on `127.0.0.1:3307` for a
plugin on the same machine. Neither is reachable from the internet as shipped.

Open the site and use Staff login. **The first account to sign in becomes the owner**, so do this
before sharing the URL.

To update: `git pull`, `docker compose build`, `docker compose run --rm migrate`,
`docker compose up -d web`. If a new migration doesn't apply, rebuild with
`docker compose build --no-cache migrate web`.

### Site (local development)

```bash
pnpm install
cp packages/web/.env.example packages/web/.env
cd packages/web
pnpm exec prisma migrate dev
pnpm dev
```

Fill in `packages/web/.env` first: `DATABASE_URL`, `SESSION_SECRET`, `SITE_URL` and the Discord
values. The site runs on <http://localhost:3000>.

### Plugin

```bash
cd packages/plugin
JAVA_HOME=<path-to-jdk-17> mvn package
```

Copy `target/VoidBans.jar` into the Paper server's `plugins/` folder and start the server once to
generate `plugins/VoidBans/config.yml`. Stop it and set:

- `database.*`: the same database as the site. With the Compose file above that is host
  `127.0.0.1`, port `3307`, name `voidbans`, user `voidbans` and your `MYSQL_PASSWORD`
- `site-url`: the same as `SITE_URL`
- `server-id`: a name for this server

To give staff the in-game punishment alert, grant the permission with LuckPerms:

```
/lp group <group> permission set voidbans.alerts.punishments true
```

Start the server. Settings > Plugin connection on the site should list it within 30 seconds.

## How the plugin and site connect

They share one MySQL database and nothing else. There is no HTTP API, webhook or API key between
them. The link is the `database:` block in the plugin's `config.yml`, which has to point at the
same database as the site's `DATABASE_URL`.

| Direction | What moves |
| --- | --- |
| Plugin writes, site reads | Players, sessions, IPs, username history, online status, Vulcan violations, punishments issued in-game with `/vban`, a heartbeat |
| Site writes, plugin reads | Punishments (checked on every login and chat message), integration toggles |

The site owns the schema and runs the migrations. The plugin never changes the schema, so deploy
the site (and its migration) before updating the plugin.

**Check the link:** once the plugin starts, **Settings > Plugin connection** lists the server
under its `server-id` with its plugin version and last-seen time. It reports in every 30 seconds
and shows "Not reporting" after about 90 seconds of silence. If nothing appears, the plugin is
pointed at a different database.

**Installing the plugin from this repo does not connect anyone to your site.** The jar contains no
credentials. Each install talks only to the database in its own `config.yml`, so someone else's
server can't write to your panel unless they have your database password. For that reason:

- Don't publish the MySQL port to the internet. Bind it to localhost or a private network.
- Give the plugin its own MySQL user with access to this one database only.
- Treat `config.yml` like a secret, since it holds that password.

## Configuration

| Variable | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `packages/web/.env` | MySQL connection string |
| `SESSION_SECRET` | `packages/web/.env` | 32+ random chars, signs staff session cookies |
| `CONTACT_EMAIL` | `packages/web/.env` | Contact address shown on the privacy and terms pages. Optional |
| `SITE_URL` | `packages/web/.env` | Public URL. Must match `site-url` in the plugin config |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | `packages/web/.env` | Discord OAuth app |
| `DISCORD_REDIRECT_URI` | `packages/web/.env` | `${SITE_URL}/api/auth/callback` |
| `DISCORD_BOT_TOKEN` / `DISCORD_GUILD_ID` | `packages/web/.env` | Reads a logging-in user's guild roles |
| `database.*` | `packages/plugin/config.yml` | Same DB as `DATABASE_URL` |
| `site-url` | `packages/plugin/config.yml` | Must match `SITE_URL` |
| `chat-prefix` | `packages/plugin/config.yml` | Prefix for messages the plugin sends in chat |
| `messages.*` | `packages/plugin/config.yml` | Ban/mute/kick messages. `{reason}` `{ban_id}` `{site_url}` `{duration}` `{expires_at}` |
| `staff-alerts.*` | `packages/plugin/config.yml` | In-game staff alert on punishment |

Moving domains is a two-line change (`SITE_URL`, `site-url`). Nothing else hardcodes it.

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
  repair-sessions.sql             One-off fix for sessions damaged by plugin 0.2.0
```

## Permissions

Every route checks a permission key server-side. The UI hiding a button is a convenience, not
the boundary. Full list in
[`packages/web/src/lib/permissions.ts`](packages/web/src/lib/permissions.ts).

**First Discord login on a fresh deploy becomes the owner**, automatically, with full access.
Log in yourself right after deploying, before telling anyone the URL exists.

Everyone else's access comes from the owner mapping Discord roles to permissions in Settings.
Holding a role in Discord grants nothing on its own.

**Every staff member, owner included, links their Minecraft account** at `/staff/link-account`
before the dashboard works: checked on every load, not just first login. This is what lets the
punishment API recognize "this target is staff" and block the action; non-owner staff can't
punish a linked staff account, the owner can.

## IP logging

The plugin logs the IP of every session, for every player, so IP bans can actually block
reconnection from a different account on the same network. Cover this in your privacy policy.
`players.view_ip` gates who on staff can see it. Dashboard access alone doesn't.

## Punishment enforcement

A ban or mute is enforced by the plugin, not just recorded:

- **Ban**: checked on `PlayerLoginEvent`, before the connection completes. Kick message renders
  the real reason, ban ID, and `{site_url}/{ban_id}` from `messages.ban`/`messages.temp-ban`.
- **Mute**: checked on every chat message; cancelled with `messages.mute`/`messages.temp-mute`.
- Both hit the live `punishments` table on every attempt, no caching. A ban or unban from the
  dashboard takes effect on the next login or message, no restart.

**Bedrock (Geyser/Floodgate)** needs no separate code path. Floodgate substitutes its own UUID
before the login event fires, and that's what everything here keys off. Their username carries
the `.` prefix Floodgate adds, and the kick/mute link is plain text instead of clickable (Geyser's
disconnect screen doesn't render Java's link component) but still fully readable. One real gap: a
Bedrock player who's never joined can't be found by name in the pre-ban lookup. No public API
for that, so pre-banning one needs their UUID already in hand.

## Staff chat alerts

Any punishment, `/vban` or dashboard, triggers a chat alert to staff holding
`voidbans.alerts.punishments`. The plugin polls the `punishments` table every
`staff-alerts.poll-interval-seconds` (default 5s) to catch dashboard-issued ones; `/vban` alerts
are instant. Grant the permission per-rank via LuckPerms, not the Bukkit default:

```
/lp group <rankname> permission set voidbans.alerts.punishments true
```

Message text and prefix are both in `config.yml` (`chat-prefix`, `staff-alerts.message`).

## Optional integrations

Reflection-only: zero compile-time dependency, checked at runtime, no-op if the plugin isn't
installed.

**Vulcan Anticheat**: flag/punish events and detected client, shown on a player's profile. Off
by default, enable in Settings → Integrations. Polled every 20s, no restart needed to flip it.
`packages/plugin/pom.xml` has no reference to Vulcan and its jar is never bundled here (paid,
licensed plugin).

AntiSpoof Pro was evaluated for detected-plugin data and dropped. Its jar exposes no API, Bukkit
events, or PlaceholderAPI hooks to read from.

## Audit log

Staff with `audit.view` (and the owner) get an **Audit log** page: filter by area, outcome, actor
or target, page through it, export the current filter as CSV. Each row records who, what, the
target, success/denied/failure, when, and the source IP and user agent.

What gets recorded: punishments issued and revoked, appeals (submitted and resolved), notes,
attachments, pre-bans, templates, rules and categories, appeal questions, role permissions, every
settings change, sign-ins and sign-outs (including failed ones), requests refused for missing
permission, and public rate-limit hits.

Written with the [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
in mind:

- **Append-only.** No route or page edits or deletes entries. Back the table up and keep the
  database user's access tight; anyone with direct SQL access can still alter it.
- **No secrets.** Credentials (the webhook URL, tokens) are never passed in, and values under
  keys like `token`, `secret`, `password` or `webhook_url` are replaced with `[redacted]`.
- **Log injection.** Control characters and newlines are stripped from every value, details are
  stored as structured JSON, and the page renders them as plain text.
- **Bounded.** Values, arrays and nesting are capped, and denials from signed-out visitors are
  rate limited per IP so they can't flood the table.
- **CSV injection.** Exported cells starting with `=`, `+`, `-` or `@` are prefixed so a
  spreadsheet won't run them as formulas.
- **Never blocks the action.** A failed audit write is reported to the server log (action name
  only) and the request carries on.
- Actor names are snapshotted when the entry is written, so renames don't rewrite history.

The IP address comes from `CF-Connecting-IP`, then `X-Forwarded-For`, so it is only as trustworthy
as your proxy setup. Entries are kept indefinitely; there's no retention job.

## Security

- Permissions checked server-side on every route, not just hidden in the UI
- Public ban IDs (`VB-XXXXXXXX`) are non-sequential 8-char base32. Not enumerable. UUIDs and
  internal IDs never leave an unauthenticated endpoint
- OAuth CSRF protection via signed `state`
- Session cookies: `httpOnly`, `Secure` in production, signed (`jose`)
- Rate limiting on public lookup/appeal endpoints, keyed off real client IP
- Parameterized queries throughout (Prisma): no raw string-built SQL
- CSP and other security headers on every response (`packages/web/src/middleware.ts`)
- Audit log covering staff actions, sign-ins, access denials and rate-limit hits. See
  [Audit log](#audit-log)

Report a vulnerability via a security advisory on the repo, not a public issue.

## Known gaps

- No automated test suite: `tsc`, `eslint`, `next build`, and manual testing against a seeded DB
- `bans.request` (staff without issue rights) returns 202 with nothing queued yet. The
  permission branch exists, the request queue doesn't

## Not included

No AntiSpoof integration (nothing to read from it). No analytics or telemetry. No billing or
multi-tenancy: one deployment for one server.

## Contributing

Bump the version of whatever you change (see [CHANGELOG.md](CHANGELOG.md)) and add a line to it.

```bash
pnpm install
cp packages/web/.env.example packages/web/.env
cd packages/web
pnpm exec prisma migrate dev
pnpm dev
```

No CI yet: run before pushing:

```bash
cd packages/web
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm run build
```

Schema changes need a migration (`pnpm exec prisma migrate dev --name …`) committed with the code
that needs it: only the web app runs migrations, so a schema change without one passes locally
and throws `P2022: column does not exist` on deploy. `SessionListener.java`'s
`UPDATE … ORDER BY … LIMIT` is MySQL-specific, not standard SQL.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). You can use, modify and share VoidBans for any
noncommercial purpose, including running it for your own community. You can't sell it or use it to
make money. See the license for the full terms.
