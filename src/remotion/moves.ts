/**
 * Four camera moves for scene pictures, cycled per scene so a Short never feels like a slideshow.
 * Shared by the Remotion render and the dashboard preview. Scale stays >= 1.12 while panning so edges never show.
 */
export const MOVES = [
  { from: { scale: 1.0, x: 0 }, to: { scale: 1.14, x: 0 } }, // zoom in
  { from: { scale: 1.16, x: 0 }, to: { scale: 1.02, x: 0 } }, // zoom out
  { from: { scale: 1.14, x: -3 }, to: { scale: 1.14, x: 3 } }, // pan right
  { from: { scale: 1.14, x: 3 }, to: { scale: 1.14, x: -3 } }, // pan left
] as const;
