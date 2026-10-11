"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * A 9:16 still that only loads and plays its video while hovered or focused,
 * so a page full of clips costs a few small JPGs instead of many 1080p streams.
 */
export function MediaTile({
  poster,
  video,
  background,
  label,
  children,
}: {
  poster: string;
  video: string;
  /** Optional still drawn underneath (used for transparent card overlays). */
  background?: string;
  label: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  const start = () => {
    setActive(true);
    requestAnimationFrame(() => void ref.current?.play().catch(() => {}));
  };
  const stop = () => {
    ref.current?.pause();
    setActive(false);
  };

  return (
    <figure className="flex flex-col gap-1.5">
      <div
        tabIndex={0}
        role="img"
        aria-label={label}
        onMouseEnter={start}
        onMouseLeave={stop}
        onFocus={start}
        onBlur={stop}
        className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
      >
        {background && (
          // eslint-disable-next-line @next/next/no-img-element -- local 270px poster
          <img src={background} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- local 270px poster */}
        <img src={poster} alt="" loading="lazy" className={`absolute inset-0 size-full object-cover transition-opacity ${active ? "opacity-0" : ""}`} />
        {active && <video ref={ref} src={video} muted loop playsInline preload="auto" className="absolute inset-0 size-full object-cover" />}
      </div>
      {children && <figcaption className="flex flex-col gap-0.5">{children}</figcaption>}
    </figure>
  );
}
