import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { TimedBeat } from "./plan";

// Styles and animation code live as plain files next to this one (easier to read and edit than inline strings).
const ASSETS = path.resolve(/*turbopackIgnore: true*/ "src/lib/motion/assets");

/**
 * Build one HyperFrames composition (1080x1920) that plays the whole script as motion graphics.
 * Timed elements are static HTML (HyperFrames reads data-start / data-duration). The runtime fills them
 * with textContent, so nothing from the script is ever parsed as HTML.
 */
export function buildMotionHtml(beats: TimedBeat[], duration: number, accent: string, handle: string): string {
  const css = readFileSync(path.join(ASSETS, "motion.css"), "utf8");
  const runtime = readFileSync(path.join(ASSETS, "motion-runtime.js"), "utf8");
  // JSON inside <script>: escape "<" so a line like "</script>" can't end the tag.
  const data = JSON.stringify({ beats, total: duration, handle }).replace(/</g, "\\u003c");
  const sections = beats
    .map((b, i) => `        <section id="b${i}" class="clip beat beat-${b.type}" data-start="${b.start}" data-duration="${b.duration}" data-track-index="3"></section>`)
    .join("\n");

  return `<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@500;600;700;800;900&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      :root { --accent: ${accent}; }
${css}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="motion" data-start="0" data-duration="${duration}" data-width="1080" data-height="1920">
      <div id="bg" class="clip" data-start="0" data-duration="${duration}" data-track-index="0">
        <div id="aur-a" class="aurora"></div>
        <div id="aur-b" class="aurora"></div>
        <div id="aur-c" class="aurora"></div>
        <div id="floor"><div id="floor-grid"></div></div>
        <div id="particles"></div>
        <svg id="grain" width="1080" height="1920" aria-hidden="true">
          <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
        <div id="vignette"></div>
      </div>
      <div id="cam" class="clip" data-start="0" data-duration="${duration}" data-track-index="2">
        <div id="shake">
${sections}
        </div>
      </div>
      <div id="hud" class="clip" data-start="0" data-duration="${duration}" data-track-index="4">
        <div id="kicker"><span id="live"></span>AI NEWS</div>
        <div id="progress"><div id="progress-fill"></div></div>
        <div id="br-tl" class="bracket"></div>
        <div id="br-tr" class="bracket"></div>
        <div id="br-bl" class="bracket"></div>
        <div id="br-br" class="bracket"></div>
      </div>
      <div id="fx" class="clip" data-start="0" data-duration="${duration}" data-track-index="5">
        <div id="wipe-a"></div>
        <div id="wipe-b"></div>
        <div id="flash"></div>
      </div>
    </div>
    <script>window.MOTION = ${data};</script>
    <script>
${runtime}
    </script>
  </body>
</html>
`;
}
