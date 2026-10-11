import { Composition, type CalculateMetadataFunction } from "remotion";
import { Short } from "./Short";
import { FPS, HEIGHT, WIDTH, type ShortProps } from "./types";

// Length comes from the voiceover, plus a short tail so the last word isn't clipped.
const calculateMetadata: CalculateMetadataFunction<ShortProps> = ({ props }) => ({
  durationInFrames: Math.max(Math.ceil((props.duration + 0.4) * FPS), FPS),
});

// Empty default so Remotion Studio opens; real props come from PilotTube via --props.
const defaultProps: ShortProps = { duration: 3, voice: null, accent: "#7CFF6B", scenes: [], captions: [], cards: [] };

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
