import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Chart, LogoAsset } from "../../lib/studio/types";
import { body, display } from "../fonts";

/** Dark stage with an accent glow and a slowly drifting grid. */
export function Backdrop({ accent }: { accent: string }) {
  const frame = useCurrentFrame();
  const shift = (frame * 1.2) % 80;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${accent}40 0%, #08090d 52%, #020203 100%)` }}>
      <AbsoluteFill
        style={{
          opacity: 0.22,
          backgroundImage: `linear-gradient(${accent}55 1px, transparent 1px), linear-gradient(90deg, ${accent}55 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: `0 ${shift}px`,
          maskImage: "radial-gradient(ellipse at 50% 45%, black 20%, transparent 70%)",
        }}
      />
    </AbsoluteFill>
  );
}

/** Company logo: tilts in from 3D, glows in its brand color, a light sweep crosses it, then the name rises. */
export function LogoReveal({ logo, src, accent }: { logo: LogoAsset; src: string; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 120, mass: 0.8 } });
  const sweep = interpolate(frame, [10, 34], [-120, 220], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const name = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  const color = logo.color || accent;
  return (
    <AbsoluteFill>
      <Backdrop accent={color} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1400, paddingBottom: 200 }}>
        <div
          style={{
            position: "relative",
            width: 520,
            height: 520,
            transform: `rotateY(${interpolate(pop, [0, 1], [40, 0])}deg) scale(${interpolate(pop, [0, 1], [0.6, 1])})`,
            opacity: pop,
            filter: `drop-shadow(0 0 60px ${color}aa)`,
            overflow: "hidden",
            borderRadius: 40,
          }}
        >
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)",
              transform: `translateX(${sweep}%)`,
              mixBlendMode: "overlay",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 60,
            fontFamily: display,
            fontSize: 110,
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: 2,
            opacity: name,
            transform: `translateY(${interpolate(name, [0, 1], [40, 0])}px)`,
          }}
        >
          {logo.name}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const fmt = (v: number, decimals: number) => v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** A number that counts up, or bars that grow; every value comes from the line itself. */
export function ChartScene({ chart, accent }: { chart: Chart; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = interpolate(frame, [4, fps * 1.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const label = spring({ frame: frame - 10, fps, config: { damping: 16 } });

  if (chart.kind === "counter") {
    return (
      <AbsoluteFill>
        <Backdrop accent={accent} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 220 }}>
          <div style={{ fontFamily: display, fontSize: 330, lineHeight: 0.9, color: accent, textShadow: `0 0 80px ${accent}88` }}>
            {chart.prefix}
            {fmt(chart.value * grow, chart.decimals)}
            {chart.suffix}
          </div>
          <div style={{ marginTop: 34, height: 14, width: 700, background: "#ffffff22", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${grow * 100}%`, background: accent, borderRadius: 8 }} />
          </div>
          <div
            style={{
              marginTop: 40,
              maxWidth: 860,
              textAlign: "center",
              fontFamily: body,
              fontWeight: 900,
              fontSize: 58,
              textTransform: "uppercase",
              color: "#fff",
              opacity: label,
              transform: `translateY(${interpolate(label, [0, 1], [30, 0])}px)`,
            }}
          >
            {chart.label}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const max = Math.max(...chart.items.map((i) => i.value), 1);
  return (
    <AbsoluteFill>
      <Backdrop accent={accent} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 90px 260px", gap: 44 }}>
        {chart.label && <div style={{ fontFamily: body, fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", opacity: label }}>{chart.label}</div>}
        {chart.items.map((item, i) => {
          const g = interpolate(frame, [6 + i * 6, fps * 1.2 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
          const top = item.value === max;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: body, fontWeight: 800, fontSize: 44, color: "#fff", textTransform: "uppercase" }}>
                <span>{item.label}</span>
                <span style={{ fontFamily: display, color: top ? accent : "#fff", fontSize: 60 }}>
                  {fmt(item.value * g, item.value % 1 ? 1 : 0)}
                  {chart.suffix}
                </span>
              </div>
              <div style={{ height: 56, background: "#ffffff14", borderRadius: 12 }}>
                <div style={{ height: "100%", width: `${(item.value / max) * g * 100}%`, background: top ? accent : "#ffffffcc", borderRadius: 12, boxShadow: top ? `0 0 40px ${accent}99` : "none" }} />
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Kinetic typography: the line's key phrases slam in one after another. */
export function Kinetic({ phrases, accent }: { phrases: string[]; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop accent={accent} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 240 }}>
        {phrases.map((p, i) => {
          const s = spring({ frame: frame - i * Math.round(fps * 0.35), fps, config: { damping: 11, stiffness: 170, mass: 0.6 } });
          return (
            <div
              key={i}
              style={{
                fontFamily: display,
                fontSize: p.length > 12 ? 120 : 160,
                lineHeight: 1,
                color: i % 2 ? accent : "#fff",
                textTransform: "uppercase",
                textAlign: "center",
                maxWidth: 960,
                opacity: s,
                filter: `blur(${interpolate(s, [0, 1], [14, 0])}px)`,
                transform: `scale(${interpolate(s, [0, 1], [1.7, 1])}) rotate(${i % 2 ? 2 : -2}deg)`,
                textShadow: i % 2 ? `0 0 50px ${accent}88` : "0 8px 30px rgba(0,0,0,0.6)",
              }}
            >
              {p}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
