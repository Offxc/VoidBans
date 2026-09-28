import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PunishmentRuleEditor } from "@/components/PunishmentRuleEditor";

export default async function RulesPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "rules.view")) redirect("/staff");

  const rules = await prisma.punishmentRule.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
  const canCreate = hasPermission(principal, "rules.create");
  const canEdit = hasPermission(principal, "rules.edit");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Rules</h1>

      <PunishmentRuleEditor
        canCreate={canCreate}
        canEdit={canEdit}
        rules={rules.map((r) => ({
          id: r.id.toString(),
          code: r.code,
          title: r.title,
          description: r.description,
          type: r.type,
          defaultDuration: r.defaultDuration,
          defaultAppealable: r.defaultAppealable,
          active: r.active,
        }))}
      />
    </div>
  );
}
