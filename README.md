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
