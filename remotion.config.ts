/**
 * Config for the Remotion CLI (`remotion render` / `remotion studio`).
 * All options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Three.js needs a GPU-style renderer in headless Chrome (Remotion docs: use "angle").
Config.setChromiumOpenGlRenderer("angle");
