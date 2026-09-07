# Nightly Content-Flag Backfill - Claude Run 2 Handoff (next-100 attempt)

Date: 2026-09-07
Scope: research-prep-only handoff for `tokim25/movie-app-repo`
Branch: `research/backfill-audit-20260907-codex`
Author: Claude (local session with real network access, picking up `next-100-titles-2026-09-07.json`)

## Result: 4 of 100 titles completed, then stopped by a self-signaled CSM connectivity block

The 100-title candidate list (`research/next-100-titles-2026-09-07.json`) was split into 4 concurrent
research subagents of 25 titles each, per the standing protocol. All 4 launched and began real
`WebSearch`/`WebFetch` research against `commonsensemedia.org`.

Group 1's very first CSM fetch (*The Magic Faraway Tree*) returned `ETIMEDOUT`. A second, unrelated CSM
URL (*Nacho Libre*) also timed out. A control fetch of a non-CSM page (Wikipedia) succeeded instantly,
which confirmed the failure was specific to `commonsensemedia.org` and not a general fetch problem. Per
the standing protocol ("if any fetch looks like a block... signal-block immediately, then stop"), Group 1
called `node scripts/csm-rate-guard.mjs signal-block` and stopped. The rate-guard state file is shared
across all 4 concurrent groups by design, so each other group's next `acquire` call picked up that block
and stopped immediately too: no retries, no fallback sources, no continuing to further titles, exactly as
specified. The nightly request counter was at 77/220 when this happened (10 of those calls came from this
run; see the accounting section below), so this was not nightly-cap exhaustion. It looks like CSM either
rate-limiting or otherwise blocking/throttling this fetcher specifically.

**4 titles were fully, genuinely researched (live CSM fetch or fallback) before the stop:**

| num | title | result |
|---|---|---|
| 124 | The 400 Blows | Found on CSM (13+, matches catalog) |
| 163 | Genius | Found on CSM (8+ vs catalog's 7+ — 1-year mismatch, flagged for reviewer) |
| 1035 | Air Bud Returns | Not on CSM (unreleased, Jan 2027) — fallback via Wikipedia |
| 1054 | Octonauts & the Ring of Fire | Not on CSM (only a series-level CSM page exists) — fallback via search summaries |

All 4 are written to `research/csm-content-flags-claude-next100-partial-2026-09-07.json`, using the same
schema as prior batches, with a `handoffSummary` documenting the early stop in the file itself.

**96 titles were not researched at all.** That's not a "couldn't be resolved" outcome for each one
individually; the run stopped before reaching them. See `research/next-100-titles-2026-09-07.json` for the
full original list. Everything except nums 124, 163, 1035, and 1054 is still open.

## The 27 fallback/approximate titles — explicit status (per the standing requirement)

The candidate list was specifically prioritized to include all 14 remaining exact-fallback
(`"Not on CSM; substitute source used"`) entries and all 13 `"(approximate)"` age entries. Here is the
explicit answer on all 27, as required:

- **2 of 27 resolved**, both from the exact-fallback set, both confirmed correct as-is with no CSM upgrade
  available:
  - **Air Bud Returns** (num 1035): unreleased film (Jan 22, 2027), so no CSM review exists yet, live or
    otherwise. Keep the substitute-source flag until a real review is published post-release.
  - **Octonauts & the Ring of Fire** (num 1054): CSM has no movie-specific review, only a general
    Octonauts TV-series page, which isn't a valid substitute for movie-level category data. Keep the
    substitute-source flag until CSM publishes one.
- **25 of 27 unresolved.** 12 more exact-fallback titles and all 13 "(approximate)" titles were in Group
  1's batch (see the entries with `num` 137, 138, 141, 143-149, 151, 153-155, 259, 343, 354, 365, 370,
  371, 373, 392, 393, 546, 561 in `research/next-100-titles-2026-09-07.json`). Group 1 hit the
  connectivity failure on its very first title and stopped before completing any of them. This is most of
  what this pass was specifically prioritized to close, and it's still open.

## CSM request accounting

- Rate-guard `acquire` calls made in this run specifically: 10. (The nightly counter went from 67, left
  over from an earlier crashed attempt at this same batch described below, to 77.)
- Never hit the nightly cap (220) or the per-minute cap (10/min); the stop was entirely due to the
  self-signaled connectivity block, not quota exhaustion.
- The rate-guard state file (`.csm-rate-state.json`, gitignored, not committed) still has `blocked` set.
  Whoever resumes should either wait for the automatic next-UTC-day reset or run
  `node scripts/csm-rate-guard.mjs reset` after independently confirming CSM is actually reachable again.
  Resetting blindly just reproduces the same immediate block.

## Two operational notes for whoever picks this up next

**1. Verify CSM connectivity in isolation before re-running all 4 groups concurrently.** The failure
pattern (consistent `ETIMEDOUT` on CSM specifically, instant success on Wikipedia) suggests CSM may be
rate-limiting or blocking this fetcher's IP or traffic pattern, possibly because the concurrent-group
approach across two separate research passes today has already sent it a lot of traffic. Before relaunching
4 concurrent subagents again, do a single isolated fetch of 2-3 real CSM review URLs first, with no
concurrency, and confirm they succeed. If they still time out, this needs a longer cooldown, not an
immediate retry.

**2. Watch out for the git worktree collision hazard on this branch.** Mid-run, this session discovered
that `research/backfill-audit-20260907-codex` was checked out in two worktrees at once: this session's, and
a Codex worktree at
`/Users/tonykim/Documents/Codex/2026-09-05/referenced-chatgpt-conversation-this-is-an/work/movie-app-logic-restore`.
That Codex worktree was initially assumed stale, but turned out to still be live, and it pushed 3 more
commits (`ebcdf1e`/`87f725e`/`94ee352`, 220 more entries covering nums 188-418, no overlap with this batch)
partway through this run. This session had used `git worktree add --force` to work around the "branch
already checked out" error, so both worktrees ended up sharing the same branch ref. When Codex committed,
this session's branch pointer silently advanced too, while its index and working tree did not, which made
`git status` briefly show Codex's brand-new files as "deleted." This was caught and fixed with
`git reset --hard HEAD` before anything was committed, so no data was lost. The next session on this branch
should not assume a same-branch worktree elsewhere is stale without checking its last-commit timestamp, and
should avoid `--force`-adding a second worktree on a branch that's actively being pushed to.

## Recommended next step

1. Confirm CSM is reachable again (see note 1 above), then re-run `next-100-titles-2026-09-07.json`
   starting from num 137 (Group 1's original start). 96 titles remain, including 25 of the 27
   fallback/approximate priority titles.
2. Leave a matching handoff doc here, in the same pattern as this one, Codex's original, and the prior
   Claude handoff.

## Non-goals for this pass

- No production catalog changes (`index.html`, `data-*.js`, `scripts/validate-data.mjs` untouched).
- No changes to PR #30, #31, or the rate-guard script itself.
- No scheduling decisions.
