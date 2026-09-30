import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteIconUrl } from "@/lib/site-icon";
import { LinkAccountForm } from "@/components/LinkAccountForm";
import { Brand } from "@/components/Brand";

export default async function LinkAccountPage() {
  const principal = await getStaffPrincipal();
  if (!principal) redirect("/staff/login");

  const staffUser = await prisma.staffUser.findUnique({ where: { discordId: principal.discordId } });
  if (staffUser?.minecraftUuid) redirect("/staff");

  const iconUrl = await getSiteIconUrl();

  return (
    <main className="vb-auth">
      <div className="vb-auth-card">
        <Brand iconUrl={iconUrl} />
        <h1>Link your Minecraft account</h1>
        <LinkAccountForm />
      </div>
    </main>
  );
}
