// The booth's chibi dragon (public/dragon.png = 3 frames: eyes open | blink | happy). Decoration only.
export default function Dragon({ frame = 0, className = "w-28" }: { frame?: 0 | 1 | 2; className?: string }) {
  return (
    <div
      aria-hidden
      className={`aspect-[48/44] shrink-0 bg-[url('/dragon.png')] bg-[length:300%_100%] bg-no-repeat [image-rendering:pixelated] ${className}`}
      style={{ backgroundPositionX: `${frame * 50}%` }}
    />
  );
}
