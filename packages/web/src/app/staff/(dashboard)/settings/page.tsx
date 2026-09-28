import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { isVulcanIntegrationEnabled } from "@/lib/integrations";
import { getSiteIconUrl } from "@/lib/site-icon";
import { getPunishmentModes } from "@/lib/punishment-modes";
import { RolePermissionEditor } from "@/components/RolePermissionEditor";
import { AppealQuestionEditor } from "@/components/AppealQuestionEditor";
import { IntegrationsEditor } from "@/components/IntegrationsEditor";
import { SiteIconEditor } from "@/components/SiteIconEditor";
import { PunishmentModesEditor } from "@/components/PunishmentModesEditor";

export default async function SettingsPage() {
  const principal = await getStaffPrincipal();
  // Settings is owner-only, not permission-gated — role/permission edits
  // here can grant any permission to anyone, so only the owner identity
  // (tied to a Discord ID, not a reassignable role) is trusted with that.
  if (!principal?.isOwner) redirect("/staff");

  const [roles, questions, vulcanEnabled, iconUrl, punishmentModes] = await Promise.all([
    prisma.staffRole.findMany({
      include: { permissions: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.appealQuestion.findMany({ orderBy: { sortOrder: "asc" } }),
    isVulcanIntegrationEnabled(),
    getSiteIconUrl(),
    getPunishmentModes(),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Settings</h1>

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
        <div className="vb-section-label">Punishing</div>
        <div className="vb-panel" style={{ padding: 18 }}>
          <PunishmentModesEditor
            templatesEnabled={punishmentModes.templatesEnabled}
            rulesEnabled={punishmentModes.rulesEnabled}
          />
        </div>
      </div>

      <div className="vb-section">
        <div className="vb-section-label">Site icon</div>
        <div className="vb-panel" style={{ padding: 18 }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0 }}>
            Direct image link from postimages.org only (right-click the image there → Copy image
            address). 256×256 preferred. Shown top-left on the homepage and staff dashboard.
          </p>
          <SiteIconEditor iconUrl={iconUrl} />
        </div>
      </div>
    </div>
  );
}
