import { BanLookupForm } from "@/components/BanLookup";
import { SiteShell } from "@/components/SiteShell";

// Reads site_settings at request time (icon, whether Rules shows) and must
// not be baked into a static page at build time with no DATABASE_URL.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <SiteShell>
      <section className="vb-hero">
        <h1 className="vb-hero-title">Ban lookup</h1>
        <BanLookupForm />
        <p className="vb-hero-hint">Your ban ID is in your kick or mute message.</p>
      </section>
    </SiteShell>
  );
}
