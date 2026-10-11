import { Composition, Still, type CalculateMetadataFunction } from "remotion";
import { Short } from "./Short";
import { Thumbnail, type ThumbnailProps } from "./Thumbnail";
import { FPS, HEIGHT, WIDTH, type ShortProps } from "./types";

// Length comes from the voiceover, plus a short tail so the last word isn't clipped.
const calculateMetadata: CalculateMetadataFunction<ShortProps> = ({ props }) => ({
  durationInFrames: Math.max(Math.ceil((props.duration + 0.4) * FPS), FPS),
});

// Empty default so Remotion Studio opens; real props come from PilotTube via --props.
const defaultProps: ShortProps = { duration: 3, voice: null, accent: "#7CFF6B", scenes: [], captions: [], cards: [] };

const thumbnailDefaults: ThumbnailProps = { background: "background.png", headline: "AI lied to police", kicker: "AI NEWS", accent: "#7CFF6B", format: "short" };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Short"
        component={Short}
        durationInFrames={FPS * 3}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultProps}
        calculateMetadata={calculateMetadata}
      />
      {/* Thumbnails: 9:16 for Shorts (cover / first frame), 16:9 at YouTube's 1280x720. */}
      <Still id="ThumbnailShort" component={Thumbnail} width={1080} height={1920} defaultProps={thumbnailDefaults} />
      <Still id="ThumbnailWide" component={Thumbnail} width={1280} height={720} defaultProps={{ ...thumbnailDefaults, format: "wide" }} />
    </>
  );
};
