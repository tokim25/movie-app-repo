# Nightly Content-Flag Backfill - Claude Run 3 Handoff (next-100 complete)

Date: 2026-09-07
Scope: research-prep-only handoff for `tokim25/movie-app-repo`
Branch: `research/backfill-audit-20260907-codex`
Author: Claude (local session with real network access, completing `next-100-titles-2026-09-07.json`)

## Result: all 100 of 100 titles now complete

Run 2 (commit `8912336`) completed 4 titles before a CSM connectivity issue stopped the whole batch. Before
resuming, this run verified CSM was reachable again with two isolated, non-concurrent fetches (both
succeeded), then split the remaining 96 titles into 4 groups of 24 and ran them concurrently, same protocol
as before. All 4 groups finished cleanly this time: no blocks, no early stops, and the shared rate-guard
counter (98/220 at the end) never came close to either cap.

**This closes out the full 100-title candidate list** (`research/next-100-titles-2026-09-07.json`):

| Run | Titles completed | Result |
|---|---|---|
| Run 2 (`8912336`) | 4 | Stopped early on a self-signaled CSM connectivity block |
| Run 3 (this commit) | 96 | All 4 groups completed in full |
| **Total** | **100 / 100** | **Candidate list fully researched** |

The 96 new entries are split across 4 files, matching the original per-group naming pattern:

- `research/csm-content-flags-claude-next100-resume-group1-2026-09-07.json` (24 entries)
- `research/csm-content-flags-claude-next100-resume-group2-2026-09-07.json` (24 entries)
- `research/csm-content-flags-claude-next100-resume-group3-2026-09-07.json` (24 entries)
- `research/csm-content-flags-claude-next100-resume-group4-2026-09-07.json` (24 entries)

## The 27 fallback/approximate titles: now fully resolved

Combined with the 2 resolved in Run 2, all 27 of the priority fallback/approximate entries this candidate
list was built to close now have an explicit answer:

- **24 titles confirmed correct as-is.** CSM has no review for these; the catalog's existing fallback flag
  should stay until CSM publishes one. Full list and reasoning are in each entry's `handoffNotes`.
- **3 titles should be upgraded**, because a real, live CSM review exists and the catalog either doesn't
  reflect it or marks it as unreviewed:
  - **Snow Day** (num 546, `data-nickelodeon.js`): catalog says "Not on CSM," but CSM has a review for this
    exact 2000 film (not the 2022 remake, which has its own separate page) rated 5+.
  - **Genius** (num 163, `data-dcom.js`, from Run 2): catalog lists 7+; CSM rates it 8+.
  - Several "(approximate)" entries in Group 1 turned out to match their real CSM rating closely or exactly
    once checked directly (The Magic Faraway Tree, High School Musical 2, Zenon: Z3, the Descendants
    trilogy, Camp Rock 2). These are confirmations rather than corrections, but are now backed by a real
    review instead of a guess. See `research/csm-content-flags-claude-next100-resume-group1-2026-09-07.json`
    for the specific CSM age next to each.

## Notable findings for a human reviewer

- **The Color of Friendship** (Group 4, `data-dcom.js`): CSM rates language "a lot" (level 4) because of
  real historical slurs used in an anti-apartheid educational context. The catalog currently lists this
  title at 10+; a reviewer should decide whether the language level alone should raise that.
- **Trenchcoat** (1983, Group 1): Wikipedia's plot detail is thin. It's documented mainly as one of the
  films that led Disney to launch Touchstone Pictures for more mature content. Marked `confidence: "low"`;
  a reviewer should double-check before trusting the assigned levels.
- **Group 2 caught and fixed a mid-run mismatch on its own**: the first WebFetch for "Frozen" returned the
  wrong film, a 2010 horror movie with the same title, not Disney's 2013 animated film. The subagent
  noticed, re-searched, and re-fetched the correct `frozen-0` review before writing the entry. Worth knowing
  about as a real failure mode of title-based CSM search, even though it self-corrected this time.
- Several ordinary CSM-vs-catalog age mismatches were flagged in `handoffNotes` for reviewer visibility:
  Under Wraps (7+ to 8+), High School Musical (7+ to 8+), Halloweentown (7+ to 6+), The Cheetah Girls (7+
  to 8+).

## CSM request accounting (this run)

- Rate-guard `acquire` calls: roughly 97 (about 24 per group, plus a couple of retries such as Group 2's
  Frozen correction).
- Never hit the nightly cap (220) or per-minute cap (10/min); no blocks, no `signal-block` calls at any
  point in this run.
- The CSM connectivity issue from Run 2 appears to have been transient. It's still worth doing the same
  isolated-fetch sanity check before any future large concurrent batch, since the cause was never fully
  diagnosed.

## What this does and does not mean for the catalog

This is still research-only output, same as every prior pass on this branch. Nothing here has been written
to `index.html`, any `data-*.js` file, or `scripts/validate-data.mjs`. The next step is for a human or a
follow-up importer session to review these files, plus the earlier `csm-content-flags-refetched-*` and
`csm-content-flags-claude-next100-partial-*` files, and apply the changes through the real PR/review
pipeline, including the 3 upgrade cases above.

## Recommended next step

1. Have a reviewer (human or a dedicated review pass) go through all of this branch's research output,
   including this run's, and produce the actual catalog PR: apply the confirmed content-flag data, upgrade
   the 3 identified fallback/approximate entries, and resolve the age mismatches noted for reviewer
   attention.
2. With the original 100-title candidate list now fully researched, decide whether to prepare a further
   candidate batch from the remaining catalog (628 total uncovered minus this batch's 100, so 528 titles
   still outside any research pass) or shift focus to reviewing and merging what's already here.

## Non-goals for this pass

- No production catalog changes (`index.html`, `data-*.js`, `scripts/validate-data.mjs` untouched).
- No changes to PR #30, #31, or the rate-guard script itself.
- No scheduling decisions.
