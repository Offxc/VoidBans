// Runs once when the server starts (Next.js instrumentation hook).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // ws can use optional native add-ons for speed; this connection sends a heartbeat
  // every 40s or so, so the plain JavaScript versions are plenty and one less thing to break.
  process.env.WS_NO_BUFFER_UTIL ??= "1";
  process.env.WS_NO_UTF_8_VALIDATE ??= "1";
  const { startBotPresence } = await import("@/lib/bot-presence");
  startBotPresence();
}
