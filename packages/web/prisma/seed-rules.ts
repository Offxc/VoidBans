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
      "Applies to all chats, clan names, signs, books, and item names unless stated otherwise. Violations may result in warnings, mutes, kicks, or bans.",
    rules: [
      {
        code: "C1",
        title: "Harassment",
        description: "Do not harass other players or staff. Applies to ALL chats. Includes messaging staff for items or advantages.",
      },
      {
        code: "C2",
        title: "Spam",
        description: "Spamming is prohibited. Repeated messages, character spam, all/majority caps, and misusing reports.",
      },
      {
        code: "C3",
        title: "Offensive Topics",
        description: "No politics/religion. No violence/sexual content. No suicide/self-harm. No hate speech/slurs.",
      },
      {
        code: "C4",
        title: "Username",
        description: "Must be readable & typable. Must not imitate another user, falsely mark yourself as staff, or be offensive.",
      },
      {
        code: "C5",
        title: "Drama",
        description: "Player-related drama beyond Minecraft stays out of public chat and out of our Discord.",
      },
      {
        code: "C6",
        title: "Advertising",
        description: "Advertising other servers, services, or giveaways is prohibited without approval. Trades/shops are fine, don't repost too often.",
      },
      {
        code: "C7",
        title: "No Mic Replies",
        description: "If you're typing (no mic) in VC, use the VC's text chat. Don't reply in public or in-game chat to VC conversations.",
      },
      {
        code: "C8",
        title: "Language",
        description: "English is required in all public chat channels, in Discord and in-game.",
      },
    ],
  },
  {
    name: "General Rules",
    description:
      "Applies everywhere unless stated otherwise. Covers conduct, account/access rules, and staff decisions. Disputes belong in a ticket, not public chat.",
    rules: [
      { code: "G1", title: "Skins", description: "Your skin must not contain offensive content." },
      {
        code: "G2",
        title: "Impersonation",
        description: "Impersonating staff is prohibited, including through skins, names/nicks, or chat messages.",
      },
      {
        code: "G3",
        title: "Complicity",
        description: "If you aid or otherwise support rule-breaking, even indirectly, you can be held equally accountable.",
      },
      {
        code: "G4",
        title: "Respect Decisions",
        description: "Do NOT complain about punishments publicly. Public disputes upgrade to a 6-hour ban. Open a ticket instead.",
      },
      {
        code: "G5",
        title: "Rule System Abuse",
        description: 'Exploiting the rule system is punishable. Bypassing a rule "by technicality" still counts as a violation.',
      },
      {
        code: "G6",
        title: "Interfering with Staff",
        description: "Staff investigations must not be interfered with. No attacking staff while they work, or refusing to cooperate.",
      },
      {
        code: "G7",
        title: "VPN / Proxy",
        description: "Use of proxies or VPNs is strictly prohibited unless pre-authorized by leadership.",
      },
      {
        code: "G8",
        title: "Multiple Accounts",
        description: "We allow TWO accounts per IP. Multiple players in one household (e.g. siblings) should open a ticket.",
      },
    ],
  },
  {
    name: "Ingame Rules",
    description:
      "Please claim your land and items. Staff aren't responsible for anything stolen due to lack of claim, or open permissions/trust.",
    rules: [
      {
        code: "X1",
        title: "Griefing",
        description: "Griefing a claim you aren't trusted in is prohibited. Unclaimed builds (or ones you gave trust to) are at your own risk.",
      },
      {
        code: "X2",
        title: "Claim Blocking",
        description: "Restricting another player's claim is prohibited. Includes encircling, snake/strip-claiming, or claiming over graves.",
      },
      {
        code: "X3",
        title: "Graves",
        description: "You may defend another player's grave until they can loot it, but never obstruct it from retrieval.",
      },
      {
        code: "X4",
        title: "Point Feeding",
        description: "Point feeding (purposely dying to the attacker/defender) for any benefit is prohibited.",
      },
      {
        code: "X5",
        title: "Traps",
        description: "Teleportation traps are prohibited, including into an inescapable trap or kill chamber.",
      },
      {
        code: "X6",
        title: "Offensive Builds",
        description: "Builds that display offensive content are prohibited. Includes signs and written books.",
      },
      {
        code: "X7",
        title: "Economy Abuse",
        description: "Bypassing the intended economy for unfair profit means immediate removal and rollback. Not appealable.",
      },
    ],
  },
  {
    name: "Severe Rules",
    description:
      "Zero-tolerance. Violations may result in immediate bans, often without warning, and extended punishment for evasion or repeat offenses.",
    rules: [
      {
        code: "S1",
        title: "Punishment Evasion",
        description: "Attempts to evade punishment, including alt accounts or bypassing restrictions, extend the existing punishment.",
      },
      {
        code: "S2",
        title: "Competitive Advantage Mods",
        description: "Client mods giving a competitive advantage are forbidden. Mini-maps, Litematica (no fast place), glowing ores, and brightness mods are allowed.",
      },
      {
        code: "S3",
        title: "Duping / Glitch Abuse",
        description: "Report glitches via ticket, don't use or share them. Includes duping and any wall/claim bypass, even attempted.",
      },
      {
        code: "S4",
        title: "Personal Information",
        description: "Do not share others' info (names, addresses, socials, etc.). Malicious sharing is doxxing and a permanent ban.",
      },
      {
        code: "S5",
        title: "Chargebacks",
        description: "Any chargeback results in a permanent ban, formally disputed through Tebex with purchase/delivery evidence.",
      },
      {
        code: "S6",
        title: "Lag Machines",
        description: "Builds intended to cause lag, or that significantly impact server performance, are punished based on severity.",
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
        description: "Open a ticket with your platform and channel link so we can assign the correct role.",
      },
      {
        code: "T2",
        title: "Stream Responsibility",
        description: "You are responsible for what your stream shows. Use scenes/overlays/delay to prevent leaks or rule-breaking content.",
      },
      {
        code: "T3",
        title: "No Leaking",
        description: "Do not leak other players' base locations. Hide coords, and don't show waypoints/maps that may give it away.",
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
