# PilotTube

Automated YouTube Shorts for daily AI news. Next.js + TypeScript, no Python.

**Dashboard:** `/` overview, `/shorts` all Shorts, `/shorts/:id` one Short with a live preview player (voice + clips + captions + cards), `/news` the story queue.

**Pipeline:** AI news → Agnes script → Deepgram voice + word timings → Pexels clips → HyperFrames cards → Remotion render → YouTube upload

## Status

- [x] **Phase 1** — news fetcher + Agnes script writer
- [x] **Phase 2** — Deepgram voice (Aura-2) + word timings (Nova-3)
- [x] **Phase 3** — Pexels clip search
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
| `POST /api/script` | Pick the best unused story, read the article, write a Shorts script |
| `GET /api/script` | List saved scripts |
| `POST /api/script/:id/voice` | Make the voiceover MP3 + word-timed captions + scene timings |
| `GET /api/script/:id/voice` | Get the saved voiceover data |
| `GET /api/script/:id/audio` | Play the voiceover MP3 |
| `POST /api/script/:id/footage` | Find + download one vertical Pexels clip per scene |
| `GET /api/script/:id/footage` | List the chosen clips (with Pexels author credits) |
| `GET /api/script/:id/clip/:scene` | Stream a scene clip |
| `POST /api/script/:id/cards` | Render hook / stat / outro overlays with HyperFrames |
| `GET /api/script/:id/card/:name` | Get one card (transparent WebM) |
| `POST /api/script/:id/render` | Render the final MP4 with Remotion (~1.5 to 2 min) |
| `GET /api/script/:id/video` | Stream the final MP4 (`?download=1` to download) |

## News sources

Hacker News (Algolia API), TechCrunch AI, The Verge AI, MIT Technology Review AI, OpenAI, Google AI, Hugging Face — see `src/lib/news/sources.ts`.

Stories whose article can't be read (paywall or bot block) are skipped, so scripts are only written from real article text.

## Files per Short

`data/videos/<scriptId>/` holds `voice.mp3`, `timings.json` (caption words + scene start/end times) and `clips/` (one Pexels MP4 per scene, ~50 MB per Short). A Pexels clip is not reused in another Short for 30 days. Change the voice with `DEEPGRAM_VOICE` in `.env.local`.

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

- one Pexels clip per scene with a slow push-in (slowed down if a clip is shorter than its scene)
- word-by-word captions (max 3 words, spoken word in the accent color), hidden during the outro
- HyperFrames cards laid over the footage as transparent video
- the Deepgram voiceover, then FFmpeg normalizes loudness to about -14 LUFS (Shorts level)

Output: `data/renders/<id>.mp4`, 1080x1920, H.264, 30 fps. Open the composition in Remotion Studio with `npm run remotion`.
# pilot_tube
