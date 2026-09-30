import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSiteIconUrl } from "@/lib/site-icon";
import { getPunishmentModes } from "@/lib/punishment-modes";
import { StaffNav } from "@/components/StaffNav";
import Link from "next/link";

export default async function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
  const principal = await getStaffPrincipal();

  if (!principal) {
    redirect("/staff/login");
  }

  // Enforced for every staff member, including one who logged in before
  // this requirement existed — there is no minecraftUuid backfill, so the
  // gate is "does this row have one yet", checked on every dashboard load.
  // minecraftLinkSkippedAt lets someone who has never actually joined the
  // server (so linking is genuinely impossible right now) through once
  // they've tried and explicitly chosen to continue without it — they
  // still get nudged to finish linking from the dashboard header.
  const staffUser = await prisma.staffUser.findUnique({
    where: { discordId: principal.discordId },
    select: { minecraftUuid: true, minecraftLinkSkippedAt: true },
  });
  if (!staffUser?.minecraftUuid && !staffUser?.minecraftLinkSkippedAt) {
    redirect("/staff/link-account");
  }

  const [iconUrl, punishmentModes] = await Promise.all([getSiteIconUrl(), getPunishmentModes()]);

  const nav = [
    { href: "/staff/bans", label: "Punishments", show: hasPermission(principal, "bans.view") },
    { href: "/staff/appeals", label: "Appeals", show: hasPermission(principal, "appeals.view") },
    { href: "/staff/players", label: "Players", show: hasPermission(principal, "players.view_roster") },
    {
      href: "/staff/templates",
      label: "Templates",
      show: hasPermission(principal, "templates.view") && punishmentModes.templatesEnabled,
    },
    {
      href: "/staff/rules",
      label: "Rules",
      show: hasPermission(principal, "rules.view") && punishmentModes.rulesEnabled,
    },
    // Owner-only, not permission-gated — /staff/settings itself redirects
    // any non-owner regardless, so showing this to a non-owner would just
    // be a nav link that bounces them straight back.
    { href: "/staff/settings", label: "Settings", show: principal.isOwner },
  ].filter((item) => item.show);

  return (
    <div className="vb-shell">
      <StaffNav
        items={nav}
        iconUrl={iconUrl}
        user={{
          username: principal.username,
          discordId: principal.discordId,
          avatarHash: principal.avatarHash,
          isOwner: principal.isOwner,
        }}
      />
      <div className="vb-shell-main">
        {!staffUser?.minecraftUuid && (
          <div className="vb-banner">
            <span>Your Minecraft account isn&apos;t linked yet.</span>
            <Link href="/staff/link-account">Link it now</Link>
          </div>
        )}
        <main className="vb-main">{children}</main>
      </div>
    </div>
  );
}
