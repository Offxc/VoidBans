import { LocalTime } from "@/components/LocalTime";

interface Props {
  active: boolean;
  expiresAt: string | null;
  /** Kicks and warnings happen once, so "Inactive" would read as revoked. */
  type?: "BAN" | "MUTE" | "KICK" | "WARN";
  /** Set once the plugin has acted on a kick, ban or warning. */
  delivered?: boolean;
}

/**
 * "Active" alone doesn't tell staff or a player when a temp punishment
 * actually lifts, this always resolves to one of: Inactive, Active
 * (permanent), or Active until <time>, so the expiry is never hidden
 * behind a bare "Active" pill.
 */
export function PunishmentStatus({ active, expiresAt, type, delivered }: Props) {
  if (type === "KICK") {
    return <span className="vb-pill vb-pill-neutral">Issued</span>;
  }

  if (type === "WARN") {
    // A warning for someone who is offline waits until they next join.
    return delivered ? (
      <span className="vb-pill vb-pill-neutral">Delivered</span>
    ) : (
      <span className="vb-pill vb-pill-warn">Not seen yet</span>
    );
  }

  if (!active) {
    return <span className="vb-pill vb-pill-neutral">Inactive</span>;
  }

  if (!expiresAt) {
    return <span className="vb-pill vb-pill-danger">Active · Permanent</span>;
  }

  const expired = new Date(expiresAt).getTime() <= Date.now();
  if (expired) {
    return <span className="vb-pill vb-pill-neutral">Expired</span>;
  }

  return (
    <span className="vb-pill vb-pill-warn">
      Active until <LocalTime iso={expiresAt} />
    </span>
  );
}
