import { Composition } from "remotion";
// Relative imports: the Remotion bundler does not read the "@/" path alias.
import { FPS, HEIGHT, WIDTH, type ShortProps } from "../lib/studio/types";
import { Short } from "./Short";

const defaultProps: ShortProps = { duration: 5, accent: "#FF3B30", voice: "", words: [], lines: [], assets: "static", music: null, sfx: [] };

export function RemotionRoot() {
  return (
    <Composition
      id="Short"
      component={Short}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={FPS * 5}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.ceil(props.duration * FPS)) })}
    />
  );
}
