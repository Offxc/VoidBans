export function PlayerHead({ uuid, size = 32 }: { uuid: string; size?: number }) {
  return (
    // crafatar renders from the player's UUID, so heads keep working even
    // if the player has since changed their username. Plain <img>, not
    // next/image: these are small external avatars from a third-party
    // service, not assets worth Next's optimization pipeline.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://crafatar.com/avatars/${uuid}?size=${size * 2}&overlay`}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: 4, imageRendering: "pixelated", flexShrink: 0 }}
      loading="lazy"
    />
  );
}
