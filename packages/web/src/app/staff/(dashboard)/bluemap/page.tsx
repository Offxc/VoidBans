import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export default async function BlueMapPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "bluemap.view")) redirect("/staff");

  const bluemapUrl = process.env.BLUEMAP_URL;

  if (!bluemapUrl) {
    return (
      <div>
        <h1 style={{ fontSize: 22 }}>BlueMap</h1>
        <div className="vb-panel" style={{ padding: 18 }}>
          <p style={{ color: "var(--text-dim)", margin: 0 }}>
            BLUEMAP_URL isn&apos;t set in the environment — this tab has nothing to embed yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 96px)" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>BlueMap</h1>
      <iframe
        src={bluemapUrl}
        title="BlueMap live map"
        className="vb-panel"
        style={{ flex: 1, border: "1px solid var(--glass-border)" }}
      />
    </div>
  );
}
