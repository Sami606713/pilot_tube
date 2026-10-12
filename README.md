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
