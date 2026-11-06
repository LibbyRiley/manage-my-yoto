# podcast-to-yoto

A Next.js 14 app that lets you search for podcasts, select episodes, pick pixel-art icons, and upload them to a Yoto MYO (Make Your Own) card as a playlist.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Zustand** — global wizard state (`src/lib/store.ts`)
- **@yotoplay/yoto-sdk** — Yoto API
- **OpenAI** (DALL-E 3) — AI-generated icons (requires `OPENAI_API_KEY`)
- **rss-parser** — RSS feed parsing
- **sharp** — image processing for icon downscaling

## Architecture

### Wizard flow (4 steps)

```
search → episodes → icons → upload
```

Step is driven by `useAppStore().step`. Each step is a separate component rendered in `src/app/page.tsx`.

### State (`src/lib/store.ts`)

| Field | Type | Purpose |
|---|---|---|
| `step` | `WizardStep` | Current wizard step |
| `podcast` | `Podcast \| null` | Selected podcast |
| `episodes` | `Episode[]` | RSS episodes with `selected` flag |
| `iconSelections` | `IconSelection[]` | Per-episode icon candidates + `selectedIconId` |
| `selectedCard` | `YotoCard \| null` | Target Yoto MYO card |
| `uploadProgress` | `UploadProgress[]` | Per-episode upload state |
| `yotoLoggedIn` | `boolean` | Yoto auth state (in-memory only) |

`reset()` clears all state and returns to `search`.

### API routes (`src/app/api/`)

| Route | Method | Purpose |
|---|---|---|
| `/api/podcasts/search` | POST | Search PodcastIndex API |
| `/api/podcasts/episodes` | POST | Fetch + parse RSS feed |
| `/api/icons/search` | POST | Find icons for an episode |
| `/api/icons/convert` | POST | Convert image URL → Yoto icon |
| `/api/download` | POST | Download audio file to `downloads/` dir |
| `/api/yoto/auth` | POST | Yoto login (stores token in-memory on server) |
| `/api/yoto/cards` | GET | List user's MYO cards |
| `/api/yoto/upload` | POST | Upload downloaded audio to Yoto + poll transcoding |

### Icon system (`src/lib/icons.ts`)

Three icon sources, fetched in parallel via `findIconsForEpisode()`:
1. **Yoto library** — keyword-matched from public Yoto icon set (cached in-memory)
2. **AI-generated** — DALL-E 3, pixel art style, skipped if no `OPENAI_API_KEY`
3. **Artwork downscale** — episode/podcast artwork scaled to 16×16 via sharp

Keyword extraction for matching lives in `src/lib/keywords.ts`.
Image conversion to Yoto's format (16×16 PNG) lives in `src/lib/image-processing.ts`.

### Yoto auth

Token is stored in a module-level variable in `src/app/api/yoto/auth/route.ts` via `getYotoToken()`. It persists for the server process lifetime only — not across restarts, not in the browser.

## Dev

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Optional | AI icon generation via DALL-E 3 |
| `PODCASTINDEX_API_KEY` | Required | PodcastIndex podcast search |
| `PODCASTINDEX_API_SECRET` | Required | PodcastIndex auth |

## Key types (`src/types/index.ts`)

- `Podcast` — search result with `feedUrl`
- `Episode` — RSS item with `guid`, `audioUrl`, `selected`
- `YotoIcon` — icon candidate with `source` (`yoto-library` | `ai-generated` | `artwork-downscale` | `custom`)
- `IconSelection` — per-episode `{ candidates, selectedIconId }`
- `UploadProgress` — `{ stage: downloading | uploading | transcoding | done | error, progress: 0–100 }`
- `WizardStep` — `"search" | "episodes" | "icons" | "upload"`
