import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { isVulcanIntegrationEnabled } from "@/lib/integrations";
import { getRulesConfig } from "@/lib/rules";
import { RolePermissionEditor } from "@/components/RolePermissionEditor";
import { AppealQuestionEditor } from "@/components/AppealQuestionEditor";
import { IntegrationsEditor } from "@/components/IntegrationsEditor";
import { RulesEditor } from "@/components/RulesEditor";

export default async function SettingsPage() {
  const principal = await getStaffPrincipal();
  // Settings is intentionally owner-gated at the page level, not just
  // behind settings.manage, since role/permission edits here can grant
  // settings.manage to someone else — only the owner identity is trusted
  // to bootstrap that.
  if (!principal?.isOwner) redirect("/staff");

  const [roles, questions, vulcanEnabled, rulesConfig] = await Promise.all([
    prisma.staffRole.findMany({
      include: { permissions: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.appealQuestion.findMany({ orderBy: { sortOrder: "asc" } }),
    isVulcanIntegrationEnabled(),
    getRulesConfig(),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 0 }}>Owner-only.</p>

      <div className="vb-section">
        <div className="vb-section-label">Roles &amp; permissions</div>
        <div className="vb-panel" style={{ padding: 18 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0 }}>
            Map a Discord role to what it can see and do on the site. Someone&apos;s effective permissions are
            the union across every mapped role they currently hold in Discord, re-checked on every login.
          </p>
          <RolePermissionEditor
            allPermissions={PERMISSION_KEYS}
            roles={roles.map((r) => ({
              id: r.id.toString(),
              discordRoleId: r.discordRoleId,
              displayName: r.displayName,
              permissions: r.permissions.map((p) => p.permissionKey),
            }))}
          />
        </div>
      </div>

      <div className="vb-section">
        <div className="vb-section-label">Appeal questions</div>
        <div className="vb-panel" style={{ padding: 18 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0 }}>
            Shown to players submitting an appeal, in order. Editing this doesn&apos;t change answers already
            submitted — only what&apos;s asked going forward.
          </p>
          <AppealQuestionEditor
            questions={questions.map((q) => ({
              id: q.id.toString(),
              prompt: q.prompt,
              required: q.required,
              active: q.active,
              sortOrder: q.sortOrder,
            }))}
          />
        </div>
      </div>

      <div className="vb-section">
        <div className="vb-section-label">Integrations</div>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0 }}>
          Optional third-party plugins the dashboard can pull extra data from. Turning one off hides
          its UI everywhere without deleting anything already recorded.
        </p>
        <IntegrationsEditor vulcanEnabled={vulcanEnabled} />
      </div>

      <div className="vb-section">
        <div className="vb-section-label">Server rules</div>
        <div className="vb-panel" style={{ padding: 18 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0 }}>
            Written in Markdown. When enabled, a &quot;Rules&quot; button appears on the public homepage
            next to the ban lookup box, linking to a dedicated <code>/rules</code> page.
          </p>
          <RulesEditor enabled={rulesConfig.enabled} markdown={rulesConfig.markdown} />
        </div>
      </div>
    </div>
  );
}
