import { LocalTime } from "@/components/LocalTime";

interface ViolationEventView {
  id: string;
  checkName: string;
  category: string;
  violationLevel: number;
  info: string | null;
  punished: boolean;
  occurredAt: string;
}

export function ViolationHistory({ events }: { events: ViolationEventView[] }) {
  if (events.length === 0) {
    return <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No violations recorded.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="vb-table">
        <thead>
          <tr>
            <th>Check</th>
            <th>Category</th>
            <th>VL</th>
            <th>Detail</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>
                {e.checkName}
                {e.punished && <span className="vb-pill vb-pill-danger" style={{ marginLeft: 6 }}>punished</span>}
              </td>
              <td>{e.category}</td>
              <td style={{ fontFamily: "ui-monospace, monospace" }}>{e.violationLevel}</td>
              <td style={{ color: "var(--text-dim)" }}>{e.info ?? "—"}</td>
              <td>
                <LocalTime iso={e.occurredAt} relative />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
