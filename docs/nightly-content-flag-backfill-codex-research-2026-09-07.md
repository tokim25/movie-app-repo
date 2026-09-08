# Nightly Content-Flag Backfill - Codex Research Handoff

Date: 2026-09-07  
Scope: research-only handoff for `tokim25/movie-app-repo`  
Branch: `research/backfill-audit-20260907-codex`

## What Codex Safely Did Before Claude Takes Over

Codex completed repo/process research and a bounded CSM pilot, then pushed the results to this branch. That includes:

- verifying current GitHub PR state for the backfill-related work
- recounting catalog size from the local data files
- checking the proposed execution plan against the actual PR branch contents
- identifying contradictions or data-normalization issues for Claude to reconcile
- producing a first-pass handoff checklist for PM/Coder/Reviewer
- verifying that direct CSM page access works from this environment
- researching 50 representative existing catalog titles under the 4-flag model
- manually refetching 580 catalog titles through thirty parallelized subagent slices

Codex should not perform the full 938-title backfill in this pass. The plan still depends on the local bridge session on tokim25's machine for the unattended nightly run, progress checkpoints, rate-guard behavior, and PR batching. The 50-title pilot plus 580-title live-refetched set is intended to prove the research shape and give Claude concrete examples, not replace the scheduled backfill process.

Codex should also avoid doing coder, reviewer, or UX-designer work in this pass. That means no implementation changes, no PR approval opinion, and no product/interaction changes beyond research findings.

## CSM Pilot Files Added By Codex

The branch now contains five pilot JSON files with 50 total titles:

- `research/csm-content-flags-pilot-2026-09-07.json`
- `research/csm-content-flags-pilot-02-2026-09-07.json`
- `research/csm-content-flags-pilot-03-2026-09-07.json`
- `research/csm-content-flags-pilot-04-2026-09-07.json`
- `research/csm-content-flags-pilot-05-2026-09-07.json`

It also contains thirty live-refetched JSON files with 580 additional titles:

- `research/csm-content-flags-refetched-06-07-2026-09-07.json`
- `research/csm-content-flags-refetched-08-09-2026-09-07.json`
- `research/csm-content-flags-refetched-10-11-2026-09-07.json`
- `research/csm-content-flags-refetched-12-13-2026-09-07.json`
- `research/csm-content-flags-refetched-14-15-2026-09-07.json`
- `research/csm-content-flags-refetched-16-17-2026-09-07.json`
- `research/csm-content-flags-refetched-18-19-2026-09-07.json`
- `research/csm-content-flags-refetched-20-21-2026-09-07.json`
- `research/csm-content-flags-refetched-22-23-2026-09-07.json`
- `research/csm-content-flags-refetched-24-25-2026-09-07.json`
- `research/csm-content-flags-refetched-26-27-2026-09-07.json`
- `research/csm-content-flags-refetched-28-29-2026-09-07.json`
- `research/csm-content-flags-refetched-30-31-2026-09-07.json`
- `research/csm-content-flags-refetched-32-33-2026-09-07.json`
- `research/csm-content-flags-refetched-34-35-2026-09-07.json`
- `research/csm-content-flags-refetched-36-37-2026-09-07.json`
- `research/csm-content-flags-refetched-38-39-2026-09-07.json`
- `research/csm-content-flags-refetched-40-41-2026-09-07.json`
- `research/csm-content-flags-refetched-42-43-2026-09-07.json`
- `research/csm-content-flags-refetched-44-45-2026-09-07.json`
- `research/csm-content-flags-refetched-46-2026-09-07.json`
- `research/csm-content-flags-refetched-47-48-2026-09-07.json`
- `research/csm-content-flags-refetched-49-50-2026-09-07.json`
- `research/csm-content-flags-refetched-51-2026-09-07.json`
- `research/csm-content-flags-refetched-52-2026-09-07.json`
- `research/csm-content-flags-refetched-53-54-2026-09-07.json`
- `research/csm-content-flags-refetched-55-56-2026-09-07.json`
- `research/csm-content-flags-refetched-57-58-2026-09-07.json`
- `research/csm-content-flags-refetched-59-60-2026-09-07.json`
- `research/csm-content-flags-refetched-61-62-2026-09-07.json`

Each entry includes:

- existing catalog identifier when available
- title and year
- CSM URL used for the pass
- CSM age recommendation captured from the page
- 4 content-flag levels: Violence & Scariness, Language, Romance, Drinking
- evidence notes written in Codex's own words
- a prose note for emotional/sad content when relevant
- a short implementation note for Claude/Coder

The pilot and refetched files intentionally do not modify production catalog data. Claude should treat these files as source-backed research input that still needs normal review and transformation through the official backfill workflow before production import.

Notable pilot findings:

- `The Black Cauldron` currently appears as a fallback entry in local data, but a CSM page now exists and should be upgraded during backfill.
- `The Greatest Showman` and `Wicked` appear to have catalog age values below the current CSM recommendations found in the pilot.
- Low-age animated titles can still carry meaningful Violence & Scariness values, so the app should not infer content flags from age alone.
- Emotional/life-and-death content remains important in prose even after dropping `Sad moments` as a scored slider.
- In the 100-title refetch range, `Steel` remains a fallback-source title: the catalog URL is Wikipedia and targeted CSM lookup did not surface a CSM review.
- In the next 100-title refetch range, `Batman and Superman: Battle of the Super Sons` remains unavailable on CSM after targeted lookup.
- `Avengers: Doomsday` has a limited CSM preview page, but no full review, age, or category detail yet.

## Verified Repo State

GitHub reports `master` at:

`71537ab9633cd8e3bb3f62d054166ee0b8cf93ec`

Open related PRs:

- PR #30: `Merge Violence/Scariness content flags, drop Sad-moments scoring`
  - URL: https://github.com/tokim25/movie-app-repo/pull/30
  - Head: `content-flags-merge-violence-scariness-2026-09-07`
  - Head SHA: `853e1d7a9368a18e4cb9a164b5c1f33bcf59c619`
  - Base: `master`
  - Mergeable state: clean
  - Changed files: 4

- PR #31: `Add real CSM rate-limit coordination for the nightly content-flag backfill`
  - URL: https://github.com/tokim25/movie-app-repo/pull/31
  - Head: `csm-rate-limit-guard-2026-09-07`
  - Head SHA: `553fa4edb6d2ad9b7a4e87586eafeeb3a41bf91b`
  - Base: `master`
  - Mergeable state: clean
  - Changed files: 3

## Verified Catalog Counts

Current local catalog count, excluding `data-posters.js`: 938 entries.

Breakdown:

- `data-csm.js`: 66
- `data-dcom.js`: 116
- `data-disney.js`: 231
- `data-dreamworks.js`: 44
- `data-extra.js`: 239
- `data-ghibli.js`: 18
- `data-mcudc.js`: 139
- `data-nickelodeon.js`: 34
- `data-pixar.js`: 15
- `data-rt.js`: 36

This matches the plan's 938-title number.

## Fallback Count Note

An exact match for `"Not on CSM; substitute source used"` in current local data finds 18 entries:

- `data-dcom.js`: 1
- `data-disney.js`: 10
- `data-extra.js`: 2
- `data-mcudc.js`: 3
- `data-nickelodeon.js`: 2

tokim25 confirmed that the broader 29-title fallback claim is accurate: those titles do not show up in CSM.

Research implication: the catalog appears to use more than one way to represent fallback/not-on-CSM status, so the nightly selection/reporting logic should not rely only on the exact `ca === "Not on CSM; substitute source used"` string. Claude/Coder should reconcile the 29-title product truth against the data representation before scheduling.

## Outstanding Confirmations From The Pasted Plan

The pasted plan lists two confirmations as open. PR #31 appears to address both in its branch content:

1. Periodic checkpoints
   - `scripts/csm-rate-guard.mjs` adds a `checkpoint` command.
   - The skill doc instructs subagents to call:
     `node scripts/csm-rate-guard.mjs checkpoint "title N/TOTAL: <title>"`
     before each title.
   - `status` reports the last checkpoint.

2. Fresh per-PR re-verification
   - The skill doc explicitly says the candidate check happens once per PR within a night, not just once at the top of the night.
   - It gives the PR 1 / PR 2 scenario and requires PR 2 to re-fetch and re-check `origin/master` after PR 1 merges.

Research implication: if PR #31 is accepted as-is, those two plan gaps can likely move from "unconfirmed" to "implemented in PR #31, pending review/merge."

## Still Open For Claude/Coder

The new-title flow still needs confirmation or implementation so future additions stamp the same coverage fields at creation time:

- `csmRecheckedAt`
- `csmRecheckVersion`

If that is not done, newly added titles may keep appearing as unchecked in future scans.

The 29 fallback titles also need a normalized source-of-truth representation before the nightly run starts. The plan can keep the product-level number as 29, but the code/reporting path should be able to find the same 29 deterministically.

## Recommended Claude Handoff

Ask Claude to take over with these instructions:

1. Review PR #30 and PR #31 together against the plan.
2. Treat PR #31 as the likely resolution for checkpoint logging and per-PR re-verification, but verify from the diff before closing those items.
3. Reconcile the 29 not-on-CSM titles against current data representation. Do not use only the exact `ca` fallback string unless the data is normalized first.
4. Implement or confirm new-title stamping for `csmRecheckedAt` and `csmRecheckVersion`.
5. Do not schedule the nightly job until the final go-live checkpoint includes the resolved fallback count, merged PRs, and watcher behavior.

## Non-Goals For This Codex Pass

- No full-catalog CSM backfill.
- No production catalog score changes.
- No app UI changes.
- No reviewer approval.
- No automation scheduling.
