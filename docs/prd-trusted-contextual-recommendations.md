# Product Requirements: Trusted Contextual Recommendations

**Status:** Proposed  
**Date:** 2026-09-21  
**Product area:** Tonight / Family guidance  
**Related:** #89 (runtime data and duration filtering)

## Executive summary

Family Feature should automatically recommend only movies that satisfy every selected viewer's declared limits and the session constraints the product claims to honor. Suitability must be determined before ranking; ranking may choose only from the eligible set.

The earlier estimates that rules-based recommendations were 70–80% ready and age/content matching was 60–70% ready were heuristic readiness assessments, not measured accuracy. Current accuracy is unknown because the product has no adjudicated reference set or recommendation-outcome dataset.

This initiative therefore does not promise that every family will enjoy every recommendation or that content suitability is universally objective. It establishes three separate quality standards:

1. **Deterministic integrity:** explicit family and session constraints are enforced on every automatic recommendation.
2. **Catalog certification:** only titles with complete, current, reviewed guidance can be automatically recommended to children.
3. **Observed quality:** contextual relevance and household satisfaction are measured against a frozen baseline rather than assumed.

The fastest credible path toward 100% rule execution within a useful certified subset is a fail-closed eligibility firewall, a certified catalog lane, and an honest no-match state—not a more complicated ranking algorithm. Catalog breadth and household outcomes remain separate release measures so a tiny certified pool cannot create a misleading success claim.

## Current state

The repository currently contains 1,047 titles.

- 1,047 have title, year, age guidance, descriptive guidance, source URL, genre, and studio.
- 1,011 (96.6%) have structured ratings for violence/scariness, language, romance, and drinking.
- 36 use age/keyword inference rather than verified structured flags.
- No title has a runtime field.
- Eighteen titles have age values that are not cleanly parseable as normalized numeric ages.
- The current audit script identifies 21 titles for manual re-research.

Known behavioral gaps:

- The group age gate uses the oldest selected child's age plus two years rather than requiring every child to pass independently.
- The recommendation engine prefers green results but can relax to amber/red when none is available.
- If no candidate is found, the engine can return the first catalog title.
- The time selector does not affect eligibility or ranking, while the explanation says the result fits the selected window.
- Mood is inferred from genre and prose keywords rather than reviewed experience attributes.
- Missing or inferred content data can still be presented as a green recommendation.

These behaviors make the product useful as a lightweight picker, but they do not support a high-confidence family-fit promise.

## Product thesis

> Family Feature helps a household choose from a small set of movies that demonstrably fit the viewers, time, and limits selected for tonight. When evidence is incomplete or no title fits, the product says so rather than weakening a boundary.

## User problems

Parents currently cannot be certain that:

- every selected child was considered;
- a saved limit was treated as a true boundary;
- an automatic pick has complete content guidance;
- the selected time window was actually enforced;
- a green result represents reviewed data rather than inference; or
- the system will abstain when no suitable result exists.

This creates a trust problem in the app's core feature. A single confident but invalid recommendation is more damaging than a transparent no-match result.

## Jobs to be done

- As a parent, when I select the children watching, every automatic recommendation respects every selected child's hard limits.
- As a parent, when I choose a time cap, every automatic recommendation fits within it.
- As a parent, when guidance is incomplete or stale, I see uncertainty instead of a false green result.
- As a parent, when no verified title fits, I can change one input or browse manually without the app silently relaxing my limits.
- As a parent, I can understand why a title fits without learning a complicated rating system.

## Goals

1. Make automatic eligibility deterministic, fail-closed, explainable, and independently testable.
2. Make every title in a child-inclusive automatic recommendation pool fully certified; require the separate base-validity contract for adult-only pools.
3. Enforce viewer and runtime context as real constraints.
4. Improve mood relevance using reviewed, controlled experience attributes.
5. Preserve a simple Who / Time / Mood interaction with progressive disclosure.
6. Establish ongoing catalog ownership, review, and quality operations.
7. Measure household outcomes against the existing rules-based baseline.

## Non-goals

- Guaranteeing that every household will enjoy every recommendation.
- Describing any movie as universally safe or appropriate.
- Learned taste personalization in this initiative.
- Cross-household profiling or collaborative filtering.
- Replacing parental judgment.
- Streaming-provider filtering until a source, region model, and freshness SLA are approved.
- Exposing every internal content dimension as a parent-facing control.

## Quality definitions and targets

### 1. Deterministic constraint adherence

Target: **100%** of child-inclusive automatic picks satisfy every selected viewer's hard limits and the selected hard time cap; adult-only picks satisfy the base-validity and applicable session-constraint contract.

- No child-inclusive automatic amber, red, unknown, provisional, conflicted, or stale picks.
- No silent relaxation when the candidate set is empty.
- A user-initiated override is a separate, disclosed action and cannot modify saved limits.
- The same inputs, catalog version, and policy version produce the same eligibility result.

This is the quality dimension the product can legitimately guarantee.

### 2. Catalog certification

Target: **100%** of titles admitted to a child-inclusive automatic recommendation pool have:

- normalized numeric age guidance;
- verified runtime;
- a complete required content profile;
- source provenance;
- review status and review date;
- current taxonomy/model version; and
- no unresolved critical audit conflict.

Uncertified titles may remain browseable with “Guidance incomplete,” but cannot receive an automatic “Within your limits” result.

For child-inclusive sessions, certification is mandatory. For adult-only sessions, titles require valid base catalog data and verified runtime when a time cap is selected, but child-suitability certification is not required. Adult-only results must not use “Within your limits,” green, or child-fit language.

Target for adult-only automatic pools: **100%** of titles pass the versioned base-validity schema and every enforced session field is present and verified.

General release also requires a useful pool: at least 90% of the current catalog certified, representation across every supported age band and mood, at least 20 eligible titles in each common reference scenario, and a no-match rate below 10% across the approved scenario suite. Limited releases may use a smaller, clearly labeled “Verified for Family Fit” subset.

### 3. Human-label quality

Proposed targets, subject to validation by the content-review program:

- At least 99% agreement at the green-versus-caution/blocked boundary in an adjudicated reference set.
- At least 95% exact field-level agreement across required attributes.
- No known critical false-negative in the high-risk reference set.
- Weighted inter-rater reliability target of at least 0.80 for ordinal content dimensions.

These are measured targets, not universal guarantees. Results must be reported by age band, content category, and source—not only as one aggregate.

The first release benchmark must contain at least 600 independently adjudicated title-dimension boundary decisions, including at least 100 high-risk decisions and at least 50 decisions in every reported critical slice. The green-versus-caution/blocked point estimate must be at least 99% with a 95% confidence lower bound of at least 98%; exact field agreement must be at least 95% with a lower bound of at least 93%. Weighted kappa must be at least 0.80 with a 95% confidence lower bound of at least 0.70. Zero critical false negatives are permitted. Sample expansion continues when these bounds are not achieved.

### 4. Contextual relevance

Proposed target: in a blinded editorial benchmark of at least 200 stratified session scenarios, at least two of three presented options fit the selected mood in at least 90% of cases, with a 95% confidence lower bound of at least 85%. Each supported mood must have at least 40 scenarios.

This benchmark must beat the current algorithm before improved mood curation is claimed.

### 5. Household outcome quality

Outcome targets are not safety guarantees:

- At least 85% “Good pick” among responding completed sessions.
- Median time to selection under two minutes.
- No regression in abandonment relative to the frozen baseline.
- No subgroup regression hidden by aggregate performance.

Behavioral analytics require a separate privacy and consent decision.

## Product requirements

### P0 — Eligibility firewall

1. Suitability and ranking must be separate stages.
2. Every selected child must be evaluated independently.
3. The group result must use the strictest applicable outcome; adding a younger or more restricted child can never increase the eligible set.
4. Remove the implicit two-year age tolerance. If flexibility is retained, it must be an explicit parent-controlled policy with a visible effect.
5. Parent-set hard limits may never be loosened by ranking, scarcity, feedback, or an override on another title.
6. Missing, inferred, stale, conflicted, or version-mismatched required guidance makes a title ineligible for automatic child-inclusive recommendations.
7. Runtime above the selected cap makes a title ineligible.
8. Adult-only mode intentionally bypasses child rules but continues to enforce applicable session constraints.
9. The eligibility result must include structured reason codes and the evidence used.

### Gate 0 — Normative policy contract

Engineering must not implement the production evaluator until Product, Content Safety, Engineering, and Privacy approve a versioned policy decision record defining:

- strict versus advisory recommended-age behavior;
- the complete mandatory certification taxonomy and thresholds;
- which parent settings are hard exclusions versus warnings;
- critical triggers that always block automatic child-inclusive recommendations;
- adult-only certification and explanation behavior;
- runtime cap and content-cut semantics;
- certification freshness and expiry rules; and
- override scope, duration, and audit behavior.

The evaluator consumes this immutable policy object. These decisions must not remain implicit constants distributed through UI code.

### P0 — No-confident-match state

When no certified green title fits, the product must show:

> No confident match for these settings.

It may offer:

- increase the time cap;
- change who is watching;
- review one named setting responsible for the empty result; or
- browse the Shelf manually.

The app must never automatically clear skips, weaken family limits, recommend an uncertified title, or fall back to the first catalog item.

### P0 — Catalog certification

1. Add canonical runtime minutes with source and verification date.
2. Normalize recommended age into a numeric field separate from display copy.
3. Require complete structured content data for the certified pool.
4. Add `certified`, `provisional`, `conflicted`, `stale`, and `unknown` review states.
5. Preserve evidence and provenance instead of overwriting disagreement.
6. Quarantine new or materially changed titles from child recommendations until certification completes.
7. Re-review the 36 heuristic-only titles and 21 current audit candidates.
8. Make certification validation a required CI gate.

### P0 — Honest language

- Replace unqualified “Green Light” with “Within your limits” or equivalent.
- Supporting copy should read: “Fits the settings you chose, based on reviewed guidance.”
- Do not use “safe,” “perfect match,” or universal appropriateness claims.
- Do not claim a runtime fit until runtime has been verified and enforced.
- Browsable uncertified titles must be labeled “Guidance incomplete,” not green.

### P1 — Content model evolution

The internal model should distinguish constructs that are currently combined or absent. At minimum, the roadmap must evaluate:

- action violence;
- fear/scariness and jump scares;
- language;
- sex/nudity versus romance;
- alcohol, tobacco, and drugs;
- grief/death and separation;
- abuse and bullying;
- discrimination/hate;
- self-harm/suicide;
- animal harm;
- medical trauma; and
- sensory intensity/photosensitivity.

The UI should not expose a dozen default controls. Parents should receive conservative age-based defaults, a small number of understandable “Things to avoid” presets, and optional deeper controls.

Accessibility metadata—captions, SDH, audio description, languages, and sensory warnings—must remain conceptually separate from content suitability and must be scoped by provider/version when necessary.

### P1 — Contextual ranking

1. Rank only the certified eligible set for child-inclusive sessions. Adult-only ranking uses the base-valid eligible set and must not emit child-fit labels.
2. Change “About 90 minutes” to a precise cap such as “Up to 90 minutes” if that is the enforced behavior.
3. Replace request-time prose inference with controlled, reviewed experience attributes for tone, pace, emotional intensity, and familiarity.
4. Treat Want to Watch, watched/favorite state, recency, and mood as ranking inputs—not eligibility exceptions.
5. Return a varied set of three to six choices when supply allows.
6. Avoid near-duplicate franchise, studio, genre, and tone results unless the pool is constrained.
7. Maintain deterministic ordering for identical inputs, versions, and `refreshSeed`. An explicit refresh increments and traces that seed; stable `movieId` is the final tie breaker.

### P1 — Explanations and overrides

- Every explanation must be generated from enforced, verified fields.
- Default explanations may reference selected viewers, actual runtime, reviewed mood attributes, and Want to Watch status.
- A parent may inspect the relevant evidence and review date.
- “Watch anyway” requires explicit disclosure of the affected child and category.
- An override applies only to that title/session unless the parent intentionally edits the saved setting.
- Child actions and behavioral feedback can never weaken content limits.

### P1 — Feedback and measurement

- “Wrong mood” and “Not tonight” remain session-scoped.
- Durable feedback must be explicit and attributable to the viewing group.
- Feedback may improve ranking but cannot redefine suitability truth or loosen a hard boundary.
- Cross-household analytics require explicit consent, minimized data, retention/deletion controls, and updated privacy disclosures.

## UX requirements

- Preserve the existing Who / Time / Mood structure.
- No new mandatory onboarding is required for this initiative.
- Default recommendations present a small set, not an infinite feed.
- Uncertainty and no-match language must be calm, direct, and actionable.
- No-match recovery should require at most one decision and preserve previous choices.
- All status, explanation, and override controls must satisfy the existing keyboard and screen-reader quality bar.
- Users must be able to review or reset relevant settings without navigating through an abstract “Personalization” administration area.

## Release gates

### Gate 1 — Data

- 100% of the child-inclusive candidate pool passes the certification schema; 100% of the adult-only pool passes the base-validity schema.
- Runtime and required content-field coverage are 100% for the applicable pool contract.
- Every required attribute has allowed values, provenance, review date, and current taxonomy version.
- All 36 heuristic-only titles are either certified or excluded.
- All current high-severity audit candidates are adjudicated.

### Gate 2 — Logic

- Every child-inclusive automatic pick is certified, green for every selected child, within the time cap, and not excluded by session state.
- Every adult-only automatic pick is base-valid, within the selected time cap when capped, excluded when skipped, and rendered without child-fit language.
- Exhaustive boundary, mixed-age, unknown-data, empty-pool, and adult-only tests pass.
- Property tests prove monotonicity: stricter inputs never increase eligibility.
- There is no relaxed fallback.

### Gate 3 — Human audit

- The versioned reference set is independently double-reviewed and disagreements are adjudicated.
- Human-label targets are met with reported confidence intervals and slices.
- Known limitations are documented.

### Gate 4 — Mood benchmark

- The new experience model meets the editorial benchmark and improves upon the frozen baseline.
- Otherwise, ship the eligibility improvements without claiming better mood curation.

### Gate 5 — Parent comprehension

- Moderated research with at least 12 parents across supported child age bands demonstrates that parents understand fit, uncertainty, overrides, and no-match behavior.
- At least 11 of 12 complete the core task without assistance; expand the sample if the result is borderline or meaningfully differs by age band.
- No participant interprets the fit label as a universal safety guarantee. Any such interpretation blocks the copy from release and requires another research round.

### Gate 6 — Operations

- CI validation, review ownership, freshness reporting, rollback, and incident runbooks are live.
- Privacy disclosures accurately describe local and Google Drive data.

## Rollout plan

### Phase 0 — Trust corrections and policy decisions

- Remove the unsupported duration-fit claim until #89 is resolved.
- Correct privacy disclosures.
- Complete Gate 0 and publish the versioned policy contract.

Phase 0 does not claim that existing structured flags constitute certification. Public cutover to fail-closed child-inclusive recommendations occurs only when Phase 1 has produced a useful certified subset.

### Phase 1 — Certified catalog foundation

- Approve the age policy, hard/advisory semantics, taxonomy, provenance, and freshness rules.
- Implement the versioned catalog schema and validator.
- Normalize age data and add runtime.
- Certify an initial “Verified for Family Fit” subset rather than waiting for all 1,047 titles.
- Expand coverage under a funded editorial SLA.

Phase 1 is blocked by Gates 1 and 3 for any title promoted into the certified subset.

### Phase 2 — Eligibility engine

- Introduce the pure eligibility firewall.
- Eliminate automatic amber/red and first-title fallbacks.
- Add the no-confident-match state.
- Run old and new outputs side by side in automated and manual evaluation.
- Resolve all disagreements involving mixed ages, unknown data, or current amber/red fallbacks.

Phase 2 is blocked by Gate 2 and may not become the public default until the scenario-coverage/no-match guardrails are met.

### Phase 3 — Contextual ranking

- Add reviewed experience attributes and set-level diversity.
- Benchmark mood fit against the frozen baseline.
- Ship only after eligibility and explanation invariants remain intact.

Phase 3 is blocked by Gate 4. Failure to meet the mood benchmark does not block the certified eligibility engine; it blocks only the improved mood claim.

### Phase 4 — Measurement and feedback

- Add privacy-reviewed, versioned outcome feedback.
- Measure selection time, good-pick rate, no-match rate, and suitability incidents.
- Consider learned personalization only after the contextual baseline is demonstrably reliable.

Phase 4 is blocked by Gates 5 and 6 plus a separate analytics/privacy decision if data will leave the device.

## Ownership and dependencies

| Dependency | Accountable role | Decision/SLA | Fallback |
|---|---|---|---|
| Gate 0 policy contract | Product lead | Before evaluator implementation | Existing browser remains available; no new fit claim |
| Content taxonomy and rubric | Content-safety lead | Approved before certification begins; quarterly calibration | Quarantine affected titles |
| Runtime source, licensing, and cut policy | Catalog owner + privacy/legal reviewer | Approved before runtime backfill | Hide time constraint and time-fit copy |
| Catalog review capacity | Catalog operations owner | Critical report triage in 24–48h; other corrections within 30 days | Suppress title from new recommendations |
| Validator, evaluator, and required CI | Engineering lead | Before certified-subset release | Block merge/release |
| Golden set and benchmark statistics | QA/measurement lead | Before public default | Remain in dogfood |
| Privacy disclosure and consent | Privacy owner | Before expanded sync/events | Keep data local; do not collect analytics |
| Incident response and catalog release | Product on-call + engineering on-call | Critical suppression package within 24h | Publish warning and remove title in next immutable content-hashed catalog |

Because the app is static and offline-capable, a suppression cannot reach a device that remains offline. The product must never claim instantaneous remote revocation. A corrected catalog is applied atomically the next time the client successfully updates; until then, locally cached guidance may remain visible.

## Roadmap epics

1. Eligibility Firewall and Strict Group Semantics
2. No Confident Match UX
3. Catalog Certification and Runtime (#89)
4. Content Taxonomy and Reviewer Rubric
5. Golden Dataset and Audit Program
6. Contextual Experience Attributes and Ranking
7. Explainability and Parent Overrides
8. Quality Operations, Privacy, and Measurement

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| “Near 100%” becomes a universal safety claim | Restrict guarantees to deterministic rule enforcement and certified coverage; use qualified product language. |
| Fail-closed logic produces more no-match states | Certify high-value titles first and provide one-step recovery without weakening limits. |
| Richer taxonomy overwhelms families | Keep complexity in the data model; expose presets and progressive disclosure. |
| Source disagreement creates false precision | Preserve provenance, review status, confidence, and adjudication history. |
| Editorial maintenance is underfunded | Assign a catalog owner, review SLA, audit cadence, and stop-ship authority. |
| Provider data becomes stale | Keep availability out of the core promise until a source and freshness SLA exist. |
| Feedback changes safety behavior | Architecturally prohibit ranking feedback from modifying eligibility policy. |

## Open product decisions

1. Is recommended age a strict default or an advisory warning? Recommendation: strict for automatic picks, with explicit parent flexibility.
2. Which settings are hard excludes versus “warn me” preferences?
3. Which content dimensions are mandatory for certification?
4. What counts as current guidance, and which titles require accelerated re-review?
5. What exact runtime semantics should 90 and 120 minutes use?
6. What initial title subset should receive “Verified for Family Fit” certification?
7. What ongoing staffing and ownership will fund catalog review?

## Product principle

When confidence is insufficient, abstention is a successful result. The product earns trust by honoring boundaries and explaining uncertainty—not by always producing a movie.
