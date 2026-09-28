/**
 * One-off import of the server's existing rulebook into RuleCategory /
 * PunishmentRule. Run once on the server that has the real DATABASE_URL:
 *
 *   cd packages/web
 *   pnpm exec tsx prisma/seed-rules.ts
 *
 * Safe to re-run — categories are matched by name and rules by code, so
 * re-running updates existing rows instead of duplicating them.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_DISCORD_ID = "000000000000000000"; // seed script, not a real staff member

interface RuleSeed {
  code: string;
  title: string;
  description: string;
}

interface CategorySeed {
  name: string;
  description: string;
  rules: RuleSeed[];
}

const CATEGORIES: CategorySeed[] = [
  {
    name: "Chat Rules",
    description:
      "These rules apply to all available channels — public and private, clan and ally — as well as clan names, signs, written books, item names, and more, unless otherwise stated. Violations may result in warnings, mutes, kicks, or bans.",
    rules: [
      {
        code: "C1",
        title: "Harassment",
        description:
          "Do not harass other players or staff. Applies to ALL chats. Includes messaging staff for items or in-game advantages.",
      },
      {
        code: "C2",
        title: "Spam",
        description: "Spamming is prohibited. Repeated messages. Character spam. All/majority caps spam. Misusing reports.",
      },
      {
        code: "C3",
        title: "Offensive Topics",
        description: "No politics/religion. No violence/sexual content. No suicide/self-harm. No hate speech/slurs.",
      },
      {
        code: "C4",
        title: "Username",
        description:
          "Your username and /nick must comply. Readable & typable. Must not imitate another user. Must not falsely mark yourself as staff. Must contain no inappropriate/offensive content.",
      },
      {
        code: "C5",
        title: "Drama",
        description:
          "Player-related drama beyond the scope of Minecraft must be handled outside public chat channels and outside our Discord.",
      },
      {
        code: "C6",
        title: "Advertising",
        description:
          "Advertising other servers, services, or giveaways is prohibited without approval. Applies to all channels + signs + books. In-game trades/shops allowed — don't repost too frequently.",
      },
      {
        code: "C7",
        title: "No Mic Replies",
        description:
          "If you're in a VC but typing (no mic), use the VC's attached text chat. Don't reply in public channels or in-game chat to VC conversations.",
      },
      {
        code: "C8",
        title: "Language",
        description: "English is required in all public chat channels. This applies to Discord, as well as in-game.",
      },
    ],
  },
  {
    name: "General Rules",
    description:
      "These general rules apply everywhere unless stated otherwise. They cover conduct, account/access rules, and how to handle staff decisions. Disputes belong in a ticket, not public chat.",
    rules: [
      { code: "G1", title: "Skins", description: "Your Minecraft skin must not contain offensive content." },
      {
        code: "G2",
        title: "Impersonation",
        description: "Impersonating staff is prohibited, including through skins, names/nicks, or chat messages.",
      },
      {
        code: "G3",
        title: "Complicity",
        description:
          "If you aid, assist, or otherwise support rule-breaking — even indirectly — you can be held equally accountable.",
      },
      {
        code: "G4",
        title: "Respect Decisions",
        description:
          "Do NOT complain about punishments publicly. Public disputes will upgrade the punishment: 6-hour ban. If you have concerns, open a ticket.",
      },
      {
        code: "G5",
        title: "Rule System Abuse",
        description:
          "Exploiting the rule system is a punishable offense. Attempting to bypass a rule \"by technicality\" is still punishable. Actions that dodge rule intent still count as violations.",
      },
      {
        code: "G6",
        title: "Interfering with Staff",
        description:
          "Staff investigations must not be interfered with. Intentionally attacking staff while they're working. Obstructing an investigation or refusing to cooperate.",
      },
      {
        code: "G7",
        title: "VPN / Proxy",
        description: "Use of proxies or VPNs is strictly prohibited unless pre-authorized by leadership.",
      },
      {
        code: "G8",
        title: "Multiple Accounts",
        description:
          "We allow TWO accounts per IP. If multiple players in your household (e.g., siblings), open a ticket.",
      },
    ],
  },
  {
    name: "Ingame Rules",
    description:
      "Please claim land and thereby any and all items. Staff are not responsible for lost items due to stealing caused by lack of land claim. If you have accidentally left open permissions or given trust; we are not responsible for the lost items.",
    rules: [
      {
        code: "X1",
        title: "Griefing",
        description:
          "Griefing inside any claim you aren't trusted in is prohibited. Staff will rollback and punish as appropriate. Unclaimed builds (or builds where you gave trust) are at your own risk.",
      },
      {
        code: "X2",
        title: "Claim Blocking",
        description:
          "Claiming to restrict another player's claim is prohibited. This includes fully encircling their claim, snaking/strip-claiming to deny expansion, or claiming graves to prevent retrieval.",
      },
      {
        code: "X3",
        title: "Graves",
        description:
          "You may defend another player's grave until you are able to loot it. You cannot obstruct a grave in any way that prevents retrieval/access.",
      },
      {
        code: "X4",
        title: "Point Feeding",
        description: "Point feeding (purposely dying to the attacker/defender) for any benefit is prohibited.",
      },
      {
        code: "X5",
        title: "Traps",
        description:
          "Teleportation traps are prohibited. Teleporting a player into an inescapable trap/kill chamber (no realistic chance to escape).",
      },
      {
        code: "X6",
        title: "Offensive Builds",
        description: "Builds that display offensive content are prohibited. Includes signs and written books.",
      },
      {
        code: "X7",
        title: "Economy Abuse",
        description:
          "Using farms/setups that bypass the intended economy (via unintended mechanics, unfair profit printing, or any method that harms balance or server performance) will result in: immediate removal, confiscation of all gains, rollback of player data/base/inventory to before the abuse occurred. Eco-abuse rollbacks are final and not appealable.",
      },
    ],
  },
  {
    name: "Severe Rules",
    description:
      "Severe rules are zero-tolerance. Violations may result in immediate bans (often without warning) and extended punishments for evasion or repeat offenses.",
    rules: [
      {
        code: "S1",
        title: "Punishment Evasion",
        description:
          "Attempts to evade punishment are prohibited. Using alternate accounts. Using commands or other methods to bypass restrictions. Will result in an extension of the existing punishment.",
      },
      {
        code: "S2",
        title: "Competitive Advantage Mods",
        description:
          "Client mods that give a competitive advantage are forbidden. Exceptions may exist — ask staff if unsure. Allowed: mini-maps, Litematica (no fast place), glowing ores, brightness mods.",
      },
      {
        code: "S3",
        title: "Duping / Glitch Abuse",
        description:
          "If you find a glitch, report it via ticket. Do not use it or share it with others. Any wall/claim bypass glitching counts (enderpearl/vehicle/boat/entity, etc.). Includes duping and attempted abuse (even if it \"doesn't work\").",
      },
      {
        code: "S4",
        title: "Personal Information",
        description:
          "Do not share information about others (names, addresses, socials, etc.). Malicious sharing is treated as doxxing and results in a permanent ban.",
      },
      {
        code: "S5",
        title: "Chargebacks",
        description:
          "Any chargeback will result in a permanent ban, and will be formally disputed through Tebex with your payment provider/card issuer using purchase and delivery evidence.",
      },
      {
        code: "S6",
        title: "Lag Machines",
        description: "Any build intended to cause lag, or that significantly impacts server performance, will be punished based on severity.",
      },
    ],
  },
  {
    name: "Streamer Rules",
    description: "Streamers must take reasonable steps to avoid leaking player locations or private information.",
    rules: [
      {
        code: "T1",
        title: "Streamer Role",
        description: "Open a ticket and send your platform (Twitch/YouTube/Kick/etc.) & channel link so we can assign the correct role.",
      },
      {
        code: "T2",
        title: "Stream Responsibility",
        description:
          "You are responsible for what your stream shows. Use scenes/overlays/delay to prevent leaks or rule-breaking content being broadcast.",
      },
      {
        code: "T3",
        title: "No Leaking",
        description:
          "Do not leak other players' base locations. Hide coords when visiting, and don't show waypoints/overlays/maps that may give it away.",
      },
    ],
  },
];

async function main() {
  for (let categoryIndex = 0; categoryIndex < CATEGORIES.length; categoryIndex++) {
    const cat = CATEGORIES[categoryIndex]!;

    const existingCategory = await prisma.ruleCategory.findFirst({ where: { name: cat.name }, select: { id: true } });
    const category = existingCategory
      ? await prisma.ruleCategory.update({
          where: { id: existingCategory.id },
          data: { description: cat.description, sortOrder: categoryIndex },
        })
      : await prisma.ruleCategory.create({
          data: { name: cat.name, description: cat.description, sortOrder: categoryIndex },
        });

    for (let ruleIndex = 0; ruleIndex < cat.rules.length; ruleIndex++) {
      const rule = cat.rules[ruleIndex]!;
      await prisma.punishmentRule.upsert({
        where: { code: rule.code },
        create: {
          categoryId: category.id,
          code: rule.code,
          title: rule.title,
          description: rule.description,
          sortOrder: ruleIndex,
          createdByDiscordId: SYSTEM_DISCORD_ID,
        },
        update: {
          categoryId: category.id,
          title: rule.title,
          description: rule.description,
          sortOrder: ruleIndex,
        },
      });
    }

    console.log(`${cat.name}: ${cat.rules.length} rules`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
