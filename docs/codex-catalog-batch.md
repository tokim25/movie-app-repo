# Catalog batch instructions for Codex

This file tells an outside coding agent (ChatGPT Codex) how to add family films to the Movie Night catalog so they show up correctly in the app and in its curated lists. Each run adds up to 15 films, opens two pull requests (titles, then content flags), and stops. tokim25 reviews and merges. Never merge a pull request yourself.

The repo is a single-page web app on Vercel. Merging to `master` deploys it. A new title only "uploads seamlessly" when every file below is updated together and every check passes, so treat the checklist as the job, not as advice.

## Read these first

1. `.claude/skills/movie-watchlist-updater/SKILL.md` is the long-standing rulebook for adding a title. Follow it, except where this file says otherwise. The parts that matter most: Step 2 (research), Step 4 (schema), "Content flags from CSM scores", the canonical studio names and the closed genre list.
2. `PENDING_REQUESTS.md`, the last few entries. It is the running log of what earlier runs added, skipped and held.
3. `tools/csm-sweep-queue.json`, the backlog of candidate titles (described below).

Where this file and SKILL.md differ, this file wins. The differences:

- You open pull requests for everything. SKILL.md lets some title entries go straight to `master`; you never push to `master`.
- You do not use a Vercel Sandbox or any Claude-only tool or skill. Fetch pages from your own environment.
- Ignore SKILL.md's notes about Claude sessions, scheduled tasks and the Certification Desk.

## One-time setup

The Codex environment needs internet access for these hosts, and nothing else is required:

- `www.commonsensemedia.org` (reviews and ages)
- `en.wikipedia.org` (year, runtime, studio, poster page)
- `upload.wikimedia.org` (primary poster images)
- `www.themoviedb.org` and `image.tmdb.org` (optional TMDB poster verification)
- the npm registry (for `npm ci` and Playwright's browser download)

Install with `npm ci` and `npx playwright install chromium`. Check the setup by running `node scripts/validate-data.mjs`, `node --test tests-unit/*.test.mjs` and `npx playwright test` on a clean checkout of `master` before your first batch, and note which tests fail before you change anything.

## What qualifies

Add a title only when all of these hold:

- It has a real Common Sense Media (CSM) review page with an age. A "not yet rated" page, a preview or a search snippet does not count.
- CSM's age is 12 or under, and the film is not rated R or NC-17.
- It is a film, TV movie or special, not a series episode or season.
- It has been released (in theaters or on streaming).
- It is not already in the catalog (see "Dedupe" below).

Hold a borderline title for tokim25 instead of adding it: list it in the log and the PR body with the reason. Examples are a CSM 12+ title with heavy content, or a film whose audience is unclear.

## Order of work in each run

1. **Sync.** `git fetch origin` and branch from the current `origin/master`. Check the open pull requests that touch any `data-*.js` file. If one adds titles, wait or build on top of it, and never reuse its `num` values.
2. **New releases first.** Look for family films, TV movies and specials released in the last 14 days, or opening this week. Start with CSM's list at `https://www.commonsensemedia.org/lists/new-kids-movies`. Read each candidate's CSM page and add the ones that qualify with `addedVia: "discovery"`. Spend at most about 15 CSM requests on this step.
3. **Then the backlog.** Fill the rest of the 15 from `tools/csm-sweep-queue.json` (below) with `addedVia: "discovery"`.
4. **Write every file** for each title (the checklist below), then build and validate.
5. **Open the titles PR**, then the **flags PR**.
6. **Log the run** in `PENDING_REQUESTS.md` and update the queue (both go in the titles PR).

A Claude weekly run also adds new releases on Thursdays. That is why step 1 matters: re-fetch `origin/master` right before you push, and if a title or `num` you used has landed there in the meantime, drop the duplicate or renumber yours.

## The backlog queue

`tools/csm-sweep-queue.json` was built by crawling CSM's curated lists. Do not recrawl. Its keys:

- `candidates`: `{slug, title, score}` sorted by score. `slug` is the CSM review URL slug (`https://www.commonsensemedia.org/movie-reviews/<slug>`). Titles here were never checked carefully against the catalog.
- `read`: `{slug, csmAge}` for 7 pages already read but never researched. Do these first.
- `done`: slugs already added. Append each slug you add.
- `skipped`: `{slug, reason}`. Append anything you check and reject (already in the catalog, no runtime source, too old an age, not a film), so nobody rechecks it.
- `built`, `lists_done`, `notes`: leave as they are.

Do not trust a high score alone. Check every candidate against the catalog before you spend a request on its CSM page.

## Dedupe

Before reading a title's CSM page, search every `data-*.js` file (not `data-bundle.js`) for it by key words, not only the exact title. "Dr. Seuss' How the Grinch Stole Christmas" and "How the Grinch Stole Christmas" are the same film, and so are "Kicking & Screaming" and "Kicking and Screaming". Also search the `srcUrl` values for the CSM slug. Re-run this check against fresh `origin/master` before you push.

## Rate limits (hard rules)

- Before every request to CSM or Wikipedia, run `node scripts/csm-rate-guard.mjs acquire` and only fetch if it exits 0. If it exits 2, stop the run.
- At most 10 CSM requests a minute (one every 7 seconds or more) and 220 a day. List pages and review pages both count. Fetch one page at a time.
- Wikipedia: wait at least 1.5 seconds between requests, and 5 to 8 seconds after any 429.
- If any response is not a normal page (429, 403, a CAPTCHA, an error page), stop the run, run `node scripts/csm-rate-guard.mjs signal-block "<what you saw>"`, and say so in the log. Do not switch to another source to get around it.
- Send a generic User-Agent such as `movie-catalog-research/1.0`. Never put anyone's name, email or other personal detail in a request.

## Per-title checklist

Every new title touches these files. Missing any one of them is a failed run.

### 1. The entry, in `data-extra.js`

`data-extra.js` is one line: `const MOVIES_EXTRA = [...];` holding a JSON array. Append new entries to the end of the array, keep it valid JSON on that one line, and keep this field order:

```json
{"num":1184,"t":"Steps","y":"2026","la":"8+","ca":"8+","full":"…","srcUrl":"https://www.commonsensemedia.org/movie-reviews/steps","addedAt":"2026-11-23","addedVia":"discovery","source":"EXTRA","genre":["Animation","Fantasy","Comedy"],"studio":"Netflix","runtimeMinutes":94,"runtimeSourceId":"commonsensemedia:steps","runtimeVerifiedAt":"2026-11-23"}
```

- `num`: the next number after the highest `num` across every `data-*.js` file. Number your batch in order.
- `y` is a string. `la` and `ca` are both the CSM age, such as `"8+"`.
- `addedAt` is today's date. It is what puts the title on the What's new tab.
- `runtimeMinutes` comes from Wikipedia's infobox (`runtimeSourceId: "wikipedia:<Page title>"`) or, if Wikipedia has none, from the CSM page (`"commonsensemedia:<slug>"`). If neither has a runtime, skip the title and record why in `skipped`.
- `genre` uses only the closed list in SKILL.md and always includes `Animation` or `Live-Action`. `studio` uses SKILL.md's canonical names (for example `Disney`, not `Walt Disney Pictures`). For a franchise already in the catalog, match the studio its existing entries use (the Peanuts TV specials all use `CBS`), so the badge stays consistent.
- Do not add `flags`, `csmRecheckedAt` or `csmRecheckVersion` here. The flags PR adds them.

**Writing `full`.** This is the description parents read, and it is the only place sad content reaches them. Write it in your own words: no copied run of more than about five words. Cover what the film is about, then the specific scary, violent and sad moments, then language, romance and drinking where CSM mentions them, then the positive themes, and end with "Common Sense Media recommends it for ages N and up." State grief, death, a lost parent or a hurt animal plainly. Invent nothing the review does not say. Use plain sentences and no em dashes. Match the tone of the recent entries at the end of `data-extra.js`.

### 2. The guidance card, in `data-guidance.js`

Add an entry keyed by the `num` as a string, before the closing `};`. Copy the shape of a recent entry:

```js
  "1184": {"concerns":{"parentInDanger":{"level":"no","quote":""},"scaryVillain":{"level":"yes","quote":"a jealous villain who wants her enemies dead"},"sadOrLoss":{"level":"yes","quote":"Children lose parents"},"rudeHumor":{"level":"no","quote":""},"animalPeril":{"level":"no","quote":""}},"preShow":"root = Card([hdr, watch, after])\nhdr = CardHeader(\"Steps · 2026\", \"Netflix · 94 min · CSM 8+\")\nwatch = Callout(\"warning\", \"Peril and lost parents\", \"Lots of chases, explosions and near drownings, people turned into creepy porcelain dolls, and children who lose parents.\")\nafter = TextContent(\"Ask after: Why did Lilith and Cinderella finally decide to help each other?\", \"small\")"}
```

- Each of the five concerns is `yes`, `mild` or `no`. Any `quote` that is not empty must be an exact substring of that title's `full`, character for character. The validator checks this.
- Include `watch = Callout("warning", …)` only when the notes describe a real moment to prepare for. A gentle film gets `root = Card([note])\nnote = TextContent("Gentle. Nothing to prep for.", "small")`.
- The "Ask after" question comes from the film's positive themes.

### 3. The poster, in `data-posters.js`

Take the poster from the film's Wikipedia infobox, check that the image URL returns HTTP 200 with an `image/*` type, then add a line keyed by `num`:

```js
  1184: {"u":"https://upload.wikimedia.org/…","w":220,"h":326,"p":"Steps (film)"},
```

`w` and `h` are the image size and `p` is the Wikipedia page title.

After completing the Wikipedia evidence pass, you may add a TMDB poster for the same film. Check the title and release year on the TMDB movie page, then confirm that the exact `https://image.tmdb.org/t/p/w500/…` image returns HTTP 200 and an `image/*` content type. Check the displayed image and record its actual dimensions. Keep the normal stop rule if any guarded request is blocked.

For the editorial decision or reviewed manifest, put the TMDB image in `tmdbPoster: { u, w, h, id }`, where `id` is the TMDB movie ID. Save an exact URL and header receipt as `tmdbPosterHeaders` (use an absolute file path in an editorial decision):

```sh
curl -qfsSI --max-time 20 "$tmdb_image_url" --write-out '\n%{url_effective}\n' > "$tmdb_poster_headers"
```

The builder stores this as a `tmdb` member on the poster entry. The app tries Wikimedia first when mapped, then TMDB when Wikimedia is missing or fails. If neither provider has a verified poster, omit the entry and say so in the log.

### 4. Sequels, in `data-series.js`

If the title is a direct sequel and its immediate predecessor is already in the catalog, add `<sequel num>: <predecessor num>, // Title (year) <- Title (year)` to `MOVIE_PREREQUISITES`. Leave out remakes, reboots, prequels and anything in the Star Wars series.

### 5. Curated lists, in `data-lists.js`

This is how new titles reach the app's Lists tab, its themed shelves and the in-season cards on Tonight. When a title clearly belongs on a list, append its `num` to that list's `pins` array. A list describes what is in the film, never which families it suits. Add only clear fits; when unsure, leave it off and name the possible list in the PR body for tokim25 to decide.

Current lists (`id`: what fits):

- Holidays and seasons: `hanukkah`, `ramadan-eid`, `passover`, `easter`, `thanksgiving`, `christmas`, `snow-day` (snow, ice, sled dogs), `spooky-not-too-scary` (friendly Halloween), `dia-de-los-muertos`, `summer-break`, `back-to-school`, `baseball`.
- Sports: `nothing-but-net` (basketball), `the-beautiful-game` (soccer), `friday-night-football` (American football), `ice-snow-and-underdogs` (hockey, skating, skiing), `wheels-and-waves` (racing, surfing, skating), `girls-in-the-game` (girls in sports).
- Families and neighbors: `black-joy-family-big-dreams`, `latino-families-many-stories`, `asian-families-many-stories`, `more-than-one-culture-at-home`, `families-with-pride` (LGBTQ+ families), `muslim-kids-at-the-center`, `sibling-teams`, `food-family-and-the-table`, `around-the-world`.
- Brave and curious: `girls-lead-the-way`, `inventors-and-problem-solvers`.
- Cheer them on: `good-teammates`, `underdogs`, `dogs`, `real-life-adventures` (true stories and nature documentaries).
- Story time: `read-the-book-first` (based on a book), `studio-ghibli`, `made-by-hand` (stop-motion and hand-made animation), `sing-along-musicals`.
- From the grown-ups: `eighties` (released 1980 to 1989), `nineties` (1990 to 1999), `funny-for-grown-ups-too`, `award-winners` (Oscar for Best Animated Feature only).

Rules:

- Use only real catalog `num` values, never a `num` twice in one list, and add new titles at the end of `pins` (earlier pins are hand-ordered).
- Do not create, rename, reorder or delete lists, and do not edit `MOVIE_LIST_SHELVES`, `LIST_ICONS`, `season`, `dates` or `minFit`. Those are tokim25's design decisions. If you think a new list is needed, propose it in the PR body.

### 6. The queue and the log

- In `tools/csm-sweep-queue.json`, add each added slug to `done` and each rejected one to `skipped` with a reason.
- Append a dated entry to the end of `PENDING_REQUESTS.md`. Cover the titles added with their `num`, CSM age, runtime and studio; anything skipped or held and why; CSM requests used; whether posters were found; the queue size left; and links to both PRs. Match the style of the recent entries and end it with "Co-authored with ChatGPT."

## Build and validate

Run these after editing any data file, in this order, and commit what they change:

```sh
node scripts/bundle-data.mjs      # regenerates data-bundle.js (never hand-edit it)
node scripts/data-version.mjs     # re-stamps DATA_VERSION in sw.js so browsers pick up the new catalog
node scripts/validate-data.mjs
node scripts/validate-guidance.mjs
node --test tests-unit/*.test.mjs
npx playwright test
```

`data-bundle.js` and the one-line `DATA_VERSION` change in `sw.js` are how the app sees new titles. A PR that changes a `data-*.js` file without them fails `validate-data.mjs`.

Every check must pass. If a Playwright test fails, compare it with the same test on a clean `master` checkout. A failure that also happens on `master` in your environment (for example, tests that need poster images when your network blocks them) can be reported as pre-existing. Anything that only fails on your branch must be fixed. Never skip, delete, loosen or quarantine a test.

## Content flags (the second PR)

Flags drive Tonight's automatic picks, so they get their own PR for tokim25 to review.

1. Branch from your titles branch, for example `flags/2026-11-26-codex`.
2. Write a batch file outside the repo (for example `/tmp/flags.json`) from the numbers on each CSM page: CSM's "violence & scariness", "sex, romance & nudity", "language" and "drinking, drugs & smoking" scores, each 0 to 5, plus the age.

   ```json
   [{"num":1184,"on":"2026-11-23","csm":{"v":3,"s":2,"l":2,"d":0,"age":8},"bumps":{}}]
   ```

   `on` is the date you read the page. CSM shows each score as a word. Earlier batches used none (or "not present") = 0, very little = 1, a little = 2, some = 3, a lot = 4. If a page shows a level above "a lot", score it 5 (the script will hold that title out).
3. Run `node scripts/derive-flags.mjs /tmp/flags.json` (dry run), check it, then run it again with `--apply`.
4. Bumps: re-read the category text where violence is 2, drinking is 3, or language or romance is 0 but the text mentions some. Add a bump only when the content is shown on screen, with a quote of 20+ characters copied exactly from `full` and a reason. Do not bump otherwise.
5. The script holds out any title with a CSM score of 4 or more, or an age of 10 or more. Those stay unflagged for tokim25 to decide; list them in the PR body. Never hand-edit `flags` on a title that has an entry in `data-flag-basis.json`.
6. Re-run the whole "Build and validate" block, then push and open the PR.

## Pull requests

Open both against `master`. Never merge either one.

**Titles PR.** Title: `Add N family titles (nums A-B) from the catalog backlog`. Body:

- A table of each title: num, title, year, CSM age, runtime, studio, lists added to, poster yes or no.
- Held or skipped titles and why.
- Possible list fits you did not add.
- Checks run and their results, naming any pre-existing failures.
- End with "Co-authored with ChatGPT."

**Flags PR.** Title: `Flag the N titles from <date> from CSM scores (rule v1)`. Say it is built on the titles PR and must merge after it. Body: a table of num, title, CSM age, CSM v / s / l / d and the resulting flags; every bump with its quote and reason; held titles; and check results. End with "Co-authored with ChatGPT."

## Do not touch

- `index.html`, `vercel.json`, `sw.js` (other than the `DATA_VERSION` line the script writes), `data-bundle.js` by hand, anything in `tests/` or `tests-unit/`, `.github/`, `.claude/`, and any data file you have no reason to change.
- Existing catalog entries. If you think one is wrong, say so in the PR body instead of editing it.

## Done means

- Both PRs are open with green CI, or CI failures shown to be pre-existing.
- The titles PR contains, for every new title, the entry, its guidance card, its poster (if one exists), any sequel link, its list pins, the queue update, the log entry, and the regenerated `data-bundle.js` and `sw.js`.
- Nothing was merged, and no rate limit was crossed.

Co-authored with Claude
