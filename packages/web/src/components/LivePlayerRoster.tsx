"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlayerHead } from "@/components/PlayerHead";
import { LocalTime } from "@/components/LocalTime";

interface RosterPlayer {
  uuid: string;
  username: string;
  lastLogout: string | null;
}

interface LiveOnlinePlayer {
  uuid: string;
  username: string;
  isOnline: boolean;
  lastLogout: string | null;
}

/**
 * Renders the Online/Offline split, seeded from the server-rendered initial
 * lists (so the page works with no JS and paints instantly), then
 * subscribes to /api/staff/players/live (SSE) to move players between the
 * two lists in real time, a fresh join or a quit shows up without a
 * refresh, which matters here specifically because staff need to see a
 * player the moment they connect, not N seconds later on a poll.
 */
export function LivePlayerRoster({
  initialOnline,
  initialOffline,
}: {
  initialOnline: RosterPlayer[];
  initialOffline: RosterPlayer[];
}) {
  const [online, setOnline] = useState<RosterPlayer[]>(initialOnline);
  const [offline, setOffline] = useState<RosterPlayer[]>(initialOffline);
  const [connected, setConnected] = useState(false);
  // Tracks the most recent online snapshot so that when a player drops out
  // of it, we know who they are (username, etc.) to move them straight
  // into the offline list without a refetch.
  const previousOnline = useRef(new Map(initialOnline.map((p) => [p.uuid, p])));

  useEffect(() => {
    const source = new EventSource("/api/staff/players/live");

    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));

    source.addEventListener("online", (e) => {
      const nowOnline: LiveOnlinePlayer[] = JSON.parse((e as MessageEvent).data);
      const nowOnlineMap = new Map(
        nowOnline.map((p) => [p.uuid, { uuid: p.uuid, username: p.username, lastLogout: p.lastLogout }]),
      );

      // Anyone in the previous snapshot but not the new one just went
      // offline, move them into the offline list, timestamped now (the
      // exact lastLogout will catch up next time this page does a full
      // server render, but "now" is accurate enough for a live view).
      const justWentOffline = [...previousOnline.current.values()]
        .filter((p) => !nowOnlineMap.has(p.uuid))
        .map((p) => ({ uuid: p.uuid, username: p.username, lastLogout: new Date().toISOString() }));

      setOnline([...nowOnlineMap.values()]);

      if (justWentOffline.length > 0) {
        setOffline((prev) => [...justWentOffline, ...prev.filter((p) => !nowOnlineMap.has(p.uuid))]);
      } else {
        setOffline((prev) => prev.filter((p) => !nowOnlineMap.has(p.uuid)));
      }

      previousOnline.current = nowOnlineMap;
    });

    return () => source.close();
  }, []);

  return (
    <>
      <div className="vb-section">
        <div className="vb-section-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Online
          <span
            title={connected ? "Live" : "Reconnecting…"}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: connected ? "var(--success)" : "var(--text-faint)",
            }}
          />
        </div>
        <div className="vb-panel" style={{ padding: 16 }}>
          <div style={gridStyle}>
            {online.map((p) => (
              <Link key={p.uuid} href={`/staff/players/${p.uuid}`} className="vb-card" style={cardStyle}>
                <PlayerHead uuid={p.uuid} size={40} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.username}</div>
                  <div style={{ fontSize: 12, color: "var(--success)" }}>Online</div>
                </div>
              </Link>
            ))}
            {online.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>Nobody online.</p>}
          </div>
        </div>
      </div>

      <div className="vb-section">
        <div className="vb-section-label">Offline</div>
        <div className="vb-panel" style={{ padding: 16 }}>
          <div style={gridStyle}>
            {offline.map((p) => (
              <Link key={p.uuid} href={`/staff/players/${p.uuid}`} className="vb-card" style={cardStyle}>
                <PlayerHead uuid={p.uuid} size={40} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.username}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {p.lastLogout ? <LocalTime iso={p.lastLogout} relative /> : "Never seen"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 8,
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  textDecoration: "none",
  color: "inherit",
};
