import { loadFont } from "@remotion/google-fonts/Inter";
import { AbsoluteFill, Img, staticFile } from "remotion";

const { fontFamily } = loadFont("normal", { weights: ["800", "900"], subsets: ["latin"] });

export type ThumbnailProps = {
  /** Background picture (from Agnes), relative to --public-dir. */
  background: string;
  headline: string;
  kicker: string;
  accent: string;
  format: "short" | "wide";
};

/** The longest word gets the accent color, the same rule as the HyperFrames hook card. */
function hotIndex(words: string[]): number {
  return words.reduce((best, w, i) => (w.replace(/\W/g, "").length > words[best].replace(/\W/g, "").length ? i : best), 0);
}

/**
 * A still thumbnail: AI-generated picture underneath, crisp real text on top
 * (image models misspell words, so text is never part of the generated image).
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({ background, headline, kicker, accent, format }) => {
  const words = headline.trim().split(/\s+/);
  const hot = hotIndex(words);
  const wide = format === "wide";
  // Fewer words fit per line on the narrow Short, so its type is a touch smaller per character count.
  const fontSize = wide ? (words.length > 6 ? 92 : 112) : words.length > 6 ? 118 : 140;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d", fontFamily }}>
      <Img src={staticFile(background)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {/* Darken where the text sits so it reads on any picture. */}
      <AbsoluteFill
        style={{
          background: wide
            ? "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 75%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0) 62%)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "flex-start",
          padding: wide ? "64px 72px" : "190px 80px 0 80px",
          width: wide ? "62%" : "100%",
          gap: wide ? 28 : 40,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: wide ? "10px 22px" : "14px 30px",
            borderRadius: 999,
            background: accent,
            color: "#0a0a0a",
            fontSize: wide ? 30 : 40,
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          <span style={{ width: wide ? 14 : 18, height: wide ? 14 : 18, borderRadius: "50%", background: "#0a0a0a" }} />
          {kicker}
        </div>
        <div
          style={{
            color: "#ffffff",
            fontWeight: 900,
            fontSize,
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
            textTransform: "uppercase",
            textShadow: "0 8px 30px rgba(0,0,0,0.6), 0 3px 8px rgba(0,0,0,0.8)",
          }}
        >
          {words.map((w, i) => (
            <span key={i} style={{ color: i === hot ? accent : undefined }}>
              {w}{" "}
            </span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
