import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { Transition } from "../lib/scripts/types";

/** Frames each half of a transition lasts: the outgoing shot leaves, the incoming one arrives. */
const OUT = 6;
const IN = 8;

const ease = Easing.out(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease } as const;

function styleFor(fx: Transition | null, p: number, dir: "in" | "out", frame: number): { wrap: CSSProperties; flash: number; leak: number; glitch: number } {
  // p goes 0 → 1 through the effect: for "in" it is the arrival, for "out" the departure.
  const k = dir === "in" ? 1 - p : p;
  const none = { wrap: {}, flash: 0, leak: 0, glitch: 0 };
  switch (fx) {
    case "zoom-punch":
      return { wrap: { transform: `scale(${dir === "in" ? 1 + k * 0.32 : 1 + k * 0.14})` }, flash: dir === "in" ? k * 0.7 : 0, leak: 0, glitch: 0 };
    case "whip-pan":
      return { wrap: { transform: `translateX(${(dir === "in" ? k : -k) * 100}%)`, filter: `blur(${k * 26}px)` }, flash: 0, leak: 0, glitch: 0 };
    case "glitch": {
      const jitter = k > 0.05 ? ((frame * 37) % 7) - 3 : 0;
      return { wrap: { transform: `translateX(${jitter * 14 * k}px)`, filter: `hue-rotate(${k * 120}deg) saturate(${1 + k * 2})` }, flash: 0, leak: 0, glitch: k };
    }
    case "light-leak":
      return { wrap: { filter: `brightness(${1 + k * 0.6})` }, flash: 0, leak: k, glitch: 0 };
    case "3d-flip":
      return { wrap: { transform: `perspective(1600px) rotateY(${(dir === "in" ? -k : k) * 80}deg)`, opacity: 1 - k * 0.6 }, flash: 0, leak: 0, glitch: 0 };
    case "blur-slide":
      return { wrap: { transform: `translateY(${(dir === "in" ? k : -k) * 16}%)`, filter: `blur(${k * 20}px)` }, flash: 0, leak: 0, glitch: 0 };
    default:
      return none;
  }
}

/**
 * One line's visual with its transitions: the previous line's transition plays as this one
 * arrives, this line's transition plays as it leaves. Cuts stay on the same frame, so the
 * voice and captions never shift.
 */
export function Shot({ inFx, outFx, frames, accent, children }: { inFx: Transition | null; outFx: Transition | null; frames: number; accent: string; children: ReactNode }) {
  const frame = useCurrentFrame();
  const pIn = interpolate(frame, [0, IN], [0, 1], clamp);
  const pOut = interpolate(frame, [frames - OUT, frames], [0, 1], clamp);
  const arriving = frame < IN && inFx && inFx !== "cut";
  const leaving = frame >= frames - OUT && outFx && outFx !== "cut";
  const fx = arriving ? styleFor(inFx, pIn, "in", frame) : leaving ? styleFor(outFx, pOut, "out", frame) : styleFor(null, 0, "in", frame);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={fx.wrap}>{children}</AbsoluteFill>
      {fx.flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: fx.flash }} />}
      {fx.leak > 0 && (
        <AbsoluteFill
          style={{ background: `radial-gradient(ellipse at 80% 20%, #ffb36b 0%, ${accent} 35%, transparent 70%)`, mixBlendMode: "screen", opacity: fx.leak * 0.9 }}
        />
      )}
      {fx.glitch > 0 && (
        <AbsoluteFill style={{ opacity: fx.glitch }}>
          {[0.18, 0.41, 0.63, 0.86].map((y, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${(y * 100 + ((frame * (i + 3)) % 9)) % 100}%`,
                height: 14 + i * 9,
                background: i % 2 ? accent : "#00e5ff",
                mixBlendMode: "screen",
                transform: `translateX(${(((frame * 53 + i * 17) % 60) - 30) * 3}px)`,
              }}
            />
          ))}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
