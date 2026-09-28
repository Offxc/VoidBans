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
      "Applies to all chats, clan names, signs, books, and item names unless stated otherwise. Violations can mean a warning, mute, kick, or ban.",
    rules: [
      {
        code: "C1",
        title: "Harassment",
        description: "Don't harass other players or staff, in any chat. This includes messaging staff for items or an in-game advantage.",
      },
      {
        code: "C2",
        title: "Spam",
        description: "No spamming. That covers repeated messages, character spam, excessive caps, and misusing reports.",
      },
      {
        code: "C3",
        title: "Offensive Topics",
        description: "No politics, religion, violence, sexual content, self-harm, or hate speech and slurs.",
      },
      {
        code: "C4",
        title: "Username",
        description: "Your username and nickname must be readable, must not impersonate another player or staff, and must not be offensive.",
      },
      {
        code: "C5",
        title: "Drama",
        description: "Player drama outside Minecraft stays out of our chat and Discord.",
      },
      {
        code: "C6",
        title: "Advertising",
        description: "No advertising other servers, services, or giveaways without approval. In-game trades and shops are fine, just don't repost too often.",
      },
      {
        code: "C7",
        title: "No Mic Replies",
        description: "If you're typing instead of talking in VC, use the VC's text chat. Don't reply to VC conversations in public chat.",
      },
      {
        code: "C8",
        title: "Language",
        description: "English only in public chat and Discord.",
      },
    ],
  },
  {
    name: "General Rules",
    description:
      "Applies everywhere unless stated otherwise, covering conduct, accounts, and staff decisions. Disputes go in a ticket, not public chat.",
    rules: [
      { code: "G1", title: "Skins", description: "Your skin must not be offensive." },
      {
        code: "G2",
        title: "Impersonation",
        description: "Don't impersonate staff, through your skin, name, or chat messages.",
      },
      {
        code: "G3",
        title: "Complicity",
        description: "Helping someone break a rule, even indirectly, makes you accountable too.",
      },
      {
        code: "G4",
        title: "Respect Decisions",
        description: "Don't complain about punishments in public chat, it upgrades to a 6-hour ban. Open a ticket instead.",
      },
      {
        code: "G5",
        title: "Rule System Abuse",
        description: "Bypassing a rule on a technicality still breaks it. Intent matters more than wording.",
      },
      {
        code: "G6",
        title: "Interfering with Staff",
        description: "Don't interfere with a staff investigation, attack staff while they're working, or refuse to cooperate.",
      },
      {
        code: "G7",
        title: "VPN / Proxy",
        description: "VPNs and proxies aren't allowed unless leadership pre-approves it.",
      },
      {
        code: "G8",
        title: "Multiple Accounts",
        description: "Two accounts per IP is fine. More than that, e.g. siblings sharing a household, needs a ticket.",
      },
    ],
  },
  {
    name: "Ingame Rules",
    description:
      "Claim your land and items. We aren't responsible for anything stolen because you had no claim, or left permissions or trust open.",
    rules: [
      {
        code: "X1",
        title: "Griefing",
        description: "Don't grief a claim you're not trusted in. Unclaimed builds, or ones you gave trust to, are at your own risk.",
      },
      {
        code: "X2",
        title: "Claim Blocking",
        description: "Don't box in another player's claim, deny their expansion, or claim over graves to block retrieval.",
      },
      {
        code: "X3",
        title: "Graves",
        description: "You can guard another player's grave until they can loot it, but never block them from retrieving it.",
      },
      {
        code: "X4",
        title: "Point Feeding",
        description: "Dying on purpose to hand a kill to an attacker or defender isn't allowed.",
      },
      {
        code: "X5",
        title: "Traps",
        description: "No teleport traps or luring players into a kill chamber they can't realistically escape.",
      },
      {
        code: "X6",
        title: "Offensive Builds",
        description: "No offensive content in builds, signs, or written books.",
      },
      {
        code: "X7",
        title: "Economy Abuse",
        description: "Bypassing the intended economy for unfair profit gets your gains taken and a rollback to before it happened. Not appealable.",
      },
    ],
  },
  {
    name: "Severe Rules",
    description:
      "Zero-tolerance. These can mean an immediate ban, often without warning, plus extended punishment for evasion or repeat offenses.",
    rules: [
      {
        code: "S1",
        title: "Punishment Evasion",
        description: "Using an alt account or any other method to dodge a punishment extends it.",
      },
      {
        code: "S2",
        title: "Competitive Advantage Mods",
        description: "Client mods that give a competitive edge are banned. Minimaps, Litematica (no fast place), glowing ores, and brightness mods are fine.",
      },
      {
        code: "S3",
        title: "Duping / Glitch Abuse",
        description: "Report glitches via ticket, don't use or share them. Covers duping and wall or claim bypasses, even attempts that fail.",
      },
      {
        code: "S4",
        title: "Personal Information",
        description: "Don't share others' names, addresses, socials, or similar. Malicious sharing is doxxing and is a permanent ban.",
      },
      {
        code: "S5",
        title: "Chargebacks",
        description: "A chargeback is a permanent ban, and we'll formally dispute it through Tebex with proof of purchase and delivery.",
      },
      {
        code: "S6",
        title: "Lag Machines",
        description: "Builds meant to cause lag, or that seriously hurt server performance, are punished based on severity.",
      },
    ],
  },
  {
    name: "Streamer Rules",
    description: "Streamers must take reasonable steps not to leak other players' locations or private info.",
    rules: [
      {
        code: "T1",
        title: "Streamer Role",
        description: "Open a ticket with your platform and channel link so we can assign the streamer role.",
      },
      {
        code: "T2",
        title: "Stream Responsibility",
        description: "You're responsible for your stream. Use a delay or overlay to stop leaks or rule-breaking content going out live.",
      },
      {
        code: "T3",
        title: "No Leaking",
        description: "Don't leak other players' base locations. Hide coordinates and don't show waypoints or maps that give it away.",
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
