import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { TemplateEditor } from "@/components/TemplateEditor";

export default async function TemplatesPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "templates.view")) redirect("/staff");

  const templates = await prisma.punishmentTemplate.findMany({ orderBy: { name: "asc" } });
  const canCreate = hasPermission(principal, "templates.create");
  const canEdit = hasPermission(principal, "templates.edit");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Templates</h1>

      <TemplateEditor
        canCreate={canCreate}
        canEdit={canEdit}
        templates={templates.map((t) => ({
          id: t.id.toString(),
          name: t.name,
          type: t.type,
          defaultReason: t.defaultReason,
          defaultDuration: t.defaultDuration,
          defaultAppealable: t.defaultAppealable,
        }))}
      />
    </div>
  );
}
