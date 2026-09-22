# Roadmap

**Owner:** Movie Repo PM
**Last updated:** 2026-09-22
**Status:** Living document — updated as priorities, issues, and PRDs change. This is the
single source of truth for "what's next and why"; PRDs/TRDs under `docs/` hold the
detailed requirements for a given initiative, this file tracks sequencing and status
across all of them.

## How this works

- **PM (this role) owns this file and any PRD under `docs/`.** Tech Lead owns the
  corresponding TRDs and architecture calls within a PRD's constraints. Coder implements
  against open issues/PRs. Reviewer gates quality. Comms communicates externally.
- Each item below links to its issue/PRD. When an item's status changes (a PR merges, a
  gate is passed, a decision is made), this file gets updated in the same session that
  learns about it, not on a separate audit pass.
- Priority order is **Now → Next → Later**, not a fixed calendar. Now = actively being
  worked or next up for Coder; Next = queued, scoped, not yet started; Later = real but
  intentionally deferred.

## Now

**Top priority as of 2026-09-22 (tokim25):** the Phase 1 runtime backfill below — everything
else in this section is still real and still Now, but this is the one to unblock first.

### Trust & safety P0s (independent of the recommendations initiative)
These are live correctness/privacy defects, not roadmap-gated — they should not wait on
the Trusted Contextual Recommendations phases below, several of which they block anyway.

| Issue | Problem | Notes |
|---|---|---|
| [#92](https://github.com/tokim25/movie-app-repo/issues/92) | Tonight age eligibility uses the oldest child, allowing titles above younger viewers' age guidance | **Dispatched to Coder 2026-09-22**, queued behind the in-flight runtime backfill. Has an exact policy answer now (Gate 0 §1: strict, per-child, no `+2`) |
| [#93](https://github.com/tokim25/movie-app-repo/issues/93) | Tonight's terminal fallback returns `MOVIES[0]` even when no title is eligible | **Dispatched to Coder 2026-09-22** alongside #92 (same functions, one PR). tokim25 confirmed this reproduces on real production data today — a 1 or 2-year-old's age ceiling (3 or 4) is below the catalog's lowest guidance (5+), so it triggers right now, not just in a synthetic fixture |
| [#96](https://github.com/tokim25/movie-app-repo/issues/96) | Tonight can label heuristic-only movies green without confirmed title-specific content data | **Dispatched to Coder 2026-09-22**, queued behind #92/#93. Connects directly to the `contentStatus` work from #127 — likely one combined PR with #92/#93 |
| [#98](https://github.com/tokim25/movie-app-repo/issues/98) | Undisclosed Sentry processing contradicts "never sent" / "no third-party disclosure" claims | **Dispatched to Coder 2026-09-22**, queued behind #92/#93/#96. Combined with #99 (same fix class); doesn't touch Tonight code so can run parallel to the eligibility work if that's easier |
| [#99](https://github.com/tokim25/movie-app-repo/issues/99) | Policy/Terms omit child profiles, content limits, override history, device metadata | **Dispatched to Coder 2026-09-22** alongside #98 — privacy.html/terms.html don't disclose what `serializeState()` actually persists/syncs (child names, ages, limits, override history, device IDs) |

Also new since the last sweep, P1, not yet bucketed into a phase: [#94](https://github.com/tokim25/movie-app-repo/issues/94)
(green explanation always says "starter settings" even with custom limits), [#95](https://github.com/tokim25/movie-app-repo/issues/95)
(CLOSED — `ca: "7"` Scoob! bug, fixed as a side effect of PR #127), [#97](https://github.com/tokim25/movie-app-repo/issues/97)
(Tonight source-tier precedence can override selected mood). #97 was previously miscategorized as P2 in this doc's "Later" section — corrected, see below.

### Trusted Contextual Recommendations — Phase 0 (Trust corrections + policy)
PRD: [`docs/prd-trusted-contextual-recommendations.md`](./prd-trusted-contextual-recommendations.md)
TRD: [`docs/trd-trusted-contextual-recommendations.md`](./trd-trusted-contextual-recommendations.md)
Gate 0 policy contract: [`docs/gate0-policy-trusted-recommendations.md`](./gate0-policy-trusted-recommendations.md)
— **CLOSED 2026-09-21, `policyVersion: 1` frozen.** tokim25 confirmed the age-band
content-flag thresholds (loosened the 9-12 band to match 13+) and the same-day-PM-triage
staffing model; Tech Lead confirmed engineering feasibility with two corrections applied
(`contentStatus` field naming, and the initial-certified-subset count corrected from a
double-subtracted 972 to the verified 989). Phase 1 is unblocked.

- [#89](https://github.com/tokim25/movie-app-repo/issues/89) — duration selection doesn't affect recommendations (no runtime field on any of 1,047 titles); Phase 0 says remove/disable the duration claim until this is resolved
- Privacy corrections (#98, #99 above, plus #100, #102, #106 below) fold into Phase 0's "correct privacy disclosures" requirement

### Trusted Contextual Recommendations — Phase 1 (Certified catalog foundation) — TOP PRIORITY, in progress
[PR #127](https://github.com/tokim25/movie-app-repo/pull/127) — schema/validator work is
done: `scripts/catalog-schema.mjs` implements normalized `recommendedAge` (resolved all
18 of the PRD's non-normalizable ages, including a genuine data bug fix on `Scoob!`) and
the `contentStatus` 5-state machine from Gate 0 §3. CI green. Reviewer approved (one
non-blocking finding on `hasVerifiedRuntime()` not checking `runtimeSourceId`/
`runtimeVerifiedAt` alongside `runtimeMinutes`, fixed same day, cb7d2b7). Tech Lead
subscribed but hasn't weighed in yet as of 2026-09-22 — broadcast confirmed sent at
PR-open time, just normal async timing, not a dropped handoff.

Current coverage: `certified=0, provisional=990, conflicted=21, unknown=36`. **Zero
titles are certified yet** — `runtimeMinutes` backfill for the ~990-candidate pool
(Gate 0 §6's count, revised up by 1 from 989 after the Scoob! fix) hasn't happened. Coder
hit a real network-egress block on direct Wikipedia/IMDb fetches and correctly escalated
rather than fabricating numbers or routing around it (per Gate 0 §7). Resolved 2026-09-22:
WebSearch snippet extraction works around the block (verified directly — same fallback
this project has used for CSM content research all along, just hadn't been applied to
runtime specifically). Not a policy change; runtime backfill is now unblocked as its own
follow-up work, batched like the content-flag backfill (~40-50 titles/PR) rather than
gating #127's merge.

**Elevated to top priority 2026-09-22 (tokim25) — dispatched to Coder to start
immediately**, not on the whenever-convenient timeline this was originally scoped with.
Coder was idle (both #127 and #128 merged) so nothing else was in the way. This is the
critical path for every remaining phase of the initiative — no title reaches `certified`
without it.

[PR #129](https://github.com/tokim25/movie-app-repo/pull/129) — first WebSearch-snippet
backfill batch (47 titles, first ever `certified` records) landed shortly after dispatch,
open pending review.

**[PR #130](https://github.com/tokim25/movie-app-repo/pull/130) merged same day — `data-runtimes.json`,
a bulk reference sourced from the real IMDb Non-Commercial Datasets (`title.basics.tsv.gz`),
covering 1,070 of 1,071 catalog titles. Initial handling of this was wrong and got
corrected within the hour — logged honestly below rather than cleaned up after the fact.**

PM's first call: told Coder to spot-check a sample and use #130 to finish the *entire*
remaining backfill in bulk, superseding PR #129 (the in-flight WebSearch-snippet batch)
and PR #131 (a second one Coder had already opened, 11 titles). Also cleared the dataset's
non-commercial-use licensing note unilaterally as "not a blocker."

**Tech Lead caught both of those as wrong**, independently, by actually reading the PR's
content rather than trusting the description: 496 of 1,071 matches (46%) had multiple
ambiguous IMDb candidates (title+year collisions — shorts, TV movies, re-release cuts)
resolved silently to one pick with zero disambiguation trail — exactly the kind of
unverified confidence Gate 0 exists to prevent, and something a "spot-check a handful"
bar would never have caught. Tech Lead also correctly pushed back that the licensing
question is tokim25's call, not PM's or Tech Lead's to wave through for a live public
deployment.

**Corrected plan, same day:** #129 and #131 stay as originally written (Tech Lead has no
concerns with the field-on-record WebSearch pipeline itself — that's what Gate 0 actually
committed to, and it's unaffected by any of this since it doesn't depend on IMDb's
dataset). #130 is a QA-gated accelerator, not a bulk import: only `candidateCount: 1` +
`confidence: "high"` matches auto-promote directly into `runtimeMinutes`/`runtimeSourceId`
(stamped as IMDb-dataset-derived, distinct from the snippet-sourced records)/
`runtimeVerifiedAt`; the ambiguous ~496 need the same real verification as everything
else, not a silent import. Licensing question put to tokim25 directly rather than assumed
— confirmed fine (non-commercial family app). Net effect: backfill keeps moving on the
already-trusted pipeline the whole time; #130 speeds up only the unambiguous slice of it,
once verified.

## Next

### Accessibility P1s
A cluster of a11y bugs, several touching the same Tonight/Shelf surfaces the
recommendations PRD will also touch — worth clearing before or alongside Phase 2
(eligibility engine UI work) rather than layering new UI on top of broken a11y semantics.

- [#110](https://github.com/tokim25/movie-app-repo/issues/110) — stale validation alert + lost focus after sample-family setup
- [#111](https://github.com/tokim25/movie-app-repo/issues/111) — new Tonight picks not announced to screen readers
- [#112](https://github.com/tokim25/movie-app-repo/issues/112) — Shelf Details disclosures drop focus, missing expanded-state semantics
- [#113](https://github.com/tokim25/movie-app-repo/issues/113) — Shelf movie actions omit movie title from accessible names
- [#114](https://github.com/tokim25/movie-app-repo/issues/114) — app screens not contained in a main landmark
- [#115](https://github.com/tokim25/movie-app-repo/issues/115) — add-family-member validation leaves focus on Save, no invalid-field state

### Data integrity / sync P1s — dispatched 2026-09-22
Independent of the Tonight/P0 queue (different subsystem entirely), so Coder can run
this in parallel rather than strictly after.
- [#116](https://github.com/tokim25/movie-app-repo/issues/116) — stale tabs overwrite newer local changes instead of merging (data loss)
- [#118](https://github.com/tokim25/movie-app-repo/issues/118) — offline navigation serves wrong document, can overwrite cached app shell
- [#124](https://github.com/tokim25/movie-app-repo/issues/124) — blocking `localStorage` read can abort app startup
- [#125](https://github.com/tokim25/movie-app-repo/issues/125) — storage write failures silently discard family changes

### Remaining privacy P1s
- [#100](https://github.com/tokim25/movie-app-repo/issues/100) — Google sync's 180-day refresh-token cookie/session retention undisclosed
- [#101](https://github.com/tokim25/movie-app-repo/issues/101) — child-name redaction is case-sensitive, excludes one-character names
- [#102](https://github.com/tokim25/movie-app-repo/issues/102) — Disconnect can't delete hidden Drive state file / all synced child data
- [#106](https://github.com/tokim25/movie-app-repo/issues/106) — movie requests submitted to Google Forms without disclosure
- [#107](https://github.com/tokim25/movie-app-repo/issues/107) — request form always reports success even when submission fails

## Later

### Trusted Contextual Recommendations — Phases 2-4
- **Phase 2 — Eligibility engine:** pure eligibility firewall, no more amber/red or
  first-title fallback, no-confident-match state. Blocked on Gate 2 (exhaustive
  boundary/monotonicity tests).
- **Phase 3 — Contextual ranking:** reviewed experience attributes, mood benchmark vs.
  frozen baseline. Blocked on Gate 4; a missed mood benchmark blocks only the improved
  mood claim, not the certified eligibility engine itself.
- **Phase 4 — Measurement and feedback:** privacy-reviewed outcome feedback, selection
  time / good-pick rate / no-match rate. Blocked on Gates 5-6 plus a separate
  analytics/privacy decision if any data leaves the device.

### Tonight correctness P1s — dispatched 2026-09-22
Queued behind #92/#93/#96 specifically (not the data-integrity batch) since these touch
the same `findTonightCandidate()`/`movieVerdictForKids()`/`showTonightPick()` functions —
sequenced to avoid two concurrent branches fighting over the same code.
- [#97](https://github.com/tokim25/movie-app-repo/issues/97) — Tonight source-tier precedence can override the selected mood
- [#103](https://github.com/tokim25/movie-app-repo/issues/103) — skip feedback carries the previous movie's reason into the next skipped title
- [#104](https://github.com/tokim25/movie-app-repo/issues/104) — repeated "Watch anyway" taps create duplicate override signals
- [#105](https://github.com/tokim25/movie-app-repo/issues/105) — changing viewers/mood/time leaves the stale recommendation card visible
- [#108](https://github.com/tokim25/movie-app-repo/issues/108) — Tonight reports content-issue count as number of children affected
- [#94](https://github.com/tokim25/movie-app-repo/issues/94) — green explanation always says "starter settings" even with custom limits

### Remaining P2s (not yet triaged into a phase)
Installability/PWA polish (#119-123), watched/want-to-watch state cleanup (#117). Will get
bucketed into Now/Next as capacity opens up or a related PR touches the same code.

### Ongoing (not phase-gated)
- **Weekly catalog intake/triage** (PM) — request-sheet processing + new-release
  discovery, continues on its existing weekly cadence independent of the above.
- **Content-flag backfill** (Tech Lead/Coder, per `SKILL.md`'s "Re-researching an
  existing entry" mode) — the 36 heuristic-only titles and 18 non-normalized ages the
  PRD's "Current state" section calls out feed directly into Phase 1 certification, so
  this work should be prioritized toward titles likely to enter the initial certified
  subset rather than run in ordinal catalog order.

## Open product decisions — RESOLVED 2026-09-21

The PRD's "Open product decisions" list (recommended-age strictness, hard-excludes vs.
warn-me settings, mandatory certification dimensions, initial certified subset, plus
staffing/ownership) is now answered in full by the frozen Gate 0 policy contract —
[`gate0-policy-trusted-recommendations.md`](./gate0-policy-trusted-recommendations.md).
This section is kept only as a pointer; the PRD's own list is now historical, not open.

## Change log

- **2026-09-21** — Roadmap created. PM takes ownership of PRD/roadmap per tokim25. Seeded
  from the existing `prd-trusted-contextual-recommendations.md`/TRD (merged today as
  PR #90) plus a full sweep of the 30 open issues at time of writing.
- **2026-09-21** — Drafted the Gate 0 policy decision record
  (`gate0-policy-trusted-recommendations.md`), answering the PRD's 7 open product
  decisions. Sent to Tech Lead for feasibility review; §2 and §7 flagged for tokim25
  sign-off.
- **2026-09-21** — Gate 0 CLOSED. tokim25 confirmed §2 (loosened the 9-12 age band to
  match 13+) and §7 (same-day PM triage, no dedicated editorial staff) as the actual
  content-safety and ownership decisions. Tech Lead confirmed engineering feasibility
  with two corrections: `reviewStatus` renamed to `contentStatus` to match the TRD's real
  schema, and the initial certified-subset count corrected from a double-subtracted 972
  to the verified 989 titles. `policyVersion: 1` is frozen. Phase 1 (certified catalog
  foundation) is unblocked and moved into the roadmap's "Now" section.
- **2026-09-21** — Phase 1 (certified catalog foundation) implemented, opened as a PR
  (not merged direct-to-master, per its own scope). Normalized `recommendedAge` (new
  `scripts/catalog-schema.mjs`, mirrored into `index.html`) resolved 17 of the PRD's 18
  non-normalizable ages via a `ca`-then-`la` fallback, plus one genuine data-bug fix
  (`Scoob!`, num 1036, missing `+` suffix on `la`/`ca`) for the 18th. Implemented Gate 0
  §3's 5-state `contentStatus` machine and the `runtimeMinutes`/`runtimeSourceId`/
  `runtimeVerifiedAt` schema fields as computed-not-stored functions (documented reasoning
  in-file) rather than the TRD's illustrative stored-field shape, wired into
  `scripts/validate-data.mjs` as the de facto required gate (flagged honestly in the PR:
  this repo has no GitHub Actions CI, so "CI-enforced" means `validate-data.mjs`'s
  existing exit-1 gate, not a literal required status check — corrected the same day the
  PR opened once `.github/workflows/playwright.yml` turned out to exist after all). Re-
  verified Gate 0 §6's subset against live data: 990 titles today (not the recorded 989 —
  expected drift from the Scoob! fix, not a bug). **Blocked and flagged back to PM per
  Gate 0 §7's own instruction:** `runtimeMinutes` backfill for the ~990-title candidate
  pool could not be done in this session — CSM/Wikipedia/IMDb are all `EGRESS_BLOCKED`
  here — so nothing can move from `provisional` to `certified` yet. No candidate titles
  are marked `certified` in this PR as a result; all currently-eligible titles resolve to
  `provisional`.
- **2026-09-21** — Weekly triage batch (34 titles + 1 discovery title) fell back to being
  routed directly to Coder — the "Movie watchlist weekly update" session never picked up
  the original handoff (sat in PENDING with zero progress for 9+ hours, confirmed via
  `get_session`, not just a stale-looking status this time). Coder opened PR #128
  (24 titles survived dedupe; poster art skipped, same egress block as Phase 1).
- **2026-09-22** — Phase 1: Coder opened PR #127 (schema/validator, CI green), and escalated
  a real blocker per Gate 0 §7 (network egress blocks direct Wikipedia/IMDb fetches, so
  `runtimeMinutes` backfill couldn't proceed — 0 titles certified as a result, everything
  eligible sitting at `provisional`). Resolved same day: PM re-tested the blocker directly
  and confirmed WebSearch snippet extraction works around it (same fallback already used
  for CSM content research, just hadn't been applied to runtime specifically) — not a
  `policyVersion` 2 question after all. Runtime backfill unblocked as its own batched
  follow-up (~40-50 titles/PR against the certified-candidate pool), decoupled from #127's
  merge, which stands on its own technical merits.
- **2026-09-22** — PR #127 merged (Reviewer independently re-verified nearly every claim in
  the PR description rather than trusting it — mutation-tested the state machine,
  JSON-diffed the data change, re-ran the audit script on both branches; one non-blocking
  finding on `hasVerifiedRuntime()`, fixed same day). PR #128 merged too. Full issue sweep
  found 11 new issues since the last one (41 open, up from 30): closed
  [#95](https://github.com/tokim25/movie-app-repo/issues/95) as fixed by PR #127 (same
  Scoob! `ca` bug, found independently); commented on
  [#91](https://github.com/tokim25/movie-app-repo/issues/91) (the GitHub-side twin of this
  roadmap) linking the two and noting current progress; added
  [#92](https://github.com/tokim25/movie-app-repo/issues/92)/[#93](https://github.com/tokim25/movie-app-repo/issues/93)
  to Now as P0 correctness bugs with a ready answer from frozen Gate 0 policy, no new design
  needed; corrected a mislabeling of #97/#103/#104/#105/#108 as P2 when they're actually P1.
- **2026-09-22** — Noted for the record: this exact section had a real merge conflict —
  Coder's own PR-merge commits updated this change log directly on `master` with an
  overlapping account of the same PR #127/#128 events, written independently of PM's. Both
  were accurate, just describing the same events from different vantage points; merged
  rather than picking one side. Worth remembering `roadmap.md` isn't PM-exclusive-write in
  practice even though PM owns its content — anyone landing a PR that finishes work this
  file tracks may touch it too, so re-fetch before editing this file the same as any other
  shared file, not just the data-*.js files SKILL.md's hard rule names explicitly.
- **2026-09-22** — tokim25 elevated the runtime backfill to top priority; dispatched to
  Coder immediately. PR #129 (47-title WebSearch-snippet batch) landed shortly after, but
  was itself superseded same day by PR #130 — a separate agent's bulk IMDb-dataset
  reference (`data-runtimes.json`, 1,070/1,071 titles matched, documented confidence).
  Dispatched Coder to verify and use #130 to finish the entire remaining backfill in bulk,
  superseding #129's weaker-provenance data rather than merging it. Also dispatched P0s
  #92 + #93 (Tonight eligibility bugs) as the next priority after the backfill, per
  tokim25's confirmation — both have exact answers from frozen Gate 0/PRD policy now, no
  new design work needed.
- **2026-09-22** — PM's PR #130 decision (above) was wrong on two counts, both caught by
  Tech Lead within the hour: (1) 46% of #130's matches were ambiguous, silently resolved
  with no verification trail — the "spot-check a sample" bar PM set wouldn't have caught
  this; (2) PM cleared the IMDb dataset's licensing note unilaterally instead of escalating
  a real external-compliance question for a live public deployment. Corrected: #129/#131
  reinstated as primary (never should have been marked superseded), #130 downgraded to a
  QA-gated accelerator (`candidateCount:1` + `confidence:"high"` only), licensing question
  put to tokim25 directly and confirmed fine. PR #130 merged. Logged in full rather than
  quietly overwritten, since the roadmap should reflect real decisions including reversed
  ones, not just a clean final state.
- **2026-09-22** — Reviewer cross-checked #129/#131's WebSearch-derived runtimes against
  `data-runtimes.json` directly and found real disagreements, not rounding noise, on 5
  titles (Over the Moon 95 vs. 100 min, March of the Penguins 2 76 vs. 82, The Secret of
  Kells 75 vs. 79, plus two smaller deltas). Directed: merge #129/#131 as planned, but hold
  those 5 specific titles at `provisional` (no `runtimeSourceId` stamped either way) until
  a bounded verification pass resolves which number is right — could be a real error in
  either source, or a legitimate cut-length difference (theatrical vs. extended, US vs.
  international). Everything else in both PRs proceeds unaffected.
- **2026-09-22 — PR #132 blocked; the `candidateCount:1`/`confidence:"high"` QA bar itself
  was wrong, not just unenforced.** Tech Lead verified #132 (Coder's consolidated
  certification pass) against the real data: the agreed gate wasn't implemented (all 990
  matched titles got certified uniformly, no filtering) — but the more important finding
  is that 3 of the 4 titles Reviewer had already flagged as discrepant sit *inside* that
  exact "safe" bucket. `candidateCount`/`confidence` measure whether the right film was
  matched, not whether the recorded runtime number is accurate for that film — two
  different questions #130's data only answers the first of. **Policy revised again:** no
  title certifies from `data-runtimes.json` alone regardless of match-quality signals; it's
  now a research accelerant for the WebSearch pipeline (a starting hypothesis to confirm,
  same as #129/#131's proven method), never a certification shortcut on its own.
  This is Tech Lead's third real catch in one session (ambiguous-match rate, licensing
  escalation, now this) — worth noting as a pattern, not three unrelated incidents: PM's
  runtime-backfill calls this session have consistently underestimated verification needs
  on the first pass and needed Tech Lead's independent data-checking to catch it each time.
- **2026-09-22** — PR #132 confirmed closed and fully reverted by Coder (all 990 titles
  back to `provisional`, matching the pre-#130-integration baseline exactly) — closed with
  an honest comment explaining the back-and-forth rather than a silent close. #129/#131
  reopened, re-subscribed, pending the exact discrepant-title list from Reviewer (the
  roadmap's own "5 titles" text and Reviewer's actual PR comments named slightly different
  sets, 5 vs. 6 — Coder is getting the precise list before merging rather than guessing,
  exactly the caution this whole thread has been about).
- **2026-09-22** — PR #129 merged (47 titles certified, first real `certified` records in
  the catalog) after Reviewer's own verification pass restored 2 holds and fixed 1 real
  error the disputed-title cross-check had found. Coder now on a second runtime-backfill
  batch. tokim25 told the team to keep going across the board; queued the next P0 behind
  Coder's current work: **#96** (Tonight can show green on heuristic-only content with no
  real researched flags) — connects directly to the `contentStatus` work from #127, likely
  combinable with #92/#93 into one PR since all three touch the same eligibility path.
- **2026-09-22** — Sequencing clarified: #92/#93/#96 start as soon as #131 merges, not
  after the full ~929-title remaining runtime-backfill pool (Coder asked rather than
  guessed, since #132's collapse removed the "finish it all in one PR" path that made
  "queued behind runtime backfill" ambiguous). No technical dependency ties the P0s to
  backfill completion — they're live bugs in current production eligibility logic,
  unrelated to runtime data specifically — so holding them behind a long data-coverage
  tail was the wrong tradeoff. Backfill resumes after, or interleaves, Coder's call on
  mechanics.
- **2026-09-22** — PR #131 merged (nums 50-61 certified). Queued the last two "Now" P0s,
  **#98 + #99**, behind #92/#93/#96 — both privacy-disclosure mismatches (undisclosed
  Sentry telemetry; privacy.html/terms.html omitting the child data `serializeState()`
  actually persists/syncs). Combined since they're the same fix class and both need a
  regression test against future disclosure drift. Unlike #92/#93/#96, doesn't touch
  Tonight's code at all, so Coder can run it parallel to the eligibility work if that's
  more natural. This closes out the entire "Now" P0 table — every item in it is now
  either merged or dispatched.
- **2026-09-22** — PR #133 merged (nums 63-107 certified, 43 more titles). Dispatched the
  two "Next" P1 batches: **data-integrity #116+#118+#124+#125** (independent subsystem,
  runs parallel to everything else) and **Tonight correctness #94+#97+#103+#104+#105+#108**
  (queued behind #92/#93/#96 specifically since they share the same functions — avoids two
  branches fighting over `findTonightCandidate()`/`movieVerdictForKids()`/
  `showTonightPick()`). Every issue in this doc's "Now" and both flagged "Next" P1 clusters
  is now either merged or dispatched to Coder.
- **2026-09-22** — #92/#93/#96 implemented together as planned (all three touch
  `isTonightEligible()`/`findTonightCandidate()`). **#92:** replaced the oldest-child-plus-2
  age tolerance with a strict per-child gate (`meetsAgePolicyForAllKids()`) — every selected
  child's age must independently meet a title's `recommendedAge`, matching Gate 0 §1 exactly;
  the policy's opt-in +1-year "Allow slightly older content" toggle isn't implemented yet (no
  UI for it), so today's gate is zero-tolerance. **#93:** `findTonightCandidate()`'s terminal
  fallback no longer returns `MOVIES[0]` unconditionally — it returns a typed
  `{ idx: null, source: null, noMatch: true }` result, rendered by a new dedicated
  `#tonightNoMatchCard` state ("No confident match for these settings.") with three recovery
  actions (change who's watching, review content settings, browse Shelf manually) instead of
  ever showing an unvalidated pick. **#96:** `isTonightEligible()` now calls
  `hasConfirmedContentData()` for any child-inclusive session — a title with no researched
  `flags` (the 36-title gap the issue describes) can never satisfy an automatic
  recommendation, in either the strict or relaxed pass, so a heuristic guess can't produce a
  green verdict; such titles stay reachable in Shelf. Six existing `tonight-picks.spec.js`
  tests needed fixture updates (ages/`ca` values that only passed before because of #92's
  bug — a direct sign the fix landed correctly); 12 new tests cover all three issues'
  acceptance criteria directly. Full suite green aside from the documented sandbox-network
  flake.
- **2026-09-22** — PR #134 merged. Coder started #98/#99 in parallel since neither touches
  Tonight's code. **#98:** `privacy.html` now names Sentry explicitly under "Third-party
  services," distinguishing always-on automatic error/crash monitoring (error message, stack
  trace, console/fetch/history breadcrumbs, basic HTTP context — DOM click/input breadcrumbs
  and IP/cookie-based user profiles explicitly excluded) from opt-in user feedback (free-text
  only, no name/email/screenshot), documents the existing child-name redaction safeguard, and
  points to Sentry's own privacy policy for retention rather than inventing a number. The old
  "never sent to us, sold, or shared with anyone" and "no third-party disclosure" claims are
  gone. **#99:** `privacy.html`/`terms.html` now enumerate the full `serializeState()`
  payload (children's names/ages/content-limit settings, override/watch-anyway history,
  timestamps, device IDs) instead of just watched marks/stars/order, and call out explicitly
  that both Google sync and manual sync codes carry the same full payload, not just the
  watchlist. The Google-sync opt-in row in `index.html` itself now names child data before
  the sign-in button, not only in the linked policy. Added `tests/privacy-disclosure.spec.js`:
  one test fails if `index.html` ever loads a new external script host not named in
  `privacy.html` (catches #98-shaped drift), one snapshots `serializeState()`'s actual field
  shape (top-level, order, children, a child record, a mark record, a Watch-anyway event)
  generated through real app code paths and fails on any future field addition/removal
  (catches #99-shaped drift), one checks both documents mention the sensitive categories in
  plain language. Full suite green aside from the documented sandbox-network flake.
- **2026-09-22** — PR #135 merged. Coder had started the independent data-integrity P1
  batch (#116+#118+#124+#125) in parallel per PM's note that it doesn't touch Tonight code,
  opened as PR #136. **#124:** `readGoogleSyncMeta()`'s `enabled` read used to happen
  before its own try block, so a `SecurityError` from a storage-denying privacy context went
  uncaught and aborted `decideInitialScreen()`/app startup; the read now lives entirely
  inside the guard. **#125:** `persistLocalState()` now returns whether the write actually
  succeeded instead of swallowing the failure, and `saveState()` shows a new persistent
  `#localStorageAlert` banner ("Changes aren't saving on this device") whenever it doesn't,
  clearing it on the next successful save. **#116:** added a `storage` event listener that
  merges another tab's newer write into in-memory state via the same deterministic
  `mergeState()`/`newestMark()` logic Google Drive sync already used, instead of one tab's
  next save silently overwriting another tab's newer marks/priority/content-limit changes
  with a stale full snapshot; also hardened `mergeState()`'s event list to de-duplicate by
  id. **#118:** `sw.js`'s navigation handler no longer treats every same-origin navigation
  as the app route — `privacy.html`/`terms.html` are cached and recovered under their own
  URL instead of clobbering/being clobbered-by the `/index.html` shell entry, and only a
  successful (`response.ok`) response is ever cached. `CACHE_VERSION` bumped by hand
  (v21→v22). **Reviewer caught two real bugs on first pass, both fixed same day:** the
  `storage` listener wrote unconditionally on every incoming event even when the merge was
  a true no-op — since `serializeState()` stamps a fresh top-level `updatedAt` on every
  call, every such write still differed in bytes, which re-triggered the listener in every
  other open tab, which wrote again, forever (confirmed empirically: ~30 writes/sec with no
  sign of slowing from a single edit). Fixed with a `deepEqual()` check that skips the
  write when nothing meaningful changed. Separately, the #124 fix's first version put the
  flag read and the meta-JSON read in one try block, so a corrupted meta value discarded an
  already-successfully-read, genuinely-true flag too — a real (if narrow) regression from
  pre-fix graceful degradation. Fixed by guarding the two reads independently. Two new
  regression tests added: one watches write counts across two tabs over a real time window
  (none of the original 4 `#116` tests would have caught the ping-pong, since they all
  check eventual data-correctness rather than write volume), one reproduces the exact
  corrupted-meta-with-valid-flag scenario. PR #136 pending re-review.
