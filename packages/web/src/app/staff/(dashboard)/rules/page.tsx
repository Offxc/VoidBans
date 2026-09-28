import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isRulesPageEnabled } from "@/lib/rules";
import { RuleCategoryEditor } from "@/components/RuleCategoryEditor";
import { RulesPageToggle } from "@/components/RulesPageToggle";

export default async function RulesPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "rules.view")) redirect("/staff");

  const canCreate = hasPermission(principal, "rules.create");
  const canEdit = hasPermission(principal, "rules.edit");

  const [categories, rulesPageEnabled] = await Promise.all([
    prisma.ruleCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { rules: { orderBy: [{ sortOrder: "asc" }, { code: "asc" }] } },
    }),
    isRulesPageEnabled(),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Rules</h1>

      {principal.isOwner && (
        <div className="vb-panel" style={{ padding: 18, marginBottom: 20 }}>
          <RulesPageToggle enabled={rulesPageEnabled} />
        </div>
      )}

      <RuleCategoryEditor
        canCreate={canCreate}
        canEdit={canEdit}
        categories={categories.map((c) => ({
          id: c.id.toString(),
          name: c.name,
          description: c.description,
          rules: c.rules.map((r) => ({
            id: r.id.toString(),
            code: r.code,
            title: r.title,
            description: r.description,
            suggestedType: r.suggestedType,
            defaultDuration: r.defaultDuration,
            defaultAppealable: r.defaultAppealable,
            active: r.active,
          })),
        }))}
      />
    </div>
  );
}
