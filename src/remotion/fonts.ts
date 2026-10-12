import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

export const display = loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const body = loadMontserrat("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily;
