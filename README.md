# PilotTube

Automated YouTube Shorts for daily AI news. Next.js + TypeScript, no Python.

**Dashboard:** `/` overview, `/shorts` all Shorts, `/shorts/:id` one Short with a live preview player (voice + clips + captions + cards), `/news` the story queue.

**Pipeline:** AI news → Agnes script → Deepgram voice + word timings → Agnes scene images → HyperFrames cards → Remotion render → YouTube upload

## Status

- [x] **Phase 1** — news fetcher + Agnes script writer
- [x] **Phase 2** — Deepgram voice (Aura-2) + word timings (Nova-3)
- [x] **Phase 3** — Agnes scene images (replaced Pexels stock clips)
- [x] **Phase 4** — HyperFrames cards (hook, stats, outro)
- [x] **Phase 5** — Remotion assembly (final MP4)
- [ ] Phase 6 — review dashboard
- [ ] Phase 7 — YouTube upload + daily schedule
- [ ] Phase 8 — deploy to a VPS

## Project structure

```
src/app/         pages (overview, shorts, news) + API routes
src/components/  dashboard UI
src/lib/         pipeline engine: news, script, voice, footage, cards, render
src/remotion/    the Remotion video (Short.tsx)
cards/           HyperFrames card designs (HTML, run with npx, no node_modules)
data/            database, per-Short media, final renders (not in git)
```

One `package.json`, one `node_modules`.

## Setup

```bash
cp .env.example .env.local   # fill in your keys
npm install
npm run dev                  # http://localhost:3000
```

Requires Node 24+ (uses the built-in `node:sqlite`). Data is stored in `data/app.db`.

## API

| Route | What it does |
|---|---|
| `GET /api/news` | Fetch the last 24h of AI news and return unused stories |
| `POST /api/script` | Pick the best unused story, read the article, write a Shorts script (10 scenes, 120-140 words, about 50-58s, never over 60s) |
| `GET /api/script` | List saved scripts |
| `POST /api/script/:id/voice` | Make the voiceover MP3 + word-timed captions + scene timings |
| `GET /api/script/:id/voice` | Get the saved voiceover data |
| `GET /api/script/:id/audio` | Play the voiceover MP3 |
| `POST /api/script/:id/images` | Draw an Agnes picture per scene (`?missing=1` fills only scenes without one) |
| `POST /api/script/:id/images/:scene` | Redraw one scene |
| `GET /api/script/:id/visual/:scene` | A scene's picture (or an older Short's stock clip); `/poster` for a small JPG |
| `POST /api/script/:id/cards` | Render hook / stat / outro overlays with HyperFrames |
| `GET /api/script/:id/card/:name` | Get one card (transparent WebM) |
| `POST /api/script/:id/render` | Render the final MP4 with Remotion (~1.5 to 2 min) |
| `GET /api/script/:id/video` | Stream the final MP4 (`?download=1` to download) |

## News sources

Hacker News (Algolia API), TechCrunch AI, The Verge AI, MIT Technology Review AI, OpenAI, Google AI, Hugging Face — see `src/lib/news/sources.ts`.

Stories whose article can't be read (paywall or bot block) are skipped, so scripts are only written from real article text.

## Files per Short

`data/videos/<scriptId>/` holds `voice.mp3`, `timings.json` (caption words + scene start/end times) and `images/` (one Agnes PNG per scene, ~1.5 MB each). Shorts made before Agnes images still have their old `clips/` and keep working. Change the voice with `DEEPGRAM_VOICE` in `.env.local`.

## HyperFrames cards

`cards/` is a HyperFrames project (created with `npx hyperframes init cards --resolution portrait`). Each card is a 3-second, 1080×1920 composition that takes the script's text through HyperFrames variables and renders to a **transparent WebM**, so Remotion can lay it over the footage:

| Card | File | Variables |
|---|---|---|
| Hook | `cards/compositions/hook.html` | `headline`, `kicker`, `accent` |
| Stat | `cards/compositions/stat.html` | `value` (counts up if numeric), `label`, `accent` |
| Outro | `cards/compositions/outro.html` | `text`, `handle`, `accent` |

Preview/edit them with `npm run cards`. Set `CHANNEL_HANDLE` and `CARD_ACCENT` in `.env.local`.

## Remotion render

Remotion lives inside the app in `src/remotion/` (the layout of Remotion's official Next.js template), sharing the one `package.json` and `node_modules`. The `Short` composition (`src/remotion/Short.tsx`) only draws; PilotTube builds its props in `src/lib/render/render.ts` with the same timing rules as the dashboard preview (`src/lib/timeline.ts`):

- one Agnes picture per scene with a camera move (zoom in, zoom out, pan right, pan left; `src/remotion/moves.ts`, shared with the preview)
- word-by-word captions (max 3 words, spoken word in the accent color), hidden during the outro
- HyperFrames cards laid over the footage as transparent video
- the Deepgram voiceover, then FFmpeg normalizes loudness to about -14 LUFS (Shorts level)

Output: `data/renders/<id>.mp4`, 1080x1920, H.264, 30 fps. Open the composition in Remotion Studio with `npm run remotion`.
# pilot_tube

## Scene images

Agnes writes a one-sentence picture idea per scene. When you press Make images, Agnes (text) turns them into image prompts with ONE shared style, and Agnes Image 2.5 Flash draws a 9:16 2K picture per scene, 3 at a time. Free Agnes keys are rate limited: a 429 is retried after 15s, 30s and 45s, and "Fill missing images" finishes a partial run.

## Motion graphics (script only)

Topic → script → motion graphics. On a Short's page, **Make motion graphics** turns the script into a 1080x1920 MP4 with HyperFrames, using nothing but the script:

1. Agnes (text) plans one animated screen per script line: `keyword`, `number` (counts up), `quote`, `vs`, `timeline`, `list`, `statement` (one word highlighted) or `question`, filled only with words from that line (`src/lib/motion/plan.ts`). A screen Agnes gets wrong falls back to a plain statement.
2. Timing comes from reading pace (~2.5 words/s, at least 2.4s per screen), plus a short outro; screens shrink evenly if the total would pass 60s.
3. `src/lib/motion/composition.ts` assembles one HyperFrames composition from `assets/motion.css` and `assets/motion-runtime.js` (aurora background, particles, perspective grid, news HUD with screen counter, camera push and shake, colored wipe transitions, per-type animations following HyperFrames animation rules: kinetic slams, motion blur, spring pops, count-up rings with particle bursts, RGB glitch, a subscribe-button press outro). It is written to `cards/compositions/generated/` (git-ignored) and rendered to `data/videos/<id>/motion/motion.mp4` in about 55s.

## Music

Background music comes from the **YouTube Audio Library** (copyright-safe on YouTube, no Content ID claims). It has no API, so you download tracks yourself and add them on the **Music** page (`/music`) with a mood (`tense`, `dramatic`, `upbeat`, `inspiring`, `techy`, `chill`) and license. Prefer "Attribution not required"; Creative Commons tracks need their credit text, which the Short page shows with a copy button for the description.

On a Short's page, **Pick by mood** has Agnes read the script's mood and picks the least-used matching track (any track if none match), or you choose a track or "No music" by hand. Files live in `data/music/`, tables `music_tracks` and `short_music` (`src/lib/music/`).

- Motion graphics: HyperFrames renders a silent `motion.silent.mp4`, and FFmpeg mixes the music under it into `motion.mp4` (looped to length, fade in/out). Changing the music only re-mixes, no re-render (a second or two).
- Final render: Remotion plays the music under the voice and ducks it while the voice talks.

## Publishing

`/publishing` has three tabs: **Ready** (rendered, not uploaded), **Scheduled** and **Published** (with views, likes and comments). **Publish now** or **Schedule** opens a panel with the title, description (hashtags, `#Shorts` and any Creative Commons music credit already added), visibility, go-live time and pre-upload checks (rendered, 60s or less, 9:16, title and description limits, music credit).

- Upload: the render is staged with `composio.files.upload`, then `YOUTUBE_UPLOAD_VIDEO` sends it (category 28, Science & Technology). Costs about 1,600 of YouTube's 10,000 daily API units.
- Scheduling: Composio's upload tool has no publish time, so PilotTube uploads as private and sets `status.publishAt` through `composio.tools.proxyExecute` (YouTube Data API `videos.update`). YouTube makes it public on time, even if PilotTube is off.
- Thumbnails are not uploaded: Composio's thumbnail tool needs a public image URL, and YouTube only shows custom Shorts thumbnails for Partner Program channels.
- Code: `src/lib/publish/youtube.ts`, `src/app/api/publish/[id]`, table `uploads`.
