<h1 align="center">VoidBans</h1>

<p align="center">
  <strong>A self-hosted ban lookup and staff moderation dashboard for a Minecraft server.</strong>
</p>

<p align="center">
  Discord-gated staff panel, public ban lookup and appeals, in-game session and punishment
  tracking, and optional anticheat integration — one deployment, one database, no third party
  holding your moderation history.
</p>

---

VoidBans is two things that share one MySQL database: a Paper plugin that runs on your Minecraft
server, and a Next.js web app that serves the public ban lookup page and the staff dashboard. They
never talk to each other directly.

```
Paper server + plugin ──▶ MySQL (shared schema) ◀── Next.js web app (public site + staff dashboard)
```

The plugin tracks sessions (login/logout, client brand) and writes punishments issued in-game. The
web app is the only thing with Discord OAuth, permission logic, and the public lookup UI. **The web
app's Prisma schema is the source of truth for the database shape** — the plugin reads and writes
rows but never runs migrations.

## Why

Most Minecraft punishment plugins stop at "here's a `/ban` command and a flat file of who's
banned." Nothing they produce is meant to be looked at by a player, and nothing surfaces
session history, appeals, or fine-grained staff permissions without buying into a bigger
ecosystem.

VoidBans is the other shape: a real web app a banned player can actually visit to see why and
appeal, and a dashboard where staff access is granted per Discord role with real permission
boundaries — not "op or not."

## Features

**Public site**
- Ban ID lookup — a player enters the ID from their in-game ban message and sees the reason,
  type, and current status
- Direct `/<ban-id>` URLs, so the in-game message can link straight to the result
- Owner-configurable appeal questions, one appeal per ban, staff accept/deny with a written
  response and optional auto-revoke on accept
- Optional `/rules` page, owner-written in Markdown from Settings, with a homepage button —
  off by default until the owner enables it

**Staff dashboard**
- Discord OAuth sign-in; the first account to ever log in becomes the owner
- Bans list, online/offline player roster with Minecraft head renders, per-player profile
- Session history in the viewer's own local timezone, last 30 days' playtime, distinct IP count
- Punishment actions — mute, temp mute, kick, temp ban, ban — each either from a template or
  filled in manually, with an optional IP ban that blocks reconnection from that address
  regardless of account
- Username history, freeform staff notes, and a merged activity timeline per player
- Owner-configurable punishment templates, with template creation itself gated by permission
- In-game staff chat alerts on punishment, with a configurable prefix and message

**Permissions**
- Fine-grained permission keys (view bans, issue bans, view IPs, view sessions, resolve appeals,
  manage templates, …), checked server-side on every request
- Owner maps a live Discord role to a set of permissions from a dropdown + checkbox grid —
  nobody gets dashboard access just by holding a role until the owner grants it
- A role without ban-issuing rights can still request one, routed to someone who can act on it

**Optional integrations**
- BlueMap embed on its own staff tab, only rendered when configured
- Vulcan Anticheat: violation history and detected client brand on a player's profile, via a
  reflection-only integration with zero build-time dependency on Vulcan — see
  [Optional integrations](#optional-integrations)

## Tech stack

| Layer | Choice |
| --- | --- |
| Web framework | Next.js 14 (App Router, React 18, TypeScript strict) |
| Database | MySQL/MariaDB + Prisma |
| Auth | Discord OAuth2, signed session cookies (`jose`) |
| Minecraft plugin | Java 17, Paper API, HikariCP |
| Reverse proxy / TLS | Caddy |
| Deployment | Docker Compose |

## Quick start

Requirements: **Node 20+**, **pnpm**, a MySQL/MariaDB instance, and a Discord application (see the
deployment guide for how to create one).

```bash
git clone <this-repo-url> voidbans
cd voidbans
pnpm install
cp packages/web/.env.example packages/web/.env
```

Fill in `packages/web/.env` — at minimum `DATABASE_URL`, a `SESSION_SECRET`
(`openssl rand -base64 48`), and the four `DISCORD_*` values.

```bash
cd packages/web
pnpm exec prisma migrate dev
pnpm dev
```

The app is on <http://localhost:3000>. Sign in once via Staff Login to become the owner.

Build the plugin separately with Maven:

```bash
cd packages/plugin
JAVA_HOME=<path-to-jdk-17> mvn package
```

The jar lands at `target/VoidBans.jar` — drop it into your Paper server's `plugins/` folder and
point its generated `config.yml` at the same database.

## Self-hosting

[**deploy/DEPLOYMENT.md**](deploy/DEPLOYMENT.md) is the full deployment guide: creating the
Discord application and bot, DNS, Docker on a fresh Ubuntu server, first boot, editing an existing
Caddy instance safely, installing the plugin, and post-deploy checks. A live, formatted copy with
copyable commands is linked at the top of that file.

The short version:

```bash
cp .env.example .env     # fill in, then:
docker compose build
docker compose up -d db
docker compose run --rm migrate
docker compose up -d web
```

Three services come up: `db` (MySQL), a one-shot `migrate` that applies pending migrations before
the app starts, and `web`. Only `web` and `db` are published, and both are bound to `127.0.0.1`
only — a reverse proxy (Caddy) in front handles TLS and the public-facing port.

## Configuration

| Variable | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `packages/web/.env` | MySQL connection string (Prisma) |
| `SESSION_SECRET` | `packages/web/.env` | Signs staff session cookies. 32+ random chars — `openssl rand -base64 48` |
| `SITE_URL` | `packages/web/.env` | Public URL of this deployment — must match `site-url` in the plugin's config |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | `packages/web/.env` | Discord OAuth app credentials |
| `DISCORD_REDIRECT_URI` | `packages/web/.env` | OAuth callback URL, `${SITE_URL}/api/auth/callback` |
| `DISCORD_BOT_TOKEN` / `DISCORD_GUILD_ID` | `packages/web/.env` | Bot used server-side to read a logging-in user's guild roles |
| `BLUEMAP_URL` | `packages/web/.env` | BlueMap web root for the staff live-map tab; omit to hide that tab |
| `database.*` | `packages/plugin/config.yml` | Same DB as `DATABASE_URL` above |
| `site-url` | `packages/plugin/config.yml` | Must match `SITE_URL` — the only thing to change when moving domains |
| `chat-prefix` | `packages/plugin/config.yml` | Prefix shown before every message the plugin sends in chat |
| `messages.*` | `packages/plugin/config.yml` | In-game ban/kick message templates — placeholders: `{reason}` `{ban_id}` `{site_url}` `{duration}` `{expires_at}` |
| `staff-alerts.*` | `packages/plugin/config.yml` | In-game staff chat alert on punishment |

Changing where the site is hosted is a two-line change (`SITE_URL` and `site-url`) — the domain is
never hardcoded anywhere else in the code, only as an example value in `.env.example` files and
docs.

## Project layout

```
packages/
  web/                    Next.js app — public site + staff dashboard + API routes
    prisma/               Schema (source of truth for the DB) and migrations
    src/app/               Pages and API routes
    src/app/staff/(dashboard)/   Guarded staff dashboard route group
    src/components/         Shared UI
    src/lib/                Auth, permissions, session, rate limiting, integrations
  plugin/                  Paper plugin (Java)
    src/main/java/…/listener/     Session and login/IP-ban enforcement
    src/main/java/…/integration/  Reflection-only Vulcan integration
    src/main/java/…/task/         Staff alert polling, integration settings polling
    src/main/resources/     plugin.yml, default config.yml
deploy/
  DEPLOYMENT.md            Full deployment guide
  Caddyfile.example        Reference site block for an existing Caddy instance
```

## Permission model

Every sensitive action is gated behind a permission key, checked server-side on every request —
the UI hiding a button is a convenience, never the actual boundary. See
[`packages/web/src/lib/permissions.ts`](packages/web/src/lib/permissions.ts) for the full list
(`bans.issue`, `appeals.resolve`, `players.view_ip`, etc.). When adding a new staff-facing
feature, add a permission key for it rather than checking a role name directly.

**The first Discord account to log in via "Staff Login" on a freshly deployed site becomes the
owner**, with full permissions and access to Settings. This happens automatically and silently —
there's no setup wizard gating it. If you're standing this up for the first time, **log in
yourself immediately after deploying, before announcing the site to anyone**, or someone else
could end up owning your permission panel.

Every other staff member's access comes entirely from the owner mapping a Discord role to
permissions in Settings — nobody else gets access just by having a role in the server until the
owner grants that role permissions there.

**Every staff member, including the owner, must link their own Minecraft account** (at
`/staff/link-account`) before the dashboard is usable — enforced on every dashboard load, not just
first login, so it also catches accounts that logged in before this existed. They enter their own
Minecraft username, which must belong to a player who has actually joined the server at least once
(it resolves to a real `Player` row, not an arbitrary typed name). This link is what lets the
punishment API recognize "this target is staff" and refuse the action — without it, there'd be no
way to know a given Minecraft account belongs to a logged-in staff member at all. Non-owner staff
can't punish another linked staff account through the dashboard; the owner is exempt, since they're
the ultimate authority on the panel and may need to act against a compromised or rogue account.

## IP logging and IP bans

The plugin records the IP address of every login session, for every player — not just those who
get punished. This exists so an IP ban (a checkbox on the ban/temp-ban actions in the dashboard)
can actually block reconnection attempts from alt accounts, not just the original account. This is
real data collection worth calling out explicitly in your privacy policy before launch — see
[`packages/web/src/app/privacy/page.tsx`](packages/web/src/app/privacy/page.tsx), which already
covers it, but check it still matches your actual retention practice.

IP data is only visible to staff holding `players.view_ip` specifically — having dashboard access
at all does not imply seeing IPs.

## In-game staff chat alerts

Whenever a punishment is issued — from `/vban` in-game **or** the web dashboard — the plugin
broadcasts a chat message to online players holding the `voidbans.alerts.punishments` permission.
The web dashboard doesn't talk to the plugin directly, so the plugin notices dashboard-issued
punishments by polling the `punishments` table every `staff-alerts.poll-interval-seconds` (default
5s); in-game `/vban` alerts are effectively instant.

This permission isn't meant to be handed out via `plugin.yml`'s Bukkit default — grant it per-rank
with LuckPerms instead, so it lines up with however your staff ranks are already structured:

```
/lp group <rankname> permission set voidbans.alerts.punishments true
```

Run that once per rank that should see the alerts (e.g. `helper`, `moderator`, `admin`). The
message text and the `&`-coded prefix in front of it are both configurable in `config.yml`
(`chat-prefix`, `staff-alerts.message`), independent of this repo's code.

## Optional integrations

VoidBans can optionally pull extra data from other plugins you may or may not have installed.
These are genuinely optional: the VoidBans plugin has **zero compile-time dependency** on any of
them (not even a soft one) — it checks for the target plugin at runtime via reflection and simply
does nothing if it isn't present.

### Vulcan Anticheat

If [Vulcan](https://vulcanac.net/) is installed, VoidBans can record its flag/punish events into a
`violation_events` table and show them on a player's profile, and read the player's detected
client brand into the session log. This is off by default — turn it on from **Settings →
Integrations** (owner-only) in the dashboard. The plugin polls that setting every 20 seconds, so
flipping the toggle takes effect without a restart.

Because this is reflection-only, nothing about VoidBans' own build depends on Vulcan being present
or even on you owning a Vulcan license — `packages/plugin/pom.xml` has no reference to it, and
Vulcan's jar is never bundled or committed to this repo (it's a paid, licensed plugin — don't add
it here).

Turning the integration off in Settings hides the violation history UI everywhere; it does not
delete rows already recorded, so re-enabling later shows the full history again.

We evaluated AntiSpoof Pro for detected-plugin-list data as well, but its jar exposes no public
API, Bukkit events, or PlaceholderAPI hooks to read from — there's currently no way to integrate
with it, so that idea was dropped rather than half-built against nothing.

## Security

- **Every sensitive route checks permissions server-side**, independent of what the UI shows —
  see [Permission model](#permission-model).
- **Public ban IDs are the only public identifier.** `publicBanId` (e.g. `VB-8F2K9Q`) is
  non-sequential and 8+ characters of base32, resisting enumeration. Player UUIDs and internal
  database IDs are never returned from an unauthenticated endpoint.
- **OAuth CSRF protection** via a signed `state` parameter on the Discord login flow.
- **Session cookies** are `httpOnly`, `Secure` in production, and signed (`jose`/JWT) — never
  readable or forgeable client-side.
- **Rate limiting** on the public ban-lookup and appeal-submission endpoints, keyed off the real
  client IP (`CF-Connecting-IP` when behind Cloudflare, `X-Forwarded-For` otherwise).
- **Parameterized queries everywhere** via Prisma — no raw string-built SQL.
- **CSP, frame-ancestors, and other security headers** set on every response
  (`packages/web/next.config.mjs`), with a narrowly-scoped exception only on the BlueMap tab's
  route for its embed.
- **Audit log** records sensitive actions — punishment issue/revoke, permission changes, template
  changes, appeal resolution — against the acting staff member.

Found something? Open a security advisory on the repository rather than a public issue.

## Status

Actively built for one production deployment. Known gaps, so nobody discovers them the hard way:

- **No automated test suite.** Verified so far by `tsc`, `eslint`, `next build`, and manual
  click-through against a seeded local database — no CI, no test runner wired up yet.
- **Punishment requests aren't persisted yet.** A staff member without `bans.issue` but with
  `bans.request` gets a 202 response with no queued record — the permission branch and API shape
  exist, the request queue itself doesn't.
- **The Docker build is unverified against a real Docker daemon** as of this writing — reasoned
  through carefully against the actual Next.js standalone output, but not yet run end to end on
  the deployment target.
- **Privacy Policy and Terms pages ship with `TODO`s** (retention period, contact method) — fill
  those in before announcing the site publicly.

## Not included, on purpose

No AntiSpoof integration (no API surface to read from — see
[Optional integrations](#optional-integrations)). No third-party analytics or telemetry. No
billing or multi-tenancy — this is one deployment for one server, not a hosted platform.

## License

TBD.
