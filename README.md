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
- `data-extra.js` — 30 movies requested directly (e.g. via "Request a movie") rather than pulled from a curated external list: the Free Willy and Air Bud franchises, the Sony Spider-Man live-action run plus Across the Spider-Verse, and a batch of best-of-90s live-action kids films
- `data-csm.js` — 73 movies for ages 5-9, sourced from Common Sense Media's own curated age-based lists ("50 Movies All Kids Should Watch Before They're 12," "Best Kids and Family Movies," and similar) and deduped against everything already in the app
- `data-mcudc.js` — 140 movies: the Marvel Cinematic Universe, legacy Marvel (Fox's X-Men series, Sony's Venom/Morbius/Madame Web, Fantastic Four, Ghost Rider, Elektra), and DC films across every era including the full DC Universe Animated Original Movies line, with R-rated titles (Deadpool & Wolverine, Logan, Zack Snyder's Justice League, and similar) left out by request
- `data-ghibli.js` — 18 movies: the rest of the Studio Ghibli theatrical catalog not already covered elsewhere in the app, added unfiltered by content/rating per request (including Grave of the Fireflies)
- `data-posters.js` — poster artwork for 818 of 837 movies, sourced from Wikipedia poster thumbnails, keyed by each movie's `num`

**837 movies total.**

## Adding more movies

Use the `movie-watchlist-updater` Claude skill
(`.claude/skills/movie-watchlist-updater/`) for the full research → write-up →
deploy pipeline, including poster art and a `srcUrl` link back to whatever page
the content came from. In short: each new curated source list gets its own
`data-<source>.js` file (never edit the existing ones), referenced with an
additional `<script>` tag in `index.html`, and merged client-side into the single
`MOVIES` array. One-off single-title requests (as opposed to a whole new curated
list) go in `data-extra.js` instead of spawning a new file each time. Requested
titles waiting to be added live in `PENDING_REQUESTS.md`.

## Deploying

The Vercel project ("family-movie-watchlist") is connected to this repo via
Vercel's Git integration (as of 2026-08-24) — **a plain `git push` to `master`
(or a merged PR) redeploys the whole site automatically**, every file in the repo
including all `data-*.js` files. There is no manual deploy step anymore. The
project used to route data files through jsDelivr's CDN with manual
cache-busting to work around Vercel not being Git-connected; that workaround is
gone and any reference to `cdn.jsdelivr.net` left in `index.html` is a bug, not
the current design.
