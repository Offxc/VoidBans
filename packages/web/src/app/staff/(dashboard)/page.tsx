import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

const FIRST_MATCH: { href: string; key: PermissionKey }[] = [
  { href: "/staff/bans", key: "bans.view" },
  { href: "/staff/appeals", key: "appeals.view" },
  { href: "/staff/players", key: "players.view_roster" },
];

export default async function StaffIndexPage() {
  const principal = await getStaffPrincipal();
  if (!principal) redirect("/staff/login");

  const landing = FIRST_MATCH.find((item) => hasPermission(principal, item.key));
  redirect(landing?.href ?? "/staff/settings");
}
