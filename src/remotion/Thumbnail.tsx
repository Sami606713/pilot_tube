import { AbsoluteFill, Img, staticFile } from "remotion";
import { display } from "./fonts";

export type ThumbnailProps = { image: string; headline: string; accent: string; shape: "9:16" | "16:9" };

/** A thumbnail picture with crisp headline text drawn by PilotTube (AI images misspell words). */
export function Thumbnail({ image, headline, accent, shape }: ThumbnailProps) {
  const tall = shape === "9:16";
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill
        style={{
          background: tall
            ? "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 38%)"
            : "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)",
        }}
      />
      <AbsoluteFill style={{ padding: tall ? "150px 70px" : "60px 70px", justifyContent: tall ? "flex-start" : "center", alignItems: tall ? "center" : "flex-start" }}>
        <div
          style={{
            fontFamily: display,
            fontSize: tall ? 150 : 128,
            lineHeight: 0.95,
            textTransform: "uppercase",
            color: "#fff",
            textAlign: tall ? "center" : "left",
            maxWidth: tall ? 940 : 640,
            WebkitTextStroke: "4px #000",
            paintOrder: "stroke fill",
            textShadow: `0 10px 40px rgba(0,0,0,0.8), 0 0 60px ${accent}66`,
          }}
        >
          {headline.split(" ").map((w, i) => (
            <span key={i} style={{ color: i % 2 ? accent : "#fff" }}>
              {w}{" "}
            </span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
