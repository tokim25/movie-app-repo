# Movie Night — Family Watchlist

A static web app pairing a family movie list with Common Sense Media's
"what parents need to know" content, built as a personal checklist with
per-device persistence (localStorage) and no backend.

**Live app:** https://family-movie-watchlist-kim-family-projects.vercel.app
**Also linked (unlisted) from:** https://tonykim.io/movies

Progress lives in localStorage per device/browser, same as always. To carry
progress to another device, use "Sync across devices" in the app: it shows a
code (copy it) and a box to paste a code from elsewhere (load it) — a manual,
no-account, no-backend way to move your watched list and ordering between
devices.

Every movie also carries `genre` (1-3 tags from a fixed list) and `studio`
(the real production studio, not just which curated list it came from), on
top of the existing `y` (year) and `ca` (Common Sense Media recommended age).
The app filters on all four: decade, max recommended age, genre, and studio,
combinable and cleared with one button.

Each row also has a star toggle, independent of the watched checkbox, for
flagging movies you want to prioritize — a "Want to watch" filter button and
header count go with it. Priority marks travel through "Sync across devices"
alongside watched status and custom order.

A "Request a movie" link at the bottom opens a pre-filled email to the
maintainer — no backend, no accounts, just `mailto:`.

## Files

- `index.html` — the entire UI (HTML/CSS/JS in one file, Apple-inspired design system)
- `data.js` — the original 100 movies (Big Life Journal's "100 Best Family Movies")
- `data-rt.js` — 36 additional movies from Rotten Tomatoes' "50 Essential Movies For Kids"
- `data-dcom.js` — 116 movies: all 115 official Disney Channel Original Movies (1997-2022) plus The Magic Faraway Tree (2026)
- `data-disney.js` — 231 movies: the Walt Disney Animation Studios canon, Disneytoon direct-to-video sequels, Disneynature documentaries, and Disney live-action family films spanning 1937-2025
- `data-pixar.js` — 15 additional Pixar features not already covered elsewhere
- `data-dreamworks.js` — 44 DreamWorks Animation theatrical films (1998-2024)
- `data-nickelodeon.js` — 34 Nickelodeon Movies theatrical and streaming films (1996-2023)
- `data-extra.js` — one-off additions requested directly (e.g. via "Request a movie"), not tied to any curated list; currently just Free Willy 2: The Adventure Home

**577 movies total.**

## Adding more movies

See the `movie-watchlist-updater` Claude skill for the full research → write-up →
deploy pipeline. In short: each new source list gets its own `data-<source>.js`
file (never edit the existing ones), referenced with an additional `<script>` tag
in `index.html`, and merged client-side into the single `MOVIES` array. One-off
single-title requests (as opposed to a whole new curated list) go in
`data-extra.js` instead of spawning a new file each time.

## Deploying

The Vercel project ("family-movie-watchlist") is not connected to this repo's
git history via Vercel's Git integration, so pushing here does not by itself
redeploy the live app. Two ways to update the live site:

- `vercel --prod` from this directory, if the CLI is linked to an account with
  access to the project.
- Redeploy `index.html` directly (e.g. via the Vercel MCP tools), since it's the
  only file actually hosted on Vercel: the seven `data-*.js` files are loaded
  at runtime from jsDelivr's GitHub mirror
  (`https://cdn.jsdelivr.net/gh/tokim25/movie-app-repo@master/<file>?v=2`), so a
  plain `git push` here updates the data files on the live site on its own
  (once jsDelivr's cache for `@master` refreshes) — only changes to
  `index.html` itself need a fresh Vercel deploy.

To make `git push` alone update everything, connect the repo to the Vercel
project's Git integration in the dashboard (Project Settings → Git) and this
whole workaround goes away.

**Updating a data file's content?** jsDelivr caches each file for 7 days in
visitors' own browsers, keyed by the full URL including the `?v=` query string
in `index.html`. Bump that number (`?v=2` → `?v=3`, etc.) for every file whose
content actually changed, or returning visitors won't see the update for up to
a week. jsDelivr's edge cache can also lag a few minutes behind a fresh push —
purging (`https://purge.jsdelivr.net/gh/tokim25/movie-app-repo@master/<file>`)
reporting `"status":"finished"` doesn't guarantee the content is live yet;
confirm with a byte-size check against the local file before trusting it.
