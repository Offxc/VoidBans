import { LocalTime } from "@/components/LocalTime";

export interface ActivityEvent {
  id: string;
  at: string;
  kind: "punishment" | "appeal" | "note";
  summary: string;
  detail: string;
}

const KIND_COLOR: Record<ActivityEvent["kind"], string> = {
  punishment: "var(--danger)",
  appeal: "var(--accent-2)",
  note: "var(--text-dim)",
};

const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  punishment: "Punishment",
  appeal: "Appeal",
  note: "Note",
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <p style={{ color: "var(--text-dim)", fontSize: 14, padding: "14px 0" }}>No activity yet.</p>;
  }

  return (
    <div>
      {events.map((e) => (
        <div
          key={e.id}
          style={{ display: "flex", gap: 10, padding: "12px 0", borderTop: "1px solid rgba(168, 130, 255, 0.08)" }}
        >
          <span
            style={{
              flexShrink: 0,
              marginTop: 5,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: KIND_COLOR[e.kind],
              boxShadow: `0 0 8px ${KIND_COLOR[e.kind]}`,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>{e.summary}</div>
            <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 2 }}>
              {KIND_LABEL[e.kind]} · {e.detail} · <LocalTime iso={e.at} relative />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
