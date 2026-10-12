# PilotTube

PilotTube is being rebuilt from a clean base. Right now it has two pages, both showing your real YouTube channel data through [Composio](https://composio.dev):

- **Overview** (`/`): subscribers, 28-day views, watch time, videos, views per day, traffic sources and top videos.
- **Analytics** (`/analytics`): 7, 28 or 90-day range, charts and a sortable videos table.

The earlier pipeline (research, scripts, voice, images, motion graphics, music, render, thumbnails, publishing) was removed on 2026-10-12 so it can be rebuilt with a proper plan. It is still in git history: commit `fccf7c5` (merged to `main` in PR #1).

## Stack

Next.js 16 (App Router, `cacheComponents`), Tailwind v4, shadcn/ui (radix, Phosphor icons), Recharts, `@composio/core`.

## Setup

```bash
npm install
cp .env.example .env.local   # add COMPOSIO_API_KEY
npm run dev
```

YouTube must be connected in your Composio account (toolkit `youtube`). Optional: `COMPOSIO_USER_ID` (default `default`) and `COMPOSIO_YOUTUBE_ACCOUNT_ID` to pin one connected account.

## Code

- `src/lib/composio.ts`: Composio client, YouTube tool runner and raw API proxy, friendly quota errors.
- `src/lib/youtube/analytics.ts`: channel overview and video stats (15-minute cache).
- `src/app/api/youtube/refresh`: clears the cache and reloads.

## Research (`/research`)

Standalone, fact-checked research on any topic or article link (not connected to other pages yet). Uses **Agnes** (`AGNES_API_KEY`, model `AGNES_MODEL`, default `agnes-3.0-flash`) and **Tavily through Composio** (connect a Tavily key in your Composio account).

1. Agnes breaks the topic into viewer questions and writes searches (including ones aimed at the official source).
2. Tavily searches; results are ranked (official > trusted news > other, max 1-2 per site, official capped at a third) and the best pages are read in full.
3. Agnes extracts facts with the exact sentence from the page; code checks each quote really appears on the page and drops the rest.
4. Facts are cross-checked: confirmed (official source or 2+ sites), single source, or conflict.
5. Deep mode runs a second round of searches for unanswered questions.
6. Agnes writes a report only from those facts, with [n] citations (invalid citations are removed), and the evidence score is computed in code.

Quick ≈ 8-10 Tavily credits, Deep ≈ 25-45. Runs in the background (`after()`), progress is polled; results are saved in `data/app.db` (table `research`). Free Agnes keys are rate limited, so calls wait and retry on 429 (runs take 2-6 minutes).

## Scripts (`/shorts`)

Dramatic, storytelling Shorts scripts of 50-58 seconds (125-138 words at ~2.4 words/s, never over ~58.5s), written by Agnes only from research facts.

- **New script**: from a finished research, or a custom topic (Quick/Deep research runs first, then the script).
- **Steps**: 3 hooks (number, claim, question) scored, best used as line 1 → story script (hook, setup, tension, reveal, why it matters, loop ending that flows back into the hook) → length check with per-line word counts → fact check of every line against the research, unsupported lines (hook included) rewritten up to 2 rounds → scores (hook, story, accuracy, pacing, loop; hook and accuracy count double).
- **Facts rule**: confirmed facts stated plainly, single-source facts attributed ("according to…"), conflicts left out.
- **Every line** has: narration, visual (3D motion graphic, B-roll, logo, chart, kinetic text, screenshot, photo) with a cinematic description, on-screen text, transition into the next line, sound effect, and the research fact ids it relies on (click to see them).
- **Editing**: edit any field by hand, or "Rewrite" one line with an optional instruction. Changed lines are marked "not re-checked".
- **Export**: copy the voice-over, download CSV (for an editor) or .txt; YouTube title, description with source links, hashtags.
- Code: `src/lib/scripts/` (engine, store, types), `src/app/api/scripts`, table `scripts`.

## Video studio (`/studio`), part 1 of 3

Pick a finished script → **Make video**: Deepgram Aura-2 "Hermes" voice (expressive male) + Nova-3 word timings aligned to the script → Agnes writes Pexels search words per line → 3 portrait clip options per line (no clip reused across Shorts or lines), first one downloaded → live preview with `@remotion/player` → **Render**: Remotion CLI renders `src/remotion/Short.tsx` (1080×1920, 30 fps) then FFmpeg two-pass loudnorm to -14 LUFS.

Video: footage with slow push-in, the script's on-screen text slamming in, big word-by-word captions (spoken word in the accent color), progress bar. Per line you can pick another of the 3 clips or search new ones. Files in `data/videos/<scriptId>/`, table `videos`.

**Part 2 (done):** every line has a mode: stock footage, Agnes AI clip, 3D graphic, logo, chart or kinetic text, starting from what the script asked for.
- Agnes plans the designs per line: 3D scene (glowing chip, server corridor, neural network, data globe, data stream, AI core), chart (counter or bars, only numbers the line itself says, checked in code), kinetic-text phrases, and the company the line is about.
- Brandfetch Brand API (`BRANDFETCH_API_KEY`): real logos + brand colors, cached per domain in table `brands` and `data/brands/` (the free key has 100 lookups in total). The main company's color becomes the video's accent.
- 3D with `@remotion/three` + React Three Fiber, animated from the frame number; rendered with the ANGLE OpenGL renderer (`remotion.config.ts`).
- Transitions from the script (zoom punch, whip pan, glitch, light leak, 3D flip, blur slide) play across each cut without shifting the voice.
- Agnes Video 2.5 Flash clips are tried for up to 2 B-roll lines (falls back to Pexels when its free queue is full), or per line with "Try AI clip".

**Part 3 (done):** sound effects. 8 sounds (impact, whoosh, riser, glitch, click, chime, rumble, shimmer) synthesized with FFmpeg once into `data/sfx/` and normalized to the same peak, so there is no library or license to track. Each cut gets the script's SFX cue, or the sound that fits its transition; risers and whooshes start early so they land on the cut. Can be switched off per video.

Background music and the music library were removed on 2026-10-13 (user's choice); videos have voice + sound effects only.

## Publishing (`/publishing`)

Tabs Ready / Scheduled / Published. Ready = videos rendered in the Video studio and not uploaded. "Publish now" or "Schedule" opens a panel with the title, description (story + source links) and hashtags from the script, visibility, time, and checks (rendered, 60s or less, 9:16, title, description). Upload: `composio.files.upload` + `YOUTUBE_UPLOAD_VIDEO` (category 28); schedule: upload private, then `videos.update status.publishAt` through `composio.tools.proxyExecute`. Code: `src/lib/publish/youtube.ts`, table `uploads`.

## Thumbnails (`/thumbnails`)

Two tabs: **For a video** (Agnes reads the script and writes 3 different ideas for a clear picture of what the video is about) and **Custom** (your own description, 3 variations). Shape 9:16 (1080×1920) or 16:9 (1280×720). Pictures by Agnes Image 2.5 Flash (no text in the image); optional text is drawn by Remotion (`src/remotion/Thumbnail.tsx`, stills ThumbTall/ThumbWide) so it is never misspelled; without text FFmpeg crops to the exact size. Choose / download / delete per thumbnail. Code: `src/lib/thumbnails/thumbnails.ts`, table `thumbnails`, files in `data/thumbnails/`.

## Planner (`/planner`)

One Short a day, Monday-Sunday weeks with previous/next. Each day's stage is read from the real data: topic planned → writing script → script ready → video ready (rendered in the studio) → scheduled → published (uploads made from Publishing also show on their day). Plan a day from a typed topic, a finished research or a finished script; move or remove plans. Buttons per day: Write script (Quick research first for a typed topic), Make video (opens the studio), Schedule (uploads as private, public at the day's post time). Daily post time in table `settings` (default 18:00); plans in `plan_slots`. Days under 24h away without a ready video are outlined red; videos over 60s can't be scheduled.
