import { Composition, Still } from "remotion";
// Relative imports: the Remotion bundler does not read the "@/" path alias.
import { FPS, HEIGHT, WIDTH, type ShortProps } from "../lib/studio/types";
import { Short } from "./Short";
import { Thumbnail, type ThumbnailProps } from "./Thumbnail";

const defaultProps: ShortProps = { duration: 5, accent: "#FF3B30", voice: "", words: [], lines: [], assets: "static", sfx: [] };
const thumbProps: ThumbnailProps = { image: "", headline: "AI NEWS", accent: "#FF3B30", shape: "9:16" };

export function RemotionRoot() {
  return (
    <>
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
      <Still id="ThumbTall" component={Thumbnail} width={1080} height={1920} defaultProps={thumbProps} />
      <Still id="ThumbWide" component={Thumbnail} width={1280} height={720} defaultProps={{ ...thumbProps, shape: "16:9" }} />
    </>
  );
}
