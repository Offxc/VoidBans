import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { StaffNav } from "@/components/StaffNav";
import { StaffHeader } from "@/components/StaffHeader";

export default async function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
  const principal = await getStaffPrincipal();

  if (!principal) {
    redirect("/staff/login");
  }

  const nav = [
    { href: "/staff/bans", label: "Punishments", show: hasPermission(principal, "bans.view") },
    { href: "/staff/appeals", label: "Appeals", show: hasPermission(principal, "appeals.view") },
    { href: "/staff/players", label: "Players", show: hasPermission(principal, "players.view_roster") },
    { href: "/staff/bluemap", label: "BlueMap", show: hasPermission(principal, "bluemap.view") },
    { href: "/staff/templates", label: "Templates", show: hasPermission(principal, "templates.view") },
    { href: "/staff/settings", label: "Settings", show: principal.isOwner || hasPermission(principal, "settings.manage") },
  ].filter((item) => item.show);

  return (
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      <StaffNav items={nav} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <StaffHeader
          username={principal.username}
          discordId={principal.discordId}
          avatarHash={principal.avatarHash}
          isOwner={principal.isOwner}
        />
        <main style={{ flex: 1, padding: "24px 32px 40px", maxWidth: 1100 }}>{children}</main>
      </div>
    </div>
  );
}
