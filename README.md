# VoidBans

A public ban-lookup site with a Discord-gated staff panel, built for VoidSMP and deployed at `your-domain.example`. Players enter a ban ID (shown in their in-game ban message) to see punishment details and appeal; staff sign in with Discord to manage punishments, review appeals, and see who's online.

## How it fits together

```
Paper server + plugin ──▶ MySQL (shared schema) ◀── Next.js web app (public site + staff API)
```

The plugin (`packages/plugin`) and the web app (`packages/web`) never talk to each other directly — they share one MySQL database. The plugin tracks sessions (login/logout) and writes punishments issued in-game; the web app is the only thing with Discord OAuth, permission logic, and the public lookup UI. **The web app's Prisma schema is the source of truth for the database shape** — the plugin reads/writes rows but never runs migrations.

## Setup

### Database

Create a MySQL/MariaDB database and user, then point both halves of the project at it:

- `packages/web/.env` → `DATABASE_URL`
- `packages/plugin/config.yml` → `database.*`

They must be the same database.

### Web app

```
cd packages/web
cp .env.example .env   # fill in real values — see the table below
npm install
npm run prisma:migrate
npm run dev
```

### Plugin

Build with Maven (`mvn package` from `packages/plugin`), drop the resulting jar from `target/` into your Paper server's `plugins/` folder, then edit the generated `config.yml` before first start — at minimum the `database` block and `site-url`.

### First login — you become the owner

**The first Discord account to log in via "Staff Login" on a freshly deployed site becomes the owner**, with full permissions and access to Settings. This happens automatically and silently — there's no setup wizard gating it. If you're standing this up for the first time, **log in yourself immediately after deploying, before announcing the site to anyone**, or someone else could end up owning your permission panel.

Every other staff member's access comes entirely from mapping a Discord role to permissions in Settings (owner-only) — nobody else gets access just by having a role in the server until the owner grants that role permissions there.

## Configuration reference

| Key | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `packages/web/.env` | MySQL connection string (Prisma) |
| `SESSION_SECRET` | `packages/web/.env` | Signs staff session cookies — 32+ random chars, keep secret |
| `SITE_URL` | `packages/web/.env` | Public URL of this deployment — must match `site-url` below |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | `packages/web/.env` | Discord OAuth app credentials |
| `DISCORD_REDIRECT_URI` | `packages/web/.env` | OAuth callback URL, `${SITE_URL}/api/auth/callback` |
| `DISCORD_BOT_TOKEN` / `DISCORD_GUILD_ID` | `packages/web/.env` | Bot used server-side to read a logging-in user's guild roles |
| `BLUEMAP_URL` | `packages/web/.env` | BlueMap web root for the staff live-map tab; omit to hide that tab |
| `database.*` | `packages/plugin/config.yml` | Same DB as `DATABASE_URL` above |
| `site-url` | `packages/plugin/config.yml` | Must match `SITE_URL` — the only thing to change when moving domains |
| `chat-prefix` | `packages/plugin/config.yml` | Prefix shown before every message the plugin sends in chat (staff alerts, etc.) |
| `messages.*` | `packages/plugin/config.yml` | In-game ban/kick message templates — placeholders: `{reason}` `{ban_id}` `{site_url}` `{duration}` `{expires_at}` |
| `staff-alerts.*` | `packages/plugin/config.yml` | In-game staff chat alert on punishment — see below |

Changing where the site is hosted is a two-line change (`SITE_URL` and `site-url`) — the domain is never hardcoded anywhere else.

## Permission model

Every sensitive action is gated behind a permission key, checked server-side on every request — the UI hiding a button is a convenience, never the actual boundary. See [`packages/web/src/lib/permissions.ts`](packages/web/src/lib/permissions.ts) for the full list (`bans.issue`, `appeals.resolve`, `players.view_ip`, etc.). When adding a new staff-facing feature, add a permission key for it rather than checking a role name directly.

## IP logging and IP bans

The plugin records the IP address of every login session, for every player — not just those who get punished. This exists so an IP ban (a checkbox on the ban/temp-ban actions in the dashboard) can actually block reconnection attempts from alt accounts, not just the original account. This is real data collection worth calling out explicitly in your privacy policy before launch — see [`packages/web/src/app/privacy/page.tsx`](packages/web/src/app/privacy/page.tsx), which already covers it, but check it still matches your actual retention practice.

IP data is only visible to staff holding `players.view_ip` specifically — having dashboard access at all does not imply seeing IPs.

## In-game staff chat alerts

Whenever a punishment is issued — from `/vban` in-game **or** the web dashboard — the plugin broadcasts a chat message to online players holding the `voidbans.alerts.punishments` permission. The web dashboard doesn't talk to the plugin directly, so the plugin notices dashboard-issued punishments by polling the `punishments` table every `staff-alerts.poll-interval-seconds` (default 5s); in-game `/vban` alerts are effectively instant.

This permission isn't meant to be handed out via `plugin.yml`'s Bukkit default — grant it per-rank with LuckPerms instead, so it lines up with however your staff ranks are already structured:

```
/lp group <rankname> permission set voidbans.alerts.punishments true
```

Run that once per rank that should see the alerts (e.g. `helper`, `moderator`, `admin`). The message text and the `&`-coded prefix in front of it are both configurable in `config.yml` (`chat-prefix`, `staff-alerts.message`), independent of this repo's code.

## Optional integrations

VoidBans can optionally pull extra data from other plugins you may or may not have installed. These are genuinely optional: the VoidBans plugin has **zero compile-time dependency** on any of them (not even a soft one) — it checks for the target plugin at runtime via reflection and simply does nothing if it isn't present.

### Vulcan Anticheat

If [Vulcan](https://vulcanac.net/) is installed, VoidBans can record its flag/punish events into a `violation_events` table and show them on a player's profile, and read the player's detected client brand into the session log. This is off by default — turn it on from **Settings → Integrations** (owner-only) in the dashboard. The plugin polls that setting every 20 seconds, so flipping the toggle takes effect without a restart.

Because this is reflection-only, nothing about VoidBans' own build depends on Vulcan being present or even on you owning a Vulcan license — `packages/plugin/pom.xml` has no reference to it, and Vulcan's jar is never bundled or committed to this repo (it's a paid, licensed plugin — don't add it here).

Turning the integration off in Settings hides the violation history UI everywhere; it does not delete rows already recorded, so re-enabling later shows the full history again.

We evaluated AntiSpoof Pro for detected-plugin-list data as well, but its jar exposes no public API, Bukkit events, or PlaceholderAPI hooks to read from — there's currently no way to integrate with it, so that idea was dropped rather than half-built against nothing.

## Public identifiers

Only `publicBanId` (e.g. `VB-8F2K9Q`) is ever exposed in public API responses or URLs. Player UUIDs and internal database IDs are never returned from an unauthenticated endpoint — keep it that way in any new public route.

## Deployment notes

Runs as a systemd service behind an existing Caddy instance that also serves other sites on the same box — the Caddy site block in this repo (if present under `deploy/`) is a reference to adapt, not a script to run unattended against a Caddyfile already serving other services. Always `caddy validate` before `systemctl reload caddy` (never `restart`, to avoid dropping unrelated connections).

## License

TBD.
