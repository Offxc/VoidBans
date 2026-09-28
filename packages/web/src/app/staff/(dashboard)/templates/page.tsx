import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { TemplateEditor } from "@/components/TemplateEditor";

export default async function TemplatesPage() {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "templates.view")) redirect("/staff");

  const templates = await prisma.punishmentTemplate.findMany({ orderBy: { name: "asc" } });
  const canEdit = hasPermission(principal, "templates.create") || hasPermission(principal, "templates.edit");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Templates</h1>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 0 }}>
        Reusable punishment presets, available when issuing a punishment from a player&apos;s profile.
      </p>

      <TemplateEditor
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
