import { redirect } from "next/navigation";
import { recordDenied } from "@/lib/audit";
import { getStaffPrincipal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { isVulcanIntegrationEnabled } from "@/lib/integrations";
import { getSiteIconUrl } from "@/lib/site-icon";
import { getPunishmentModes } from "@/lib/punishment-modes";
import { getDiscordWebhookConfig } from "@/lib/discord-webhook";
import { RolePermissionEditor } from "@/components/RolePermissionEditor";
import { AppealQuestionEditor } from "@/components/AppealQuestionEditor";
import { IntegrationsEditor } from "@/components/IntegrationsEditor";
import { SiteIconEditor } from "@/components/SiteIconEditor";
import { PunishmentModesEditor } from "@/components/PunishmentModesEditor";
import { DiscordWebhookEditor } from "@/components/DiscordWebhookEditor";
import { PageHeader } from "@/components/PageHeader";
import { PluginConnection } from "@/components/PluginConnection";
import { APP_VERSION } from "@/lib/version";

export default async function SettingsPage() {
  const principal = await getStaffPrincipal();
  // Settings is owner-only, not permission-gated, role/permission edits
  // here can grant any permission to anyone, so only the owner identity
  // (tied to a Discord ID, not a reassignable role) is trusted with that.
  if (!principal?.isOwner) {
    await recordDenied(principal);
    redirect("/staff");
  }

  const [roles, questions, vulcanEnabled, iconUrl, punishmentModes, webhookConfig] = await Promise.all([
    prisma.staffRole.findMany({
      include: { permissions: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.appealQuestion.findMany({ orderBy: { sortOrder: "asc" } }),
    isVulcanIntegrationEnabled(),
    getSiteIconUrl(),
    getPunishmentModes(),
    getDiscordWebhookConfig(),
  ]);

  return (
    <div>
      <PageHeader title="Settings" meta={`Site v${APP_VERSION}`} />

      <SettingSection
        title="Plugin connection"
        desc="Servers running the plugin against this database. Each reports in every 30 seconds."
        bare
      >
        <div className="vb-panel" style={{ padding: 20, overflowX: "auto" }}>
          <PluginConnection />
        </div>
      </SettingSection>

      <SettingSection title="Roles & permissions" desc="Map Discord roles to what they can see and do. Re-checked on every login.">
        <RolePermissionEditor
          allPermissions={PERMISSION_KEYS}
          roles={roles.map((r) => ({
            id: r.id.toString(),
            discordRoleId: r.discordRoleId,
            displayName: r.displayName,
            permissions: r.permissions.map((p) => p.permissionKey),
          }))}
        />
      </SettingSection>

      <SettingSection title="Punishing" desc="Which ways staff can fill in a punishment reason. Manual is always available.">
        <PunishmentModesEditor
          templatesEnabled={punishmentModes.templatesEnabled}
          rulesEnabled={punishmentModes.rulesEnabled}
        />
      </SettingSection>

      <SettingSection title="Appeal questions" desc="Shown to players on the appeal form.">
        <AppealQuestionEditor
          questions={questions.map((q) => ({
            id: q.id.toString(),
            prompt: q.prompt,
            required: q.required,
            active: q.active,
            sortOrder: q.sortOrder,
          }))}
        />
      </SettingSection>

      <SettingSection title="Discord webhook" desc="Post events to a Discord channel. Leave the URL blank to turn it off.">
        <DiscordWebhookEditor url={webhookConfig.url} events={webhookConfig.events} />
      </SettingSection>

      <SettingSection title="Integrations" desc="Turning one off hides it everywhere without deleting recorded data." bare>
        <IntegrationsEditor vulcanEnabled={vulcanEnabled} />
      </SettingSection>

      <SettingSection title="Site icon" desc="A direct i.postimg.cc image link, 256×256 preferred.">
        <SiteIconEditor iconUrl={iconUrl} />
      </SettingSection>
    </div>
  );
}

function SettingSection({
  title,
  desc,
  bare,
  children,
}: {
  title: string;
  desc: string;
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="vb-setting">
      <div>
        <h2 className="vb-setting-title">{title}</h2>
        <p className="vb-setting-desc">{desc}</p>
      </div>
      <div className="vb-setting-body">
        {bare ? children : <div className="vb-panel" style={{ padding: 20 }}>{children}</div>}
      </div>
    </section>
  );
}
