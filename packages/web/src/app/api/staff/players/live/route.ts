import { NextRequest } from "next/server";
import { getStaffPrincipal } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Server-Sent Events stream of the online player roster. Polls the DB on a
// short interval from inside this single long-lived connection (not once
// per client) and only pushes a message when the online set actually
// changed — one Node process, one `web` container, no Redis/pub-sub
// needed at this scale. The plugin writes players.isOnline directly on
// join/quit; this just notices the row changed and tells the browser
// without the browser having to poll or the staff member refreshing.
const POLL_INTERVAL_MS = 1000;

interface LivePlayer {
  uuid: string;
  username: string;
  isOnline: boolean;
  lastLogout: string | null;
}

async function fetchOnlineState(): Promise<LivePlayer[]> {
  const players = await prisma.player.findMany({
    where: { isOnline: true },
    orderBy: { username: "asc" },
    select: { uuid: true, username: true, isOnline: true, lastLogout: true },
  });
  return players.map((p) => ({
    uuid: p.uuid,
    username: p.username,
    isOnline: p.isOnline,
    lastLogout: p.lastLogout?.toISOString() ?? null,
  }));
}

function snapshotKey(players: LivePlayer[]): string {
  return players.map((p) => p.uuid).sort().join(",");
}

export async function GET(req: NextRequest) {
  const principal = await getStaffPrincipal();
  if (!principal || !hasPermission(principal, "players.view_roster")) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      let lastKey: string | null = null;

      // Initial snapshot immediately, then diff on each poll.
      try {
        const initial = await fetchOnlineState();
        lastKey = snapshotKey(initial);
        send("online", initial);
      } catch {
        // If the first fetch fails, the poll loop below will keep retrying.
      }

      const interval = setInterval(async () => {
        if (closed) return;
        try {
          const current = await fetchOnlineState();
          const key = snapshotKey(current);
          if (key !== lastKey) {
            lastKey = key;
            send("online", current);
          }
        } catch {
          // Transient DB hiccup — skip this tick, try again next interval.
        }
      }, POLL_INTERVAL_MS);

      // Keepalive comment every 20s so intermediate proxies (Caddy) don't
      // time out an apparently-idle connection.
      const keepalive = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 20_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
