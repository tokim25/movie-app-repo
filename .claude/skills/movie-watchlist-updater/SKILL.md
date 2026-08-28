---
name: movie-watchlist-updater
description: Research and add new movies to the Movie Night watchlist app -- real CSM content, genre/studio, poster art, and a source link -- then commit so Vercel auto-deploys. Use for one-off "add movie X" requests, to clear out the movie-request Google Sheet, or to scan CSM/Rotten Tomatoes for that week's new family-friendly releases.
---

# Movie Night — movie-watchlist-updater

Adds new titles to family-movie-watchlist (github.com/tokim25/movie-app-repo). Read
this whole file before starting; it's the whole pipeline in one place so a future
session doesn't have to reconstruct it from scratch.

## Deploy architecture (read this first, it changed 2026-08-24)

Vercel's Git integration is connected to this repo now. **A push to `master` (or a
merged PR) deploys the whole site automatically** -- every file in the repo,
including all `data-*.js` files, is served directly by Vercel. The old jsDelivr-CDN
workaround (cache-busting `?v=N` query strings, `deploy_to_vercel` MCP calls,
purge-and-poll) is dead. Do not use it. If `index.html` still references
`cdn.jsdelivr.net` anywhere, that's stale -- fix it to a plain relative path instead.

**Deploy is just: commit, push, verify live.** No manual deploy step exists anymore.

## Input: what to add

Titles come from up to three places:

1. **Direct request** -- the user names titles in the conversation.
2. **The request form** -- check the movie request Google Sheet (fileId
   `1zRCemYIpnMSoQer2vhi7nPQbQlY9bg2pRl0h983Gd_Q`, title "Movie Night Requests
   (Responses)"). The in-app "Request a movie" form posts straight to a Google
   Form, which drops each submission into that sheet as a Timestamp + Movie
   title row (title only, no year/notes -- kept deliberately frictionless).
   Read it with the Drive connector's read-file tool. There's no reliable
   "mark as processed" mechanism against the sheet itself, so cross-check
   timestamps against the running log kept in `PENDING_REQUESTS.md`
   (repurposed as a processed-log, not a queue -- see that file) before
   treating a row as new.
3. **Weekly new-release discovery** (scheduled-task runs only -- see the
   section below) -- proactively found titles, not requested by anyone.

If run on a schedule with no explicit titles given, combine sources 2 and 3,
dedupe the combined list once (so a proactively discovered title that also
happens to be a pending request isn't processed twice), and stop cleanly if
neither source has anything new -- don't invent titles to add.

(Older versions of this file described a `mailto:` link and `PENDING_REQUESTS.md`
as the request queue itself -- that flow was retired 2026-08-24 in favor of the
in-app form above, specifically to remove the friction of leaving the app to
compose an email.)

## Weekly new-release discovery (scheduled-task runs only, added 2026-08-24)

On top of checking the request sheet, each scheduled run should also
proactively look for new family-friendly movies from roughly the past 7-10
days, rather than only reacting to requests:

1. **Common Sense Media**: search or browse for newly published reviews from
   the past week -- e.g. `site:commonsensemedia.org movie review` narrowed to
   the current date range, or CSM's own movie-reviews listing sorted by
   newest. Note any titles that weren't already reviewed as of last week's
   run.
2. **Rotten Tomatoes**: check RT's new-releases / now-playing listing for the
   same window.
3. **Filter to family-friendly before adding anything to the pipeline**: MPAA
   rating G, PG, or PG-13 (skip R-rated and unrated adult titles), or clearly
   family/kids-oriented content (an animated feature, a studio already
   represented in this catalog, a streaming original clearly aimed at kids)
   even when an MPAA rating isn't easy to find. When genuinely unsure whether
   a title fits, skip it rather than guess -- missing a good title one week
   is cheap to fix the next week; adding something a parent didn't want
   recommended is not.
4. Dedupe discovered titles the same way as any other title (Step 1 below),
   and against whatever's being pulled from the request sheet in the same
   run, so nothing gets processed twice.
5. Don't force a quota. Most weeks only turn up a handful of qualifying new
   releases, some weeks none -- report what was found (or that nothing
   qualified) rather than padding the batch to have something to show.

This discovery step only applies to the weekly scheduled run. A one-off
"add movie X" request in an interactive session should never trigger it.

## Step 1 — Dedupe

**Sync with `origin/master` first, before building the dedupe set.** Run
`git fetch origin` and diff against `origin/master` (not just whatever the
local checkout happens to have) -- another session can merge a batch between
when this run started and when it gets to writing files, and a stale local
`master` will miss it. This isn't hypothetical: on 2026-08-27/28 two sessions
independently processed the same request-sheet rows, and the one that deduped
against a local snapshot ended up researching and writing 14 titles that a
parallel session had already merged, at colliding `num`s -- caught only by
manually diffing against `origin/master` right before pushing. Also run
`gh pr list` and skim any open PR that touches `data-extra.js` or the other
data files -- an in-flight PR covering an overlapping batch is a second
signal a local-only check won't see.

Extract `(title, year)` from every `data-*.js` file's `t`/`y` fields (reading
the synced `origin/master` versions of those files, not stale local copies)
and drop anything already present (case-insensitive title match). Same method
used all along: parse each file's array, build a set, filter.

Research (Step 2 below) can take several minutes per title. If a run is large
enough that meaningful time passes between this dedupe pass and Step 6's
commit, re-fetch `origin/master` right before writing/committing and re-check
the surviving title list against it -- cheap insurance against exactly the
race above.

## Step 2 — Research each title

For each surviving title, in parallel via the `Agent` tool if there are more than
~6 (4 concurrent agents per wave, same caution as always -- more than that has
tripped session limits before), or inline if it's a small batch:

1. `WebSearch "<title> commonsensemedia.org"`, then `WebFetch` the real CSM page.
   Pull: tagline, recommended age, concrete content concerns, positive
   messages/role models. Write `full` in your own words, don't fabricate, don't
   copy strings longer than ~5 words verbatim.
2. **Capture `srcUrl`: the actual CSM review page URL you just fetched.** This is
   new as of 2026-08-24 -- older entries don't have it, going forward every entry
   must. If CSM has no review, fall back to the Wikipedia parents-guide-equivalent
   or IMDb, set `ca` to `"Not on CSM; substitute source used"`, and set `srcUrl` to
   that fallback page instead. Never leave `srcUrl` empty if any source was used --
   if you truly can't find one, omit the field rather than guessing a URL.
3. Classify `genre` (1-3 tags from the fixed closed list below, always including
   `Animation` or `Live-Action`) and `studio` (the real studio, prefer names already
   in use across the catalog for consistency, new values are fine).

Closed genre vocabulary (case-sensitive, don't invent others): Animation,
Live-Action, Comedy, Adventure, Fantasy, Musical, Drama, Sci-Fi, Action, Horror,
Documentary, Sports, Holiday, Romance, Mystery, Superhero, Coming-of-Age, War,
Western, Biography.

## Step 3 — Poster art

Same method the poster batch used (Wikipedia infobox thumbnails):

1. `WebSearch "<title> <year> film wikipedia"`, `WebFetch` the Wikipedia article.
2. Extract the infobox poster image URL (hosted at `upload.wikimedia.org`), plus
   its width and height if shown.
3. Verify the URL actually resolves before including it -- `curl -sI <url>` and
   check for a 200 and an `image/*` content-type. A dead link here just means the
   poster silently won't render (the app's `createPoster()` has an `onerror` that
   removes the slot), but don't ship a URL you haven't checked.
4. If no usable poster image exists, skip it -- the app already handles missing
   posters gracefully, don't block the movie entry on it.

## Step 4 — Validate the schema

Every entry needs: `num`, `t`, `y` (4-digit string), `la`, `ca`, `full`, `genre`
(non-empty array, valid tags only, includes Animation or Live-Action), `studio`,
`source`. `srcUrl` should be present for anything added from this point forward.
Check for accidental duplicate `num` values and duplicate titles within the new
batch itself, not just against the existing catalog.

**Also set going forward (added 2026-08-24, powers the "New this week" section
in the app):** `addedAt`, today's date as `"YYYY-MM-DD"`, and `addedVia`, either
`"request"` (came from the movie-request Google Sheet) or `"discovery"` (came
from the weekly new-release scan). Field order convention: place both right
after `srcUrl` and before `source`. Older entries don't have these fields —
don't backfill them; a missing `addedAt` just means the movie never shows in
the "New this week" section, which is the correct behavior for anything not
actually added recently. Run `node scripts/validate-data.mjs` after writing —
it checks `addedAt` is a real date and `addedVia` is one of the two allowed
values, among everything else it already checks.

## Step 5 — Assign nums and write the files

Continue the `num` sequence from the current max across all data files (check all
of them, the max isn't always in the most recently added file). Small batches
(under ~15 titles, including one-off "Request a movie" adds) go into
`data-extra.js`, appended to the existing array. Larger curated batches (a whole
franchise, a whole studio, a themed list) get their own new `data-<source>.js`
file, matching the existing convention -- if you add a new file, wire it into
`index.html`: a new `<script src="data-<source>.js"></script>` tag (plain relative
path, not jsDelivr), a new `.concat(...)` in the `MOVIES` array, and a new entry in
the `sourceLabels` object used by `render()`/`renderGroupedView()`.

Poster entries go into `data-posters.js`'s `MOVIE_POSTERS` object, keyed by the
same `num`, in the `{u, w, h, p}` shape already established (url, width, height,
Wikipedia page title).

Update the header subtitle and the `statLeft` initial value in `index.html` to the
new total movie count, and the "curated lists" count if a new file was added.

## Step 6 — Commit, push, verify

**Before committing, re-fetch `origin/master` and confirm nothing landed there
since Step 1's dedupe pass** (see the note there) -- if something did, diff it
against the titles this run is about to write and drop anything that's now a
duplicate before proceeding.

```bash
git add -A
git commit -m "..."
git push
```

That's the whole deploy. Then verify on the live production URL
(https://family-movie-watchlist-kim-family-projects.vercel.app/) -- open it, check
`MOVIES.length` matches the new total, spot-check that a couple of the new titles
are findable by search, confirm no console errors, confirm posters render for the
titles that have them. Vercel deploys are fast (typically under a minute) but poll
`get_deployment` if unsure rather than guessing it's live.

**For anything larger than a small weekly batch, or anything run unattended on a
schedule with nobody watching**, push to a feature branch and open a PR instead of
pushing straight to `master`, so a human reviews before it goes live -- same
pattern the poster-thumbnails addition used. For a small human-supervised batch in
an interactive session, direct-to-`master` is fine, same as every batch before this
one.

## Displaying the source link to users

`index.html`'s row-detail rendering (`render()` and `renderGroupedView()`) should
show a "See the source →" link pointing at `m.srcUrl` when it's present, right
after the CSM age badge, alongside the existing "Details" toggle. Older entries
without `srcUrl` simply don't show the link -- don't fabricate URLs to backfill
them.
