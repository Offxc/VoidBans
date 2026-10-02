# Changelog

The site and the plugin are versioned separately. The site version is in
`packages/web/package.json`, the plugin's in `packages/plugin/pom.xml`. Bump the one you
change: patch for a fix, minor for a feature or visible change. A change to the database
schema bumps the site, and the plugin too if it reads or writes the changed tables.

The site shows its version in the footer, the staff sidebar and Settings. The plugin logs
its version on startup and reports it to Settings > Plugin connection.

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
