import { PrismaClient } from "@prisma/client";
import { generatePublicBanId } from "../src/lib/ban-id";

const prisma = new PrismaClient();

// Real Mojang UUIDs for well-known default skins, so crafatar renders
// actual heads instead of broken images during local preview.
const PLAYERS = [
  { uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5", username: "Notch" },
  { uuid: "61699b2e-d327-4a01-9f1e-0ea8c3f06bc6", username: "jeb_" },
  { uuid: "f6489b79-7a9f-49e2-980e-265a05dbc3af", username: "Dinnerbone" },
  { uuid: "853c80ef-3c37-49fd-aa49-938b674adae6", username: "xX_Builder_Xx" },
  { uuid: "0e4ce775-d086-4649-804d-df9647439959", username: "GriefMaster99" },
];

async function main() {
  console.log("Seeding dev data...");

  const now = Date.now();

  for (const [i, p] of PLAYERS.entries()) {
    const isOnline = i < 2;
    await prisma.player.upsert({
      where: { uuid: p.uuid },
      create: {
        uuid: p.uuid,
        username: p.username,
        lastSeenUsername: p.username,
        firstJoined: new Date(now - 1000 * 60 * 60 * 24 * (30 + i * 10)),
        lastLogin: new Date(now - 1000 * 60 * 60 * i),
        lastLogout: isOnline ? null : new Date(now - 1000 * 60 * 30 * (i + 1)),
        isOnline,
      },
      update: { isOnline },
    });

    for (let s = 0; s < 4; s++) {
      const loginAt = new Date(now - 1000 * 60 * 60 * 24 * s - 1000 * 60 * 60 * i);
      const duration = 1800 + s * 900;
      await prisma.session.create({
        data: {
          playerUuid: p.uuid,
          loginAt,
          logoutAt: new Date(loginAt.getTime() + duration * 1000),
          durationSeconds: duration,
          serverId: "survival",
          ipAddress: `203.0.113.${10 + i}`,
        },
      });
    }
  }

  const templates = await Promise.all([
    prisma.punishmentTemplate.create({
      data: {
        name: "Griefing",
        type: "BAN",
        defaultReason: "Griefing another player's build without permission.",
        defaultDuration: 60 * 60 * 24 * 7,
        defaultAppealable: true,
        createdByDiscordId: "000000000000000001",
      },
    }),
    prisma.punishmentTemplate.create({
      data: {
        name: "Hacked client",
        type: "BAN",
        defaultReason: "Use of an unauthorized client modification (X-ray, fly, killaura).",
        defaultDuration: null,
        defaultAppealable: true,
        createdByDiscordId: "000000000000000001",
      },
    }),
    prisma.punishmentTemplate.create({
      data: {
        name: "Chat spam",
        type: "MUTE",
        defaultReason: "Repeated spam in chat after a warning.",
        defaultDuration: 60 * 60 * 6,
        defaultAppealable: false,
        createdByDiscordId: "000000000000000001",
      },
    }),
  ]);

  const banned = PLAYERS[3]!;
  const appealedBan = await prisma.punishment.create({
    data: {
      publicBanId: generatePublicBanId(),
      playerUuid: banned.uuid,
      type: "BAN",
      reason: templates[0]!.defaultReason,
      templateId: templates[0]!.id,
      staffDiscordId: "000000000000000001",
      staffUsername: "HeadAdmin",
      expiresAt: new Date(now + 1000 * 60 * 60 * 24 * 5),
      appealable: true,
    },
  });

  const questions = await Promise.all([
    prisma.appealQuestion.create({
      data: { prompt: "Why should you be unbanned?", sortOrder: 1, required: true },
    }),
    prisma.appealQuestion.create({
      data: { prompt: "What will you do differently?", sortOrder: 2, required: true },
    }),
    prisma.appealQuestion.create({
      data: { prompt: "Anything else you'd like staff to know?", sortOrder: 3, required: false },
    }),
  ]);

  await prisma.appeal.create({
    data: {
      punishmentId: appealedBan.id,
      answers: {
        [questions[0]!.id.toString()]: "I didn't realize that plot was claimed — genuinely thought it was abandoned.",
        [questions[1]!.id.toString()]: "I'll check /plot info before building anywhere that isn't obviously mine.",
      },
      status: "PENDING",
    },
  });

  const permBanned = PLAYERS[4]!;
  await prisma.punishment.create({
    data: {
      publicBanId: generatePublicBanId(),
      playerUuid: permBanned.uuid,
      type: "BAN",
      reason: templates[1]!.defaultReason,
      templateId: templates[1]!.id,
      staffDiscordId: "000000000000000001",
      staffUsername: "HeadAdmin",
      expiresAt: null,
      appealable: true,
    },
  });

  await prisma.punishment.create({
    data: {
      publicBanId: generatePublicBanId(),
      playerUuid: PLAYERS[2]!.uuid,
      type: "MUTE",
      reason: templates[2]!.defaultReason,
      templateId: templates[2]!.id,
      staffDiscordId: "000000000000000002",
      staffUsername: "ModOnDuty",
      expiresAt: new Date(now + 1000 * 60 * 60 * 3),
      appealable: false,
    },
  });

  await prisma.staffRole.create({
    data: {
      discordRoleId: "111111111111111111",
      discordRoleName: "Moderator",
      displayName: "Moderator",
      color: "#5b8def",
      permissions: {
        create: [
          { permissionKey: "bans.view" },
          { permissionKey: "bans.issue" },
          { permissionKey: "appeals.view" },
          { permissionKey: "players.view_roster" },
          { permissionKey: "players.view_sessions" },
          { permissionKey: "templates.view" },
        ],
      },
    },
  });

  await prisma.staffRole.create({
    data: {
      discordRoleId: "222222222222222222",
      discordRoleName: "Helper",
      displayName: "Helper",
      color: "#8b93a1",
      permissions: {
        create: [
          { permissionKey: "bans.view" },
          { permissionKey: "bans.request" },
          { permissionKey: "players.view_roster" },
        ],
      },
    },
  });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
