# Gate 0 Policy Decision Record: Trusted Contextual Recommendations

**Status:** Approved — `policyVersion: 1` frozen 2026-09-21. Product decisions confirmed
by tokim25; Engineering feasibility confirmed by Tech Lead with two corrections applied
below (§3 field naming, §6 arithmetic). Changing any decision below now requires a new
policy version, not an in-place edit.
**Date:** 2026-09-21
**Owner:** Movie Repo PM
**Related:** [`prd-trusted-contextual-recommendations.md`](./prd-trusted-contextual-recommendations.md),
[`trd-trusted-contextual-recommendations.md`](./trd-trusted-contextual-recommendations.md),
[`roadmap.md`](./roadmap.md)

This is the versioned policy contract the PRD's Gate 0 and the TRD's "Gate 0: immutable
policy contract" section both require before the eligibility evaluator gets built. It
answers the PRD's seven "Open product decisions" concretely rather than leaving them
open. Once approved, `policyVersion: 1` is frozen; changing any decision below requires a
new policy version, not an in-place edit.

## 1. Recommended-age semantics — **strict**

A title's normalized `recommendedAge` is a **hard exclude** for automatic child-inclusive
recommendations: ineligible for any selected child whose age is below it. No implicit
tolerance (removes the current oldest-child-plus-two rule entirely).

Parents may opt in, per child, to an explicit **"Allow slightly older content"** setting
that widens the threshold by a fixed, disclosed amount (+1 year, not +2). Default off.
When on, its effect must be visible in the eligibility explanation ("within your limits,
with your 'slightly older content' setting on for [child]") — never silent.

*Rationale:* matches the PRD's explicit instruction to remove the 2-year tolerance and
its requirement that any retained flexibility be explicit and visible.

**Confirmed by tokim25 (2026-09-21): include the +1 year opt-in toggle as proposed.**

## 2. Hard excludes vs. "warn me" preferences — by content-flag level

The catalog's four scored dimensions (`violence`, `language`, `romance`, `drinking`,
each 1–4) map to **default hard-exclude thresholds by age band**. A flag at or above the
threshold makes a title ineligible for automatic recommendation to a child in that band,
full stop — not a warning, not an amber result.

| Age band | violence ≥ | language ≥ | drinking ≥ | romance ≥ |
|---|---|---|---|---|
| Under 5 | 2 | 2 | 2 | 2 |
| 5–8 | 3 | 2 | 3 | 3 |
| 9–12 | — (no auto-exclude; recommendedAge already gates the content a 9-12-year-old is offered) | 4 | — | — |
| 13+ | — (same) | 4 | — | — |

**Revised by tokim25 (2026-09-21): "looser for older kids" — 9-12 now matches 13+.**
Under-5 and 5–8 are unchanged from the original proposal. For 9-12 and 13+, only
`language` remains a hard-exclude dimension (raised to ≥4 for the 9-12 band, matching
13+); `violence`/`drinking`/`romance` are no longer auto-excluded by flag level in either
band and rely on `recommendedAge` gating instead — closer to how a PG-13 rating already
behaves. Below the hard-exclude threshold, the "warn me" mechanism in the next paragraph
still applies for a parent who wants to set a stricter personal ceiling than this table.

Below the hard-exclude threshold, a flag becomes a **"warn me" preference**: parents can
set a per-child or per-family ceiling anywhere from 1 up to (but not exceeding) the
hard-exclude value above, and anything at or above *their* chosen ceiling is excluded the
same as a hard exclude — the table above is the outer bound the product enforces
unconditionally, not the only bound available to a parent who wants to be stricter.
Nothing in this policy allows a parent setting to be *looser* than the table.

Sad/emotional content (grief, loss, separation — called out in `SKILL.md` Step 2) has no
numeric flag in the current model and is not a hard-exclude dimension under this policy;
it stays a `full`-text disclosure only. Revisit if the content model ever adds a scored
dimension for it.


## 3. Mandatory certification dimensions — ratifying the PRD as-is

A title is certified for the child-inclusive pool only with all of: normalized numeric
`recommendedAge`, verified `runtimeMinutes`, complete `flags` (all four dimensions),
`srcUrl`/provenance, `contentStatus` + `reviewedAt`, current `taxonomyVersion`, and no
unresolved critical audit conflict. This restates the PRD's Catalog Certification section
verbatim as the Gate 0 contract — no changes proposed here, just closing the loop so it's
part of the frozen policy object rather than only prose in the PRD.

*(Corrected by Tech Lead's feasibility review, 2026-09-21: this section originally said
`reviewStatus`; the TRD's actual required-fields schema calls the field `contentStatus`.
Renamed here to match what the evaluator will really read — the PRD's prose doesn't
disambiguate the two names, so the TRD's schema is authoritative.)*

**State-machine mapping (added per Tech Lead's review).** Gate 0's own exclusion
categories map onto the TRD's five `contentStatus` states as follows, so the evaluator has
an unambiguous source rather than inferring it: a title with an open, unresolved audit
finding (§4) → `conflicted`; a title missing structured `flags` or with a
non-normalizable age (§6) → `unknown`; a title whose `csmRecheckVersion`/`csmRecheckedAt`
fail the freshness check (§4) → `stale`; a title meeting every requirement above →
`certified`; anything certified-pending-verification → `provisional`.

## 4. Freshness / accelerated re-review

A certification is **current** when `csmRecheckVersion` equals the live
`CONTENT_MODEL_VERSION` *and* `csmRecheckedAt` is within 18 months. Either condition
failing moves the title to `stale` (browsable, not auto-recommendable to children) until
re-reviewed.

**Accelerated re-review** (jumps the normal backfill queue) applies to: any title with an
open, unresolved audit finding of the kind the 2026-09-12 Romeo & Juliet case surfaced
(depicted-on-screen severity mismatched against its flag level), and any of the 21
titles the current audit script already flags for manual re-research. Those get priority
over ordinal/oldest-first backfill ordering.

## 5. Runtime cap semantics — exact, no buffer

- **"Up to 90 minutes"** (renamed from "About 90 minutes" per the PRD): `runtimeMinutes
  ≤ 90`. No grace buffer.
- **"Up to 2 hours"**: `runtimeMinutes ≤ 120`. No grace buffer.
- **"Any length"**: no cap applied.
- A title with no verified `runtimeMinutes` is ineligible whenever a cap is selected
  (both capped options), regardless of prior UI copy implying it was already enforced.

*Rationale:* the whole initiative is about not claiming fits that aren't verified; a
fuzzy buffer on "up to 90 minutes" would just reintroduce the same problem the PRD exists
to fix, in a smaller way.

## 6. Initial "Verified for Family Fit" certified subset

Phase 1 certifies, first, every title that satisfies **all three** of: (a) has real
structured `flags` (all four dimensions actually researched, not inferred), (b) is not
one of the titles the current audit script flags for manual re-research, and (c) has a
normalized, parseable age. That combined filter currently selects **989 titles**, once
runtime is backfilled for them — rather than waiting on all 1,047 or picking an arbitrary
curated slice. Titles failing any one of the three conditions get accelerated re-review
(§4) and join the certified pool as they clear it.

*(Corrected by Tech Lead's feasibility review, 2026-09-21: the original draft computed
this as a sequential subtraction, 1,011 − 21 − 18 = 972, which double-subtracts —
verified against `scripts/audit-content-flags.mjs` and the real data files, 17 of the 18
non-normalizable-age titles already lack `flags` and were never part of the 1,011 to
begin with; only 1 (`Scoob!`) is a genuine independent exclusion. The correct combined-set
count is 989, not 972. Re-run this exact check right before Phase 1 cutover, since the
underlying data changes as titles get backfilled in the meantime.)*

This is a mechanical starting rule, not a curation choice — it certifies whatever the
catalog already has real per-category research behind, which is the fastest honest path
to a usable pool per the PRD's stated preference ("a fail-closed eligibility firewall...
not a more complicated ranking algorithm").

Before Phase 1 ships as the public default, confirm this ~989-title subset actually
clears the PRD's general-release bar (≥90% of catalog certified, ≥20 eligible titles per
common reference scenario, <10% no-match rate across the approved scenario suite) — if it
doesn't, that's a Phase 1 exit-gate problem to solve before cutover, not a reason to
loosen §§1–2.

## 7. Ongoing catalog review staffing and ownership

**Confirmed by tokim25 (2026-09-21): PM handles this solo, same-day, as proposed.** The
PRD's ownership table (24–48h critical-report triage, quarterly taxonomy calibration, a
funded editorial SLA) describes a staffed product org; this project doesn't have one — it
has this five-agent session setup plus you. Realistic mapping for this project's actual
shape:

- **Critical-report triage** (a parent reports a title is mis-certified): PM picks this up
  as a same-day priority the moment it's reported (issue filed or otherwise), same as any
  other P0 — not a 24–48h SLA against a queue, since there's no queue to check against
  other than GitHub issues and this conversation.
- **Ongoing backfill/re-review cadence**: whatever cadence Tech Lead/Coder's periodic
  content-flag-backfill runs already use (per `SKILL.md`'s "Re-researching an existing
  entry" mode) — no *new* staffing, just prioritizing that existing work toward the
  Phase 1 certified subset (§6) instead of ordinal/oldest-first order.
- **Taxonomy calibration**: reactive, not quarterly — revisit the flag-level table in §2
  if a real mis-tag is found (as with Romeo & Juliet), rather than a standing calendar
  commitment nobody's staffed to keep.

If this stops being the right shape — if a critical report reveals PM's solo same-day
triage isn't catching things fast enough, or you want to be looped in on every report
rather than trusting PM's judgment — say so and this section gets revised as a new policy
version.

## Approval

| Role | Person/session | Status |
|---|---|---|
| Product | PM (this doc) | Approved |
| Engineering | Tech Lead | Approved — 2 corrections identified and applied (§3 field name, §6 arithmetic); no other schema/versioning conflicts with the TRD |
| Content Safety / Privacy | tokim25 | Approved — §2 revised (9-12 band loosened to match 13+), §1 and §7 confirmed as proposed |

**Gate 0 is closed. `policyVersion: 1` is frozen as of 2026-09-21.** Phase 1 (certified
catalog foundation) is unblocked — see `roadmap.md` for current status. Any future change
to a decision in this document requires a new policy version and re-running the approval
sequence above, not an in-place edit.
