import { BanLookupForm } from "@/components/BanLookup";
import { SiteShell } from "@/components/SiteShell";

// Reads site_settings at request time (icon, whether Rules shows) — must
// not be baked into a static page at build time with no DATABASE_URL.
export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Find your ban ID",
    body: "It's shown on your disconnect or mute message in-game, starting with VB-.",
  },
  {
    title: "Review the details",
    body: "See the punishment type, the reason, which rules were broken, and when it ends.",
  },
  {
    title: "Appeal if eligible",
    body: "Appealable punishments have a form on the same page. Staff reply there.",
  },
];

export default function HomePage() {
  return (
    <SiteShell>
      <section className="vb-hero">
        <span className="vb-eyebrow">VoidSMP punishment lookup</span>
        <h1 className="vb-hero-title">Check a ban or mute</h1>
        <p className="vb-hero-sub">
          Enter the ban ID from your in-game message to see why it was issued and whether you can
          appeal.
        </p>
        <BanLookupForm />
      </section>

      <section className="vb-steps" aria-label="How it works">
        {STEPS.map((step, i) => (
          <div key={step.title} className="vb-step">
            <div className="vb-step-num">{i + 1}</div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        ))}
      </section>
    </SiteShell>
  );
}
