# Nightly Content-Flag Backfill - Claude Run 4 Handoff (next-39c batch)

Date: 2026-09-08
Scope: research-prep-only handoff for `tokim25/movie-app-repo`
Branch: `research/backfill-audit-20260907-codex`
Author: Claude (local session with real network access, continuing past the completed next-100 batch)

## Result: 39 titles researched, after two discarded collisions with Codex

This session attempted three batches of 39 titles today. The first two were fully discarded before
committing, because Codex researched the identical ranges concurrently while this session's subagents were
running. Only the third attempt is committed here.

Here is what happened, in order:

1. **First attempt (nums 419-457, ascending from where Codex had last covered):** completed all 39 titles,
   but Codex pushed a new commit covering the same 419-530 range while the research was in flight. Fully
   discarded before committing, no branch changes made.
2. **Second attempt (nums 531-573, re-synced and continued ascending):** completed all 39 titles, but
   Codex pushed another commit covering 531-939 while this research was in flight, again fully overlapping.
   Fully discarded before committing.
3. **Third attempt (nums 1011-1055, this commit):** selected from the high end of the remaining catalog
   nums instead of continuing ascending, since Codex is clearly working ascending through the catalog much
   faster than this session's approach. No overlap this time. All 39 titles completed cleanly with zero
   rate-guard blocks.

**Why this matters for whoever picks this up next:** Codex is moving through the catalog fast enough
(roughly 100+ titles per commit, several commits in the time this session completed one 39-title batch)
that picking up "the next N titles ascending from the last known coverage" is now an unreliable strategy,
since by the time a batch finishes, Codex has likely already covered that range. Re-syncing immediately
before picking a range is necessary but not sufficient; re-check again right before committing, and prefer
picking from a part of the remaining set Codex hasn't reached yet if research will take more than a few
minutes.

## What's in this commit

`research/csm-content-flags-claude-next39c-group1-2026-09-08.json` through `-group4-...json` (39 entries
total, nums 1011-1055), plus `research/next-39-titles-c-2026-09-08.json` documenting the selection.

All 39 had a real, live CSM review. No fallback sources were needed for any title in this batch, including
several niche or recent animated titles in Group 4 that were flagged as possibly lacking CSM coverage but
turned out to have real reviews anyway: Latte and the Magic Waterstone, Arlo the Alligator Boy, Hilda and
the Mountain King, Dog Gone Trouble, Orion and the Dark, and both newer Octonauts entries.

None of the 39 carried a "Not on CSM" or "(approximate)" `currentCa` flag, so no fallback resolution was
needed in this batch.

## Notable findings for a human reviewer

Wicked: For Good (num 1040) has CSM flagging a major character death, suicide contemplation, and permanent
separation between friends. It's worth a careful read of the summary before this reaches a family catalog.

To Kill a Mockingbird (num 1020) has content beyond the standard flags: CSM's own detail text covers racial
slurs and courtroom testimony involving rape and incest. This is flagged explicitly in the entry's
`handoffNotes`, since the category labels alone understate the seriousness.

Octonauts & the Caves of Sac Actun (num 1053) has CSM itself calling out stereotyping of an Indigenous
Yucatan character. This is worth surfacing to a reviewer directly, since it's a content concern CSM flags
that doesn't map cleanly onto any of the four scored categories.

## Catalog coverage after this commit

Before this session's next-100 batch earlier today, coverage was 530 of 939, all from Codex, leaving 409
remaining. After the next-100 batch completed, coverage reached 630 (530 Codex plus 100 Claude), leaving
309 remaining. Codex then pushed several more commits concurrently during this session, bringing coverage
to 830 and remaining down to 109, including the 419-573 range this session's first two discarded attempts
had duplicated. After this commit, coverage stands at 869 (830 Codex plus 39 Claude, nums 1011-1055), with
70 remaining.

One stray entry is worth flagging: num 666 remains uncovered and sits alone in an otherwise fully-covered
low range. It's easy to miss in a future ascending or descending batch since it doesn't fall at either end
of the remaining set. Whoever prepares the next batch should check for it specifically.

## CSM request accounting (this run)

Rate-guard `acquire` calls: roughly 39 in the successful third attempt. The two discarded attempts also
made real CSM requests, but that research was never committed. Never hit the nightly cap (220) or
per-minute cap (10/min) in any of the three attempts; no blocks, no `signal-block` calls.

## Recommended next step

Before starting the next batch, re-sync with `origin/research/backfill-audit-20260907-codex` and re-check
what's actually still uncovered, given how fast Codex is moving. Research num 666 specifically, since it's
isolated from both ends of the remaining range. Continue narrowing the remaining 70 titles from whichever
direction the sync shows is safest.

## Non-goals for this pass

- No production catalog changes (`index.html`, `data-*.js`, `scripts/validate-data.mjs` untouched).
- No changes to PR #30, #31, or the rate-guard script itself.
- No scheduling decisions.
