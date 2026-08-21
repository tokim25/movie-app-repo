# Movie Night — Family Watchlist

A static web app pairing a family movie list with Common Sense Media's
"what parents need to know" content, built as a personal checklist with
per-device persistence (localStorage) and no backend.

**Live app:** https://family-movie-watchlist-kim-family-projects.vercel.app

## Files

- `index.html` — the entire UI (HTML/CSS/JS in one file, Apple-inspired design system)
- `data.js` — the original 100 movies (Big Life Journal's "100 Best Family Movies")
- `data-rt.js` — 36 additional movies from Rotten Tomatoes' "50 Essential Movies For Kids"
- `data-dcom.js` — 116 movies: all 115 official Disney Channel Original Movies (1997-2022) plus The Magic Faraway Tree (2026)

**252 movies total.**

## Adding more movies

See the `movie-watchlist-updater` Claude skill for the full research → write-up →
deploy pipeline. In short: each new source list gets its own `data-<source>.js`
file (never edit the existing ones), referenced with an additional `<script>` tag
in `index.html`, and merged client-side into the single `MOVIES` array.

## Deploying

Deployed via Vercel (`vercel --prod` if the CLI is linked, or push to the
connected git branch if this repo is connected to the Vercel project in the
dashboard under Project Settings → Git).
