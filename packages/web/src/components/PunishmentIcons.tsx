interface IconProps {
  size?: number;
}

// Small inline icons for punishment action buttons, deliberately plain
// line icons (no icon library dependency for five glyphs) that read
// clearly at button size and pick up currentColor so they follow each
// button's severity color automatically.

export function MuteIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

// Mute with the same clock dot badge as TempHammerIcon, for consistency
// between the two "temporary" action icons.
export function TempMuteIcon({ size = 16 }: IconProps) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <MuteIcon size={size} />
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        style={{ position: "absolute", bottom: -2, right: -2 }}
      >
        <circle cx="12" cy="12" r="11" fill="currentColor" />
        <path d="M12 6v6l4 3" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}

export function KickIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

export function HammerIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9" />
      <path d="M17.64 15 22 10.64" />
      <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" />
    </svg>
  );
}

// Hammer with a small clock dot badge, for the "temporary" variant of an
// otherwise-permanent action. The badge is a filled currentColor dot with
// a tiny cut-out clock hand, simplest reliable way to layer two glyphs
// without a second color reference that could go stale.
export function TempHammerIcon({ size = 16 }: IconProps) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <HammerIcon size={size} />
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        style={{ position: "absolute", bottom: -2, right: -2 }}
      >
        <circle cx="12" cy="12" r="11" fill="currentColor" />
        <path d="M12 6v6l4 3" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}

export function WarnIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.3 3.9-8.2 14a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3l-8.2-14a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
