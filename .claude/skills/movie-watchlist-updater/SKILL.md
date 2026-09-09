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

## Coordination across sessions (added 2026-08-28)

This skill runs from more than one place: a scheduled multi-agent pipeline
(PM/Coder/Reviewer/Tech Lead/Comms sessions, weekly) and interactive or
locally-run sessions. Neither needs to know the other by name -- the two
hard rules below are the actual coordination mechanism, and they apply
automatically to whoever runs this file next.

**Data-file re-sync (hard rule, generalized 2026-09-08).** Any session about
to write to a `data-*.js` file must (1) fetch `origin/master` fresh
immediately before computing what it's about to change -- never trust a
local checkout's age, no matter how recent the session start was, and (2)
fetch one more time immediately before the final commit/push, re-diff the
surviving change set against master's current tip, and drop anything that's
become a duplicate or been superseded in the interim. A `git push` rejection
here is this safeguard working as intended, not an error to route around --
re-fetch, re-diff, retry. Never force-push to resolve it.

This isn't a hypothetical risk -- it's a demonstrated recurring failure,
caught by luck three times running rather than by design: the 8/27-28
collision that prompted this section originally (two sessions independently
processed the same request-sheet rows; the one working from a stale local
snapshot wrote 14 titles a parallel session had already merged, at
colliding `num`s), plus a worktree collision and a duplicate-research pick
during the 2026-09-08 content-flag backfill, both caught only because
someone happened to re-diff before pushing rather than by any rule
requiring it. Step 1 and Step 6 below are where this rule plugs into this
skill's own pipeline; treat it as repo-wide, not scoped only to the
weekly-triage flow.

**Worktree/branch collisions (added 2026-09-08).** A different failure mode
from the rule above -- two sessions colliding on the *same working-directory
path*, not on data content. Derive worktree paths and branch names uniquely
per session (e.g. include a session id or timestamp) so two concurrent
automations can never collide on the same directory, even starting at the
exact same moment.

One asymmetry worth knowing: some sessions' network egress blocks
`commonsensemedia.org`/`wikipedia.org`/`upload.wikimedia.org` and ship
batches with posters omitted (Step 3's fallback). A session that *can* reach
those hosts should treat backfilling those gaps as a normal part of its own
run (see Step 3) -- not something that needs to be requested.

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

**Sync with `origin/master` first, before building the dedupe set** -- this is
the data-file re-sync hard rule from "Coordination across sessions" above,
part (1): fetch fresh, never trust a local checkout's age. Also run
`gh pr list` and skim any open PR that touches `data-extra.js` or the other
data files -- an in-flight PR covering an overlapping batch is a second
signal a local-only check won't see.

Extract `(title, year)` from every `data-*.js` file's `t`/`y` fields (reading
the synced `origin/master` versions of those files, not stale local copies)
and drop anything already present (case-insensitive title match). Same method
used all along: parse each file's array, build a set, filter.

Research (Step 2 below) can take several minutes per title. If a run is large
enough that meaningful time passes between this dedupe pass and Step 6's
commit, that gap is exactly what the hard rule's part (2) re-fetch-and-re-diff
right before commit/push is for.

## Step 2 — Research each title

For each surviving title, in parallel via the `Agent` tool if there are more than
~6 (4 concurrent agents per wave, same caution as always -- more than that has
tripped session limits before), or inline if it's a small batch:

1. `WebSearch "<title> commonsensemedia.org"`, then `WebFetch` the real CSM page.
   Pull: tagline, recommended age, concrete content concerns, positive
   messages/role models. Write `full` in your own words, don't fabricate, don't
   copy strings longer than ~5 words verbatim.

   **Prioritize surfacing sad/emotional content explicitly (added 2026-09-06).**
   The app's Family content settings don't score "sad moments" as its own
   category (CSM doesn't score it either -- it only ever showed up in prose),
   so `full` is the *only* place this information reaches a parent. When CSM's
   review calls out grief, loss, separation, death, or heavy emotional themes,
   make sure that's stated plainly in `full` rather than folded into a vaguer
   line about "content concerns" -- a parent screening for a sensitive kid
   needs to be able to find it by reading the description, not by guessing.
2. **Capture `srcUrl`: the actual CSM review page URL you just fetched.** This is
   new as of 2026-08-24 -- older entries don't have it, going forward every entry
   must. If CSM has no review, fall back to the Wikipedia parents-guide-equivalent
   or IMDb, set `ca` to `"Not on CSM; substitute source used"`, and set `srcUrl` to
   that fallback page instead. Never leave `srcUrl` empty if any source was used --
   if you truly can't find one, omit the field rather than guessing a URL.
3. Classify `genre` (1-3 tags from the fixed closed list below, always including
   `Animation` or `Live-Action`) and `studio`.

Closed genre vocabulary (case-sensitive, don't invent others): Animation,
Live-Action, Comedy, Adventure, Fantasy, Musical, Drama, Sci-Fi, Action, Horror,
Documentary, Sports, Holiday, Romance, Mystery, Superhero, Coming-of-Age, War,
Western, Biography.

**`studio` is user-facing now (added 2026-09-04)** -- it's what renders in the
movie-row badge (see "Displaying the studio + CSM age badge" below), not just
internal metadata, so consistency matters more than it used to. Use the real
studio that made the film, but fold pure naming/legal variants of the same
company into one canonical name -- check this list first (case-sensitive,
values other than these are fine for a studio not yet represented, but prefer
an existing canonical name over inventing a near-duplicate):

Disney, Warner Bros., Warner Bros. Animation (kept separate from Warner
Bros. -- own identity: Looney Tunes, Tom & Jerry, Scooby-Doo), DreamWorks,
20th Century Fox, Universal Pictures, Sony Pictures, Nickelodeon, Marvel
Studios (kept separate -- own brand value), Pixar (kept separate), Studio
Ghibli (kept separate), Paramount Pictures, Lucasfilm (kept separate), MGM,
Netflix, Sony Pictures Animation (kept separate -- Hotel Transylvania,
Spider-Verse), Illumination, Aardman (kept separate -- Wallace & Gromit),
Blue Sky Studios.

Fold into these rather than writing a variant: "Walt Disney Pictures",
"Walt Disney Productions", "Walt Disney Television", "Walt Disney Home
Video", "Buena Vista Pictures", "Touchstone Pictures" → `Disney`. "Warner
Bros. Pictures" → `Warner Bros.`. "DreamWorks Animation" → `DreamWorks`.
"20th Century Studios", "20th Century Animation" → `20th Century Fox`.
"Universal" → `Universal Pictures`. "Columbia Pictures", "TriStar Pictures"
/ "Tri-Star Pictures" → `Sony Pictures`. "Nickelodeon Movies" →
`Nickelodeon`. "Metro-Goldwyn-Mayer", "MGM/UA", "United Artists" → `MGM`.
"Netflix Animation" → `Netflix`. "Illumination Entertainment" →
`Illumination`.

For a studio genuinely outside this list (a real one-off distributor --
Laika, A24, GKIDS, Focus Features, New Line, Lionsgate, Miramax, Nelvana,
Hanna-Barbera, etc.), just use its real name; don't force it into the list
above and don't use `"Other"` -- `"Other"` is a placeholder for entries that
never got researched, not a valid classification, and every one of those is
a data gap to fix via individual research, not a shortcut to take on a new
one.

## Step 3 — Poster art

**First, check for backfill-eligible gaps left by a previous run.** Scan the
`data-*.js` files for entries with `addedAt` set (i.e. added recently) whose
`num` has no matching key in `data-posters.js`'s `MOVIE_POSTERS` -- these are
titles a prior run couldn't fetch a poster for, usually because its network
egress was blocked (see the coordination note above). If this session's
network *can* reach `upload.wikimedia.org` -- try one quick `curl -sI` against
it before deciding -- backfill those gaps first using the method below,
commit them (can be the same commit as this run's own new titles, or a small
standalone one if this run has no new titles to add), then continue. If this
session's network is also blocked, skip the backfill; it's not blocking, and
whichever run next has access will pick it up.

Same method the poster batch used (Wikipedia infobox thumbnails), for both the
backfill above and this run's own new titles:

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

**Also set going forward (added 2026-09-07, tracks content-model coverage for
the backfill job):** `csmRecheckedAt`, today's date as `"YYYY-MM-DD"`, and
`csmRecheckVersion`, the current value of `CONTENT_MODEL_VERSION` in
`index.html`. Since a freshly-added entry's `ca` rating is by definition
researched under the current content model, stamp both fields at creation
time for every new title, right after `addedAt`/`addedVia`. Both fields are
optional and only meaningful together -- never write one without the other,
and never stamp them until the researched content is actually confirmed
good (they assert "this entry's content rating reflects content-model
version N," not "this entry exists"). Older entries don't have these
fields — don't backfill them here; that backfill is its own job (see
"Re-researching an existing entry" below). `validate-data.mjs` checks both
are present-or-absent together, that `csmRecheckedAt` is a real date, and
that `csmRecheckVersion` is an integer.

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

**Before committing, apply the data-file re-sync hard rule's part (2)** from
"Coordination across sessions" above: re-fetch `origin/master`, confirm
nothing landed there since Step 1's dedupe pass, and if something did, diff
it against the titles this run is about to write and drop anything that's
now a duplicate before proceeding.

```bash
git add -A
git commit -m "..."
git push
```

If `git push` is rejected as non-fast-forward, that's the hard rule's
safeguard working as intended, not an error to force past -- something
landed on `origin/master` since the last sync. Re-fetch, re-run the dedupe
check from Step 1 against the new tip, drop anything that's now a duplicate,
and push again. Never `git push --force` here.

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

## Displaying the studio + CSM age badge

Added 2026-09-04, replacing an earlier two-badge layout that showed
`sourceLabels[m.source]` (which data-*.js file a movie was batch-added
from -- internal provenance, not a real user-facing category, and wrong as
often as not: a single curated batch like the old "Marvel/DC" file spans
several real studios) plus a redundant `m.la` age suffix next to the CSM
age badge (`m.la` and `m.ca` were never meaningfully distinct -- just two
independently-researched numbers that were almost always the same).

Each movie row now renders a single combined meta line: `"{studio} · CSM
{age}"`, using `m.studio` (see the canonical studio list in Step 2, not
`m.source`) and `m.ca`. `m.la` is not displayed anywhere; leave it in the
schema when writing new entries (Step 4 still requires it) since older code
or a future feature may still reference it, just don't add new display logic
for it.

This only changes the per-row badge. `m.source` and `sourceLabels` are
unrelated plumbing that still matters -- they drive `renderGroupedView()`'s
studio/franchise sections and the "curated lists" count, and Step 5's
instructions to wire a new `data-<source>.js` file into `sourceLabels` still
apply as written.

## Re-researching an existing entry (content-flag backfill mode, added 2026-09-07)

Everything above (Steps 1-6) describes *adding a new title*. This section is
a different mode: revisiting a title that's already in the catalog to
refresh its `ca`/content-flag data and `full` text under the current
5-category-turned-4-category CONTENT_FLAGS model (see "Displaying the studio
+ CSM age badge" above for the equivalent history on the badge; the content-
flag model itself lives in `index.html`'s `CONTENT_FLAGS` array). Triggered
by a systematic nightly backfill across the whole catalog, not by a request.

**What this mode does and doesn't touch:**
- Refresh: `ca`, `full` (specifically make sure any grief/loss/separation/
  sad content is called out in the prose per the note in Step 2 above), and
  `srcUrl` if this run finds a real CSM review for a title that previously
  had none (`ca: "Not on CSM; substitute source used"` is a real, fixable
  data gap when a review now exists -- upgrade it, don't leave it stale).
- Do NOT touch: `num`, `title`/`t`, `year`/`y`, `genre`, `studio` -- unless
  one of those is *clearly* wrong (a genuine data error you're confident
  about, not a judgment call about categorization). This mode is a refresh,
  not a re-classification; if something looks off but you're not sure,
  leave it and note it rather than changing it.
- Skip poster work entirely unless `data-posters.js` has no entry for this
  `num` at all -- then follow Step 3 as normal.
- No `num` assignment (the title already has one).

**Which titles a given run picks** is governed by whatever coverage-tracking
fields Tech Lead's schema work adds (a `csmRecheckedAt`/`csmRecheckVersion`
pair or equivalent -- check `index.html`'s schema validation and
`scripts/validate-data.mjs` for the actual current field names rather than
trusting this paragraph, since that field design may evolve after this was
written). Whatever the exact fields, the selection logic must follow the
same principle as Step 1's dedupe: check `origin/master`'s *current* state
before picking a batch, not a stale local snapshot -- two runs (or an
unattended run overlapping an interactive session) picking the same
not-yet-refreshed titles wastes real research work, not just a git conflict.

**This check happens once per PR within a night, not once at the top of the
night (explicit as of 2026-09-07, since a night now splits into ~4-5
sequential PRs -- see "PR structure" below).** If PR 2 of a night is being
assembled after PR 1 of that same night already merged, PR 2's candidate
list must re-fetch and re-check against `origin/master` *as it stands after
PR 1*, not against whatever snapshot was current when the night started --
otherwise a title PR 1 already covered can get redundantly re-researched in
PR 2, which is the same coordination failure Step 1 already guards against
for new titles, just recurring within one night instead of across nights.
A single check at the start of the night is not sufficient once a night is
multiple sequential PRs.

**Research depth must not vary with batch size.** Whether a night's batch is
25 titles or 200, each title gets the identical protocol: `WebSearch` to
find the real CSM review, `WebFetch` and actually read the full page,
extract the structured per-category subscores from that real content -- not
from a `WebSearch` results snippet as a shortcut. Do not let time pressure
from a larger nightly target change this. A run that finishes suspiciously
fast relative to (title count × realistic per-title research time) is a
signal something got shortcut, not a sign of efficiency -- worth flagging
in the PR description rather than treated as a win.

**Rate-limit coordination is mandatory, not a nice-to-have, for this mode.**
Run `node scripts/csm-rate-guard.mjs acquire` immediately before *every*
fetch against `commonsensemedia.org` (or a Wikipedia/IMDb fallback source)
in this mode, and only proceed with the fetch if it exits 0. If it exits 2,
**stop this run entirely -- do not retry, do not fall back to a different
source to route around it.** The coverage-tracking fields mean the next run
picks up exactly where this one stopped, which is the whole point: a
rate-limit hit costs some nights of pace, not a broken run. If any fetch in
this mode comes back looking like a block (429, CAPTCHA, anything that
isn't the normal review page), run
`node scripts/csm-rate-guard.mjs signal-block "<what you saw>"` immediately
-- this is a *shared* signal file, so every other concurrent subagent's next
`acquire` call aborts too, not just yours. See the comment header in
`scripts/csm-rate-guard.mjs` for the full mechanism (a lock-file-guarded
shared state file tracking a rolling per-minute window and a hard nightly
total, both configurable via `CSM_RATE_PER_MINUTE`/`CSM_RATE_NIGHTLY_CAP`
env vars) and `node scripts/csm-rate-guard.mjs status` to check current
counts without mutating anything.

**Also call `node scripts/csm-rate-guard.mjs checkpoint "title N/TOTAL:
<title>"` right before starting research on each title.** This is what
makes an unattended overnight run legible from outside: whoever checks in
on the run mid-flight (an external watcher, since a blocked or crashed
session can't reliably notice and report its own total failure) reads
`status`'s `checkpoint` field to tell "still working, last seen at title
47" apart from "silent because it never started" or "silent because it
died with no trace" -- three very different situations that all look like
identical silence without this. Cheap to call every title; do so every
time, not just when convenient.

**PR structure for a night's batch.** Split into multiple PRs rather than
one giant one (roughly 40-50 titles each), by data file where the night's
titles allow it -- naturally disjoint diffs (one PR touching
`data-disney.js`, another touching `data-extra.js`) don't conflict with
each other. Where a night's batch spans a file that more than one of that
night's PRs also touches, open and merge those PRs sequentially rather than
forking all of them from the same pre-batch commit: `git fetch origin
master` again after the previous PR in that night actually merges, same
coordination principle as Step 1/Step 6 above, just applied within one
night instead of across nights. Each PR's description should include the
elapsed time and title count for the slice it covers, so the "suspiciously
fast" quality check above is actually checkable by whoever reviews it.
Spot-check sample size should scale with the *night's total* batch (roughly
15%), not reset to a small fixed number per PR -- a night split into five
40-title PRs still needs the same total scrutiny as one 200-title PR would.
