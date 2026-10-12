import "server-only";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db";

/**
 * Company logos and colors from the Brandfetch Brand API, saved once per domain:
 * the free key allows only 100 lookups in total.
 */
type BrandRow = { name: string; colors: { hex: string; type: string }[]; logo: string | null; fetchedAt: string };

const BRAND_DIR = () => path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data", "brands");

export const cleanDomain = (d: string) =>
  d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

type ApiBrand = {
  name?: string;
  colors?: { hex: string; type: string }[];
  logos?: { type: string; theme: string | null; formats: { src: string; format: string; width?: number }[] }[];
};

/** Logo preference on a dark video: a symbol/icon reads best large; dark-theme (light-colored) variants first. */
function pickLogo(b: ApiBrand): string | null {
  const order = ["symbol", "logo", "icon"];
  const logos = [...(b.logos ?? [])].sort((x, y) => {
    const t = order.indexOf(x.type) - order.indexOf(y.type);
    return t !== 0 ? t : (x.theme === "dark" ? -1 : 0) - (y.theme === "dark" ? -1 : 0);
  });
  for (const l of logos) {
    if (!order.includes(l.type)) continue;
    const png = l.formats.find((f) => f.format === "png") ?? l.formats.find((f) => f.format === "jpeg");
    if (png) return png.src;
  }
  return null;
}

export async function getBrand(domainIn: string): Promise<BrandRow | null> {
  const domain = cleanDomain(domainIn);
  if (!domain.includes(".")) return null;
  const cached = getDb().prepare(`SELECT data FROM brands WHERE domain = ?`).get(domain) as { data: string } | undefined;
  if (cached) return JSON.parse(cached.data) as BrandRow;

  const key = process.env.BRANDFETCH_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(30_000),
  });
  // Remember misses too, so a wrong domain doesn't burn lookups again.
  let row: BrandRow = { name: domain, colors: [], logo: null, fetchedAt: new Date().toISOString() };
  if (res.ok) {
    const b = (await res.json()) as ApiBrand;
    row = { ...row, name: b.name ?? domain, colors: b.colors ?? [] };
    const src = pickLogo(b);
    if (src) {
      const img = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(30_000) });
      if (img.ok && /^image\//.test(img.headers.get("content-type") ?? "")) {
        await mkdir(BRAND_DIR(), { recursive: true });
        const file = `${domain}.png`;
        await writeFile(path.join(BRAND_DIR(), file), Buffer.from(await img.arrayBuffer()));
        row.logo = file;
      }
    }
  } else {
    console.warn(`[brandfetch] ${domain}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  getDb().prepare(`INSERT OR REPLACE INTO brands (domain, data) VALUES (?, ?)`).run(domain, JSON.stringify(row));
  return row;
}

/** Copy a brand's logo into a video's folder (the renderer only sees that folder). */
export async function copyLogo(domain: string, videoFolder: string): Promise<string | null> {
  const brand = await getBrand(domain);
  if (!brand?.logo) return null;
  const name = `logo-${cleanDomain(domain)}.png`;
  await copyFile(path.join(BRAND_DIR(), brand.logo), path.join(videoFolder, name));
  return name;
}

// ---------- Accent color ----------

function hexToHsl(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** HSL → #rrggbb (hex works everywhere: CSS alpha suffixes and Three.js). */
function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * A vivid brand color that reads on a dark video: accent first, then brand colors.
 * Greys, black and white are skipped; dark colors are lifted.
 */
export function accentFrom(colors: { hex: string; type: string }[]): string | null {
  const ranked = [...colors].sort((a, b) => (a.type === "accent" ? -1 : 0) - (b.type === "accent" ? -1 : 0));
  for (const c of ranked) {
    const v = hexToHsl(c.hex);
    if (!v || v[1] < 0.35) continue;
    const [h, s, l] = v;
    return hslToHex(h, Math.max(s, 0.65), Math.min(Math.max(l, 0.5), 0.62));
  }
  return null;
}
