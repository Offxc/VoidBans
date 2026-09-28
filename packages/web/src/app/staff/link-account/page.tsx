import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LinkAccountForm } from "@/components/LinkAccountForm";

export default async function LinkAccountPage() {
  const principal = await getStaffPrincipal();
  if (!principal) redirect("/staff/login");

  const staffUser = await prisma.staffUser.findUnique({ where: { discordId: principal.discordId } });
  if (staffUser?.minecraftUuid) redirect("/staff");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="vb-panel-strong"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          padding: "40px 36px",
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>Link your Minecraft account</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>
          One-time step before you can use the dashboard. This is how the site knows not to let staff
          punish each other. Join the server at least once, then enter your username below.
        </p>
        <LinkAccountForm />
      </div>
    </main>
  );
}
