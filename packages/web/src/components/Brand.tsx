import Link from "next/link";

export function Brand({ iconUrl, href = "/" }: { iconUrl: string | null; href?: string }) {
  return (
    <Link href={href} className="vb-brand">
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt="" className="vb-brand-mark" />
      ) : (
        <span className="vb-brand-mark vb-brand-fallback">V</span>
      )}
      VoidSMP Bans
    </Link>
  );
}
