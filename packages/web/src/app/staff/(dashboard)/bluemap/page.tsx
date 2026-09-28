import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getBlueMapConfig } from "@/lib/bluemap";

export default async function BlueMapPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "bluemap.view")) redirect("/staff");

  const { enabled, url } = await getBlueMapConfig();
  if (!enabled || !url) redirect("/staff");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 96px)" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>BlueMap</h1>
      <iframe
        src={url}
        title="BlueMap live map"
        className="vb-panel"
        style={{ flex: 1, border: "1px solid var(--glass-border)" }}
      />
    </div>
  );
}
