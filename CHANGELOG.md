# Changelog

The site and the plugin are versioned separately. The site version is in
`packages/web/package.json`, the plugin's in `packages/plugin/pom.xml`. Bump the one you
change: patch for a fix, minor for a feature or visible change. A change to the database
schema bumps the site, and the plugin too if it reads or writes the changed tables.

The site shows its version in the footer, the staff sidebar and Settings. The plugin logs
its version on startup and reports it to Settings > Plugin connection.

## Site 0.3.0

- Punishment permissions are now per action: permanent ban, temporary ban, permanent mute,
  temporary mute and kick can each be granted separately, and so can revoking bans, mutes and
  kick records. A role only sees the buttons it can use, and the server checks the exact action.
- The role editor groups permissions under headings with plain names, with a select-all per group.
- Replaces `bans.issue` and `bans.revoke`. A migration gives existing roles every new permission
  they already had the old one for, so nobody gains or loses access on upgrade.

## Site 0.2.1

- The contact address on the privacy and terms pages now comes from the `CONTACT_EMAIL`
  setting instead of being written into the code. Without it the pages say "the server staff".

## Repository

- Removed the deployment guide and the example Caddyfile. The README now covers building and
  running only.
- `docker-compose.yml` no longer joins another project's Docker network. `web` is published on
  `127.0.0.1:3300`. A setup that needs a different network can use a `docker-compose.override.yml`,
  which git ignores.

## Plugin 0.2.1

- Fixed session lengths being inflated. 0.2.0 closed every old, never-closed session with
  the current time, so a session from last week could show a length of days and push the
  30 day playtime into the hundreds of hours. Sessions with no recorded end are now marked
  "Not recorded" and skipped in playtime totals instead of being given an invented end.
- To fix sessions already damaged by 0.2.0, run `deploy/repair-sessions.sql` (preview first,
  see the comments at the top of the file).

## Site 0.2.0 / Plugin 0.2.0

Site
- New interface: dark purple theme, public header and footer, staff sidebar, mobile menu
- Punishing opens a step-by-step dialog (bottom sheet on phones) with rule search
- Audit log page with filters and CSV export, new `audit.view` permission
- Sign-ins, failed sign-ins, access denials and rate-limit hits are now logged
- Settings shows connected plugin servers
- Session log is a headed table; only a live session shows "Online now"
- Fixed logout redirecting to the internal address
- Added the PolyForm Noncommercial license

Plugin
- Reports a heartbeat so the site can show it as connected
- Closes sessions on quit, rejoin, shutdown and after a crash or restart
- Reports its real version (was showing `${project.version}`)

## 0.1.0

First working version: ban lookup, appeals, staff dashboard, rules, templates, notes,
attachments, Discord webhook, in-game enforcement.
