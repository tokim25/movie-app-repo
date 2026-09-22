# Roadmap

**Owner:** Movie Repo PM
**Last updated:** 2026-09-21
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

### Trust & safety P0s (independent of the recommendations initiative)
These are live correctness/privacy defects, not roadmap-gated — they should not wait on
the Trusted Contextual Recommendations phases below, several of which they block anyway.

| Issue | Problem | Notes |
|---|---|---|
| [#96](https://github.com/tokim25/movie-app-repo/issues/96) | Tonight can label heuristic-only movies green without confirmed title-specific content data | This *is* the PRD's core P0 problem (see below) — fixing it is Phase 0/2 work, not separate |
| [#98](https://github.com/tokim25/movie-app-repo/issues/98) | Undisclosed Sentry processing contradicts "never sent" / "no third-party disclosure" claims | Privacy correction, blocks nothing else, should ship standalone |
| [#99](https://github.com/tokim25/movie-app-repo/issues/99) | Policy/Terms omit child profiles, content limits, override history, device metadata | Same — standalone privacy fix, also a PRD Phase 0 dependency |

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

### Trusted Contextual Recommendations — Phase 1 (Certified catalog foundation) — in progress
[PR #127](https://github.com/tokim25/movie-app-repo/pull/127) — schema/validator work is
done: `scripts/catalog-schema.mjs` implements normalized `recommendedAge` (resolved all
18 of the PRD's non-normalizable ages, including a genuine data bug fix on `Scoob!`) and
the `contentStatus` 5-state machine from Gate 0 §3. CI green, no reviews yet as of
2026-09-22 (following up on whether Reviewer/Tech Lead were broadcast to per SKILL.md).

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

### Data integrity / sync P1s
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

### Remaining P2s (not yet triaged into a phase)
Installability/PWA polish (#119-123), Tonight source-tier/mood precedence (#97), Tonight
content-issue count display bug (#108), watched/want-to-watch state cleanup (#117),
duplicate override signals (#104), stale skip-reason carryover (#103), stale
recommendation card on input change (#105). Will get bucketed into Now/Next as capacity
opens up or a related PR touches the same code.

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
- **2026-09-21** — Weekly triage batch (34 titles + 1 discovery title) fell back to being
  routed directly to Coder — the "Movie watchlist weekly update" session never picked up
  the original handoff (sat in PENDING with zero progress for 9+ hours, confirmed via
  `get_session`, not just a stale-looking status this time).
- **2026-09-22** — Phase 1: Coder opened PR #127 (schema/validator, CI green). Escalated a
  real blocker per Gate 0 §7 (network egress blocks direct Wikipedia/IMDb fetches, so
  `runtimeMinutes` backfill couldn't proceed — 0 titles certified as a result). Resolved
  same day: WebSearch snippet extraction works around the block (PM verified directly),
  same pattern already used for CSM content research. Not a policy change — runtime
  backfill unblocked as its own batched follow-up, decoupled from #127's merge.
