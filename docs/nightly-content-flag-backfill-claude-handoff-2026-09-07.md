# Nightly Content-Flag Backfill - Claude Handoff (following Codex's research pass)

Date: 2026-09-07
Scope: research-prep-only handoff for `tokim25/movie-app-repo`
Branch: `research/backfill-audit-20260907-codex`
Author: Claude (Movie Repo PM session)

## What Claude did in this pass

- Reviewed Codex's handoff doc and all 18 research files directly (not by summary) — verified the branch is real, spot-checked entry #276 (*The Black Cauldron*) against the live catalog and confirmed it's accurate, and confirmed the JSON schema matches the app's real 4-flag `CONTENT_FLAGS` model (violence/language/romance/drinking) shipped in PR #30.
- Re-ran Codex's fallback-count claim independently rather than trusting either Codex's "18" or the "29" figure PM had been repeating all night (originally reported by Coder). **Result: both numbers were correct for what they measured, and neither told the whole story on its own.**
- Prepared, but did **not** execute, a "next 100" research candidate list for whoever picks this up next.

## Fallback-count finding, resolved

tokim25 confirmed directly: **29 is the correct product-truth count** of catalog titles that don't actually have a real CSM review.

The data only represents **18 of those 29** via the exact `"ca": "Not on CSM; substitute source used"` string (verified by literal grep against every `data-*.js` file, file-by-file):

```
data-dcom.js: 1
data-disney.js: 10
data-extra.js: 2
data-mcudc.js: 3
data-nickelodeon.js: 2
= 18
```

This matches Codex's independent count exactly. **The other 11 of the real 29 are not currently flagged as fallback in the data at all** — they likely carry a normal-looking `ca` value (an age rating) that was actually guessed/approximated rather than sourced from a real CSM review, without being marked as such.

**Confirms Codex's own research implication:** the catalog represents "no real CSM review" in more than one way, so the nightly backfill's batch-selection/reporting logic must not rely solely on the exact fallback string, or it will silently miss ~11 titles that need the same upgrade treatment as the 18 obviously-flagged ones.

**A related, separately-verified finding:** 13 entries (all in `data-dcom.js`) use a distinct marker — `"ca":"N+ (approximate)"` or `"~N+ (approximate)"` — an approximated age rating, not a "no CSM review" fallback exactly, but the same underlying problem (no real sourced review backing the number). These may or may not overlap with the "missing 11" above; not yet reconciled title-by-title.

**Open reconciliation task, not yet done by anyone:** identify which specific 11 titles (of the 18-vs-29 gap) and how they overlap with the 13 "(approximate)" entries, so the nightly job's selection logic can find all 29 deterministically rather than by exact-string match alone. The `next-100-titles-2026-09-07.json` candidate list below prioritizes closing this gap — it includes all 14 remaining-uncovered exact-fallback entries and all 13 "(approximate)" entries that Codex's first 310 titles didn't already cover.

## Why Claude didn't run the next 100 titles directly

Verified live, at the start of this pass: Claude's own session (the cloud "Movie Repo PM" environment) gets `EGRESS_BLOCKED` on any `commonsensemedia.org` fetch — the exact same network-egress-proxy denial documented for every other cloud session on this team all night (PRs #13/#19/#20/#22's history). This is not a Codex-vs-Claude difference in research capability; it's this specific session's environment. Any subagent spawned from within this session would inherit the identical block, so spawning subagents here to "research the next 100" would either fail outright or — worse — risk a subagent fabricating CSM content it couldn't actually fetch, which is exactly the failure mode this whole initiative has been designed to prevent (see the "identical protocol, never fabricate" rule already in `movie-watchlist-updater/SKILL.md`'s backfill-mode section).

Real CSM research from the Claude side needs to run from whichever environment actually has network access — per this team's own plan, that's the local "Movie watchlist weekly update" bridge session on tokim25's machine. Whatever gives Codex real CSM access in its own pass may or may not be the same mechanism; Claude doesn't have visibility into Codex's execution environment from here.

## `next-100-titles-2026-09-07.json` — ready-to-execute candidate list, not yet researched

100 titles, selected from the 628 catalog entries Codex's 310 don't yet cover, prioritized:
1. All 14 remaining exact-fallback (`"Not on CSM; substitute source used"`) entries not already in Codex's batches.
2. All 13 `"(approximate)"` age entries not already in Codex's batches.
3. 73 more titles by ascending catalog `num`, to keep the batch at a round 100 and make the next handoff's "next N" math simple.

Each entry has `num`/`file`/`title`/`currentCa` — enough for whoever executes this pass (real `WebSearch`/`WebFetch` against CSM required, per the standing rule) to follow the same research protocol Codex used and Coder's SKILL.md backfill-mode section documents.

## Recommended next step

Whoever has real CSM access next (Codex's next pass, or the local bridge session once it's actually scheduled) should:
1. Research the 100 titles in `next-100-titles-2026-09-07.json`, same schema/protocol as Codex's existing files.
2. While in there, do the num-by-num reconciliation of the 18-vs-29 gap and the "(approximate)" overlap noted above, and record it explicitly (which specific titles account for the missing 11) so the nightly job's real selection logic (once `csmRecheckedAt`/`csmRecheckVersion` land, per PR #30/#31's still-open dependency) has a normalized fallback definition to work from, not just the one exact string.
3. Leave a matching handoff doc here, same pattern as this one and Codex's original, so the branch stays legible across however many more passes this takes.

## Non-goals for this pass

- No CSM research executed (network-blocked, documented above).
- No production catalog changes.
- No changes to PR #30 or #31.
- No scheduling decisions.
