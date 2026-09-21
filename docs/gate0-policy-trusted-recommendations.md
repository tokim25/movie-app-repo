# Gate 0 Policy Decision Record: Trusted Contextual Recommendations

**Status:** Draft — proposed by PM, pending Engineering feasibility check (Tech Lead) and
owner sign-off (tokim25) on the two sections marked below before this becomes the
immutable policy object the evaluator consumes.
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

## 2. Hard excludes vs. "warn me" preferences — by content-flag level

The catalog's four scored dimensions (`violence`, `language`, `romance`, `drinking`,
each 1–4) map to **default hard-exclude thresholds by age band**. A flag at or above the
threshold makes a title ineligible for automatic recommendation to a child in that band,
full stop — not a warning, not an amber result.

| Age band | violence ≥ | language ≥ | drinking ≥ | romance ≥ |
|---|---|---|---|---|
| Under 5 | 2 | 2 | 2 | 2 |
| 5–8 | 3 | 2 | 3 | 3 |
| 9–12 | 4 | 3 | 4 | 4 |
| 13+ | — (no auto-exclude; recommendedAge already gates PG-13/R-equivalent content) | 4 | — | — |

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

**⚠ Needs tokim25 sign-off.** The specific numbers in that table are a parenting-judgment
call, not an engineering or process decision — I've proposed defaults that read as
reasonable to me, but this table is the actual safety promise the app makes to every
family that uses it unmodified, and it should carry deliberate approval rather than being
adopted by default. Flag any row you want changed; everything downstream (Gate 1
certification, the evaluator itself) keys off this table once frozen as v1.

## 3. Mandatory certification dimensions — ratifying the PRD as-is

A title is certified for the child-inclusive pool only with all of: normalized numeric
`recommendedAge`, verified `runtimeMinutes`, complete `flags` (all four dimensions),
`srcUrl`/provenance, `reviewStatus` + `reviewedAt`, current `taxonomyVersion`, and no
unresolved critical audit conflict. This restates the PRD's Catalog Certification section
verbatim as the Gate 0 contract — no changes proposed here, just closing the loop so it's
part of the frozen policy object rather than only prose in the PRD.

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

Phase 1 certifies, first: the **1,011 titles that already have real structured `flags`**
(96.6% of the catalog), **minus** the 21 titles the current audit script flags for manual
re-research and the 18 titles with non-normalized/non-parseable ages — i.e. certify the
clean ~972 once runtime is backfilled for them, rather than waiting on all 1,047 or
picking an arbitrary curated slice. The excluded ~75 titles get accelerated re-review
(§4) and join the certified pool as they clear it.

This is a mechanical starting rule, not a curation choice — it certifies whatever the
catalog already has real per-category research behind, which is the fastest honest path
to a usable pool per the PRD's stated preference ("a fail-closed eligibility firewall...
not a more complicated ranking algorithm").

Before Phase 1 ships as the public default, confirm this ~972-title subset actually
clears the PRD's general-release bar (≥90% of catalog certified, ≥20 eligible titles per
common reference scenario, <10% no-match rate across the approved scenario suite) — if it
doesn't, that's a Phase 1 exit-gate problem to solve before cutover, not a reason to
loosen §§1–2.

## 7. Ongoing catalog review staffing and ownership

**⚠ Needs tokim25 sign-off — this is the one decision I can't respond to Gate 0's
question honestly without input.** The PRD's ownership table (24–48h critical-report
triage, quarterly taxonomy calibration, a funded editorial SLA) describes a staffed
product org. This project doesn't have one — it has this five-agent session setup plus
you. Proposed realistic mapping, pending your confirmation:

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

If that's not the right shape — if you want an actual review cadence, or want to be
looped in on every critical report rather than trusting PM's same-day triage — say so and
I'll rewrite this section.

## Approval

| Role | Person/session | Status |
|---|---|---|
| Product | PM (this doc) | Proposed |
| Engineering | Tech Lead | Pending — feasibility review requested |
| Content Safety / Privacy | tokim25 | Pending — §2 and §7 need explicit sign-off |

Gate 0 closes, and `policyVersion: 1` freezes, once Engineering confirms nothing here is
infeasible against the current schema/TRD and tokim25 confirms §2 and §7. Everything else
in this document I'm treating as decided pending that feasibility check, not as open for
further debate — the PRD already pointed at each of these answers closely enough that
redoing them from scratch would just be process for its own sake.
