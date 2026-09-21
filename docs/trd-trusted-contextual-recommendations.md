# Technical Requirements: Trusted Contextual Recommendations

**Status:** Proposed  
**Date:** 2026-09-21  
**Related PRD:** `docs/prd-trusted-contextual-recommendations.md`  
**Related issue:** #89

## Purpose

This document specifies the architecture, data contracts, verification strategy, migrations, and operational controls required to make Family Feature's contextual recommendations deterministic, fail-closed, explainable, and measurable.

The system may guarantee rule execution, but it must not claim universally correct subjective suitability. Technical quality is reported as three independent measures:

- deterministic eligibility integrity;
- verified catalog coverage and human-label agreement; and
- observed recommendation outcomes.

## Current architecture and gaps

Family Feature is a static client application. The catalog is assembled from JavaScript data arrays, household state is stored in `localStorage`, and optional sync writes one JSON document to the user's Google Drive `appDataFolder`.

Current persisted state includes watched marks, Want to Watch marks, custom order, child profiles/settings, and `watch_anyway` events. Viewer selection, time, mood, skipped titles, and skip reasons are session-only.

Material gaps:

- no server-side catalog database;
- no canonical runtime or provider availability fields;
- 36 titles without structured content flags;
- 18 non-normalized/non-parseable age values;
- a permissive oldest-child-plus-two age rule;
- automatic relaxed fallback to amber/red;
- final fallback to catalog index zero;
- missing guidance can still be treated as green;
- mood attributes are inferred from genre and prose keywords;
- validation permits missing flags and is not a required CI check;
- no catalog/policy/algorithm version is attached to a recommendation decision;
- event sync concatenation is not safe for a richer, multi-device event log; and
- privacy copy does not fully describe child/settings/event data already synced.

## Architecture principles

1. **Eligibility precedes ranking.** A score cannot compensate for a failed or unknown constraint.
2. **Unknown fails closed.** Missing, stale, provisional, conflicted, or incompatible evidence cannot produce a primary child-inclusive recommendation.
3. **Every selected child passes independently.** The strictest outcome governs the group.
4. **No synthetic fallback.** An empty eligible set returns an explicit empty result.
5. **Decision traces are factual.** Explanations are rendered from evaluated inputs and evidence.
6. **Versions are first-class.** Catalog, taxonomy, eligibility policy, and ranker versions identify every result.
7. **Safety and taste are isolated.** Behavioral feedback may affect ranking but never eligibility.
8. **Core operation remains local and offline-capable.** No network request is required to compute a recommendation.

## Gate 0: immutable policy contract

Before evaluator implementation, Product, Content Safety, Engineering, and Privacy must approve a versioned policy object defining recommended-age semantics, mandatory dimensions and thresholds, hard exclusions versus warnings, critical triggers, adult-only behavior, runtime cut/cap semantics, freshness/expiry, and override scope. The evaluator accepts this object as input; production logic must not depend on scattered implicit constants.

Adult-only automatic recommendations require valid base catalog fields and verified runtime when time is constrained, but do not require child-suitability certification. They must not display green, “Within your limits,” or other child-fit language. Child-inclusive automatic recommendations require full current certification.

## Target flow

```text
Load versioned catalog
  -> certify record eligibility
  -> evaluate each selected viewer and session hard constraint
  -> produce eligible set or empty result
  -> rank eligible set
  -> diversity rerank the result set
  -> render decision trace and evidence
```

## Versioned catalog contract

### Required title fields

The catalog schema must define, at minimum:

```json
{
  "movieId": 123,
  "title": "Example",
  "releaseYear": 2024,
  "recommendedAge": 7,
  "runtimeMinutes": 94,
  "genres": ["Animation", "Comedy"],
  "studio": "Example Studio",
  "guidanceSummary": "...",
  "contentStatus": "certified",
  "contentProfile": { "requiredDimensions": {} },
  "provenance": [{ "sourceId": "source-1" }],
  "reviewedAt": "2026-09-21",
  "nextReviewAt": "2027-09-21",
  "taxonomyVersion": 3,
  "catalogSchemaVersion": 2
}
```

`recommendedAge` must be numeric or explicitly `null`; display strings must be stored separately. `runtimeMinutes` must be a positive integer. Required values must never be overloaded with prose.

### Certification states

- `certified`: complete and eligible for automatic recommendations.
- `provisional`: visible in browse, ineligible for automatic child-inclusive recommendations.
- `conflicted`: sources/reviewers disagree; visible with disclosure, ineligible.
- `stale`: freshness or taxonomy version expired; ineligible.
- `unknown`: required guidance is absent; ineligible.

Only `certified` records on the current schema and taxonomy may enter a child-inclusive candidate pool.

Certification completeness must be enforced with JSON Schema using `additionalProperties: false`, numeric/date bounds, nonempty evidence and provenance, referential-integrity checks, and conditional requirements for `contentStatus: certified`. Presence of the current four `flags` alone does not constitute certification. `experienceProfile` is optional and separately receives `moodReady: true` only when all required reviewed experience attributes are present.

Adult-only pools use a separate `baseCatalogValid` predicate; they do not inherit child certification labels.

### Attribute evidence

Each safety-relevant field or profile dimension must preserve evidence sufficient to audit the decision:

```json
{
  "value": 2,
  "sourceIds": ["source-1"],
  "evidenceSummary": "Cartoon peril and brief chase",
  "confidence": "verified",
  "assessedAt": "2026-09-21",
  "assessorId": "reviewer-opaque-id",
  "rubricVersion": 3
}
```

Source records must include publisher, URL, retrieval date, applicable cut/region where relevant, and licensing/terms notes. Source disagreement must be retained and adjudicated rather than overwritten.

### Content taxonomy

The present four dimensions are insufficient for a strong family-suitability claim. Product and content specialists must approve the final rubric. The schema must support separate dimensions and/or critical triggers for:

- violence/action;
- fear/scariness and jump scares;
- language;
- romance;
- sexual content/nudity;
- alcohol;
- tobacco;
- drugs;
- grief/death;
- separation/abandonment;
- abuse;
- bullying/social cruelty;
- discrimination/hate;
- self-harm/suicide;
- animal harm;
- medical trauma; and
- sensory intensity/photosensitivity.

The richer internal model does not require an equally complex default UI.

### Experience taxonomy

Mood ranking must progressively replace free-text inference with reviewed attributes such as:

- energy;
- pace;
- humor style;
- emotional intensity;
- cozy/calm;
- silly;
- adventurous;
- suspenseful;
- familiar versus novel; and
- educational/documentary.

Experience attributes require provenance and confidence but do not determine hard suitability.

### Runtime

- Add `runtimeMinutes`, `runtimeSourceId`, and `runtimeVerifiedAt`.
- Define whether runtime refers to theatrical, streaming, extended, or regional cut.
- A time-capped session may include only titles with a verified runtime at or below the cap.
- Unknown runtime is ineligible when a hard time cap is selected.
- Until runtime coverage is complete for a candidate, the UI must not assert a time fit.

### Provider availability

Provider filtering is excluded from the initial core guarantee. If later introduced, availability must be modeled by provider, region, offer type, content version, observation time, and expiration. Stale availability is unknown, not available.

## Catalog ingestion and governance

### Merge-blocking validation

The validator must fail for recommendation-eligible records with:

- duplicate identifiers or title/year collisions;
- missing required fields;
- invalid numeric bounds;
- non-normalized age or runtime;
- incomplete required content dimensions;
- missing provenance or review metadata;
- stale taxonomy/schema versions;
- expired certification;
- unsupported status values; or
- unresolved critical audit findings.

Validation must publish a machine-readable and human-readable report containing coverage by field, status, source, and confidence.

### Review workflow

- All new/materially changed titles receive one complete review before certification.
- High-risk, level-four, critical-trigger, and source-conflict titles receive independent double review.
- A stratified 10–20% sample of remaining titles receives double review.
- Disagreement is adjudicated and the rationale retained.
- Rubric changes recertify or quarantine affected records.
- Parent-reported critical errors suppress the title from recommendations pending review.
- Critical reports target review within 24–48 hours; other confirmed errors target correction within 30 days.

### Reference dataset

Maintain a versioned adjudicated fixture containing:

- all critical and high-risk titles;
- all current audit candidates;
- boundary examples for every dimension and level;
- a stratified sample across age, studio, genre, decade, and source; and
- multi-child/context scenarios with expected outcomes.

Report field agreement, boundary agreement, critical-trigger recall, and confidence intervals by slice.

## Eligibility engine

Extract a pure deterministic evaluator:

```ts
type ConstraintOutcome = {
  code: string;
  status: "pass" | "fail" | "unknown";
  viewerId?: string;
  dimension?: string;
  observedValue?: number;
  limitValue?: number;
  evidenceIds: string[];
};

type EligibilityDecision = {
  movieId: number;
  eligible: boolean;
  certificationStatus: string;
  outcomes: ConstraintOutcome[];
  inputSnapshotHash: string;
  catalogHash: string;
  policyVersion: string;
};

type RecommendationResult =
  | { kind: "matches"; results: RankedDecision[] }
  | { kind: "no_match"; outcomes: ConstraintOutcome[]; recoveryOptions: string[] };

evaluateEligibility(movie, selectedViewers, sessionConstraints, policy)
  => EligibilityDecision
```

### Evaluation precedence

1. Explicit parent hard exclusion.
2. Viewer-specific parent limit.
3. Approved age-based starter limit.
4. Unknown when required evidence is missing.

No rank score or behavioral event may override this precedence.

### Group semantics

- Evaluate all selected children independently.
- Every child must pass every hard constraint.
- Adding a viewer or tightening a limit must never improve eligibility.
- Do not use the oldest selected child, average ages, or average tolerances.
- If recommended age is enforced, compare the title against each selected child.
- Adult-only mode is explicit and does not reuse child-safe explanation language.

### Session constraints

- Enforce selected runtime cap exactly as defined by product.
- Treat session skips as exclusions until the session is reset.
- Treat watched state according to explicit mode: excluded normally; permitted for “favorite.”
- Mood never changes eligibility.
- Availability never changes eligibility unless it becomes a supported verified hard constraint.

### Empty state

The evaluator returns an empty eligible set. It must not:

- clear skip history;
- relax hard constraints;
- admit amber/red/unknown records; or
- return catalog index zero.

The UI selects recovery actions from reason-code counts without pre-choosing an override.

## Ranking engine

Ranking receives only eligible movie IDs.

Initial observable inputs:

- Want to Watch;
- requested mood;
- watched/favorite mode;
- release recency;
- reviewed experience attributes; and
- deterministic tie breakers.

Ranking must not contain eligibility exceptions. The result builder should return three to six options when available and apply caps for repeated franchise, studio, genre, and near-identical tone. It may include one adjacent choice when supply permits and the choice remains eligible.

The same input snapshot, catalog version, policy version, algorithm version, and `refreshSeed` must produce the same ordered result. An explicit refresh increments the traced seed; stable `movieId` is the final tie breaker.

## Decision trace and explanations

Every result must include a structured trace:

```json
{
  "movieId": 123,
  "certificationStatus": "certified",
  "constraintOutcomes": [
    { "code": "content-limit", "status": "pass", "viewerId": "viewer-a", "dimension": "violence", "observedValue": 2, "limitValue": 2, "evidenceIds": ["evidence-1"] }
  ],
  "runtimeMinutes": 94,
  "matchedContext": ["silly", "up-to-120"],
  "rankingReasons": ["want-to-watch"],
  "evidenceIds": ["evidence-1"],
  "refreshSeed": 0,
  "inputSnapshotHash": "sha256:...",
  "catalogHash": "sha256:...",
  "policyVersion": "family-fit-v2",
  "algorithmVersion": "context-ranker-v2"
}
```

UI copy must be derived from this trace. An explanation cannot reference a field that was missing or not evaluated.
`inputSnapshotHash` must cover viewers, session constraints, exclusions, state inputs, and `refreshSeed` so the result can be reproduced exactly.

## Behavioral event model

Behavioral events validate product quality and may later inform ranking. They are not content-safety evidence.

Proposed envelope:

```json
{
  "eventId": "uuid",
  "eventVersion": 1,
  "sessionId": "uuid",
  "movieId": 123,
  "selectedViewerIds": ["opaque-id"],
  "context": { "timeCap": 90, "mood": "calm" },
  "action": "shown|selected|watched|good_pick|not_interested",
  "reason": "controlled-value-or-null",
  "scope": "durable",
  "catalogHash": "sha256:...",
  "policyVersion": "family-fit-v2",
  "algorithmVersion": "context-ranker-v2",
  "createdAt": 0,
  "deviceId": "opaque-device-id"
}
```

Requirements:

- Use opaque viewer IDs, never names, in events.
- “Not tonight” and “Wrong mood” remain only in memory or `sessionStorage`; they must never enter localStorage, Drive, manual exports, or the durable event envelope.
- Feedback can affect ranking only.
- Events are stored locally first and bounded by a documented retention cap.
- Drive merge must deduplicate by `eventId` and be associative, commutative, and idempotent.
- Define tombstones and deletion propagation before synced event deletion ships.
- Cross-household aggregation requires explicit consent, revised policy, retention/deletion controls, and a separate backend.

## Versioning and migration

### Catalog

Create a catalog schema version independent of the household-state schema. The build must generate one immutable `catalog.<content-hash>.json` (or equivalent module) plus a small compatibility manifest containing catalog hash, schema version, taxonomy version, and compatible policy versions. Startup validates the manifest, loaded catalog, and policy as one set and fails closed on mismatch. The service worker precaches exact immutable URLs and retains the previous known-compatible catalog/policy pair for rollback. Decision traces record the actual content hash, not only a date label.

### Household state

If richer events ship, introduce `family-feature-state-v4.json`. The new client writes only v4. During a bounded migration window it repeatedly reads and idempotently merges later v3 changes using a per-source migration watermark; it never writes v3. Once the user confirms every synced device has upgraded—or after the published compatibility window expires—v4 clients stop ingesting v3. Older v3 clients may continue writing their isolated legacy file because this static architecture cannot remotely block them; upgraded clients surface an update-required warning when legacy writes are detected. The migration must:

- preserves v1–v3 watched, priority, order, children, and override data;
- converts event storage to stable IDs;
- is idempotent and rollback-safe;
- keeps the previous two state versions readable; and
- never uploads expanded data until disclosure and consent requirements are met.

Create a pre-migration local backup. Preserve existing event IDs; when absent, derive a deterministic ID from immutable legacy fields. An older client must never write the v4 file. Track the last imported v3 `updatedAt`/device watermark and surface unresolved legacy conflicts rather than silently dropping them. Define the compatibility-window cutoff, downgrade read-only behavior, tombstone retention, and garbage collection only after every known device has observed the deletion or an explicit retention ceiling expires.

### Rollback

Catalog and policy versions must roll back as a known-compatible pair. A rollback must not destroy newer local state. Service-worker activation must replace an invalid catalog atomically rather than leaving a mixed cache.

## Verification strategy

### Unit and exhaustive tests

- Every content-level value against every corresponding limit.
- Ages 1–13 and adult-only.
- Zero, one, two, and three-plus selected children.
- Starter and parent-set policies.
- Runtime boundaries: 89/90/91 and 119/120/121.
- Missing, stale, provisional, conflicted, and wrong-version metadata.
- Watched, favorite, skipped, and fresh state.
- Current and prior supported state/catalog versions.

### Required properties

1. Adding a child cannot increase the eligible set.
2. Tightening a viewer limit cannot improve eligibility.
3. Raising a movie's content level cannot improve eligibility.
4. Unknown or stale required evidence cannot yield eligible/green.
5. Ranking cannot change eligibility.
6. A returned primary recommendation is always eligible.
7. A hard-blocked movie never returns after skips or pool exhaustion.
8. Duration-capped results never exceed the cap.
9. Input array, child, sync, and object-key order do not change results.
10. Identical inputs and versions produce identical results and explanations.

### Mutation testing

Tests must kill:

- 100% of safety-critical comparison, boolean, and fallback mutations; and
- at least 95% of mutations in the complete evaluator.

### End-to-end matrix

Cover:

- mixed youngest/oldest groups;
- newly added and remotely synced children;
- no-confident-match recovery;
- parent override disclosure;
- runtime filtering;
- explanation/evidence alignment;
- online, offline, restored, and Drive-merged state;
- stale service-worker catalog upgrade; and
- rollback to the last compatible catalog/policy pair.

## CI and release pipeline

### Pull request checks

- schema validation;
- catalog completeness/provenance/freshness report;
- unresolved-audit check;
- unit, invariant/property, and mutation safety subset;
- Playwright and accessibility suites;
- state migration and Drive merge tests; and
- service-worker catalog-hash validation.

Implementation requires extracting the eligibility and ranking logic from the inline script into pure ES modules, JSON Schema validation, a unit/property-test runner, mutation tooling, npm scripts for each required check, and required workflow jobs. The current Playwright/axe workflow is insufficient by itself.

Any content-level reduction, age relaxation, source downgrade, or certification promotion requires two-person review.

### Nightly checks

- exhaustive rule matrix;
- full mutation suite;
- randomized property tests with persisted failure seeds;
- source-link/freshness checks; and
- reference-set evaluation report.

### Release gates

- 100% deterministic rule/invariant pass.
- 100% required-field coverage for the recommendable subset.
- Zero unresolved critical audit findings.
- Zero known hard-limit violations in the reference set.
- Zero false runtime-fit claims.
- 100% explanation-to-trace consistency.
- Human-review targets met with reported uncertainty.
- Privacy and data-handling review complete.

## Rollout

1. **Immediate correction:** remove unsupported duration claims; correct privacy copy; approve Gate 0. Do not claim existing flags are certified.
2. **Certified subset:** ship schema, validator, review workflow, immutable catalog/manifest, and an initial high-value certified lane.
3. **Eligibility cutover and local fixture shadow:** remove relaxed/index-zero fallback, enable fail-closed no-match behavior against the certified subset, compute old/new results over the reference suite, and inspect every disagreement without transmitting household data.
4. **Opt-in dogfood:** expose no-match UX and decision traces; offer a local downloadable comparison report; verify offline and sync behavior.
5. **General static release:** expand only after deterministic, catalog, coverage, and no-match gates pass.
6. **Context ranking:** add reviewed experience attributes and diversity after eligibility is stable.
7. **Feedback/personalization:** introduce only after privacy-reviewed outcome measurement exists.

Cohort rollout, live monitoring, or server-controlled flags are not assumed capabilities. If required later, separately scope consent, telemetry, feature-flag infrastructure, retention, and backend work.

Stop-ship conditions:

- any hard-limit leak;
- any unknown/stale record shown as within limits;
- any runtime claim unsupported by evaluated data;
- a severe false-green in the reference set;
- mixed-age evaluation that bypasses a selected child;
- an explanation inconsistent with the decision trace;
- sync/data loss or non-idempotent event duplication; or
- privacy disclosure inconsistent with actual handling.

## Performance, offline, and security

- Eligibility plus ranking target: p95 under 100 ms for approximately 1,000 titles on a low-end supported mobile device.
- Precompute normalized catalog indexes at load.
- Preserve full offline recommendation capability.
- Sanitize imported strings and allowlist supported source/provider URLs.
- Validate Drive payload size and schema before merge.
- Retain least-privilege `drive.appdata` access.
- Redact child names from diagnostics and recommendation events.
- Bound event storage and document export/reset/deletion behavior.

## Operational scorecard

Publish three independent sections rather than a blended readiness percentage.

### Deterministic integrity

- invariant pass rate;
- hard-limit leaks;
- explanation mismatches;
- version-determinism failures.

### Catalog quality

- certified coverage;
- missing/stale/conflicted records;
- human-review agreement;
- critical-trigger recall;
- open audit queue and correction age.

### Product outcomes

- eligible-set and no-match rates;
- selection within two minutes;
- post-watch good-pick rate;
- wrong-mood rejection rate;
- recommendation-set diversity; and
- suitability reports by catalog confidence.

Product-outcome collection must remain local or explicitly consented until a separate analytics design is approved.

General release coverage guardrails: at least 90% of the current catalog certified, every supported age band and mood represented, at least 20 eligible titles in each approved common reference scenario, and less than 10% no-match across that scenario suite. These guardrails prevent a tiny perfect pool from satisfying the quality claim.

## Ownership, dependencies, and SLAs

| Dependency | Accountable role | Required decision/SLA | Fallback |
|---|---|---|---|
| Immutable policy contract | Product lead | Before evaluator implementation | No new family-fit release |
| Taxonomy/rubric and adjudication | Content-safety lead | Before certification; quarterly calibration | Quarantine affected titles |
| Runtime source, licensing, ingestion, canonical cut | Catalog owner + privacy/legal reviewer | Before runtime certification | Hide duration control/claim |
| Catalog operations | Catalog owner | Critical report triage 24–48h; other fixes 30 days | Suppress in next catalog release |
| JSON Schema, evaluator, CI, manifest/SW handshake | Engineering lead | Before certified-subset release | Block merge/release |
| Reference set/statistics | QA/measurement lead | Before public default | Remain fixture-only/dogfood |
| Data disclosure/consent | Privacy owner | Before v4 sync or analytics | Local-only, no telemetry |
| Incident release | Engineering on-call + product on-call | Corrected immutable content-hashed catalog within 24h of confirmed critical issue | Publish limitation and block affected title in next update |

An offline static client cannot receive an immediate remote suppression. The corrected immutable catalog takes effect atomically after the client reconnects and updates. Documentation and incident language must disclose this limitation rather than implying instantaneous revocation.

## Technical milestones

### P0

- Pure fail-closed eligibility evaluator.
- Strict all-child semantics.
- No relaxed or index-zero fallback.
- No-confident-match result contract and UX.
- Runtime claim removed until verified.
- Unknown guidance excluded.
- Privacy disclosure corrected.

### P1

- Catalog schema vNext and certification states.
- Normalized age and runtime.
- CI-enforced validator and audit report.
- Reference dataset and reviewer workflow.
- Decision trace and versioned explanations.
- Certified initial catalog subset.

### P2

- Reviewed experience taxonomy.
- Eligible-only deterministic ranking and diversity.
- Shadow comparison, limited rollout, rollback controls.

### P3

- Privacy-approved feedback events and idempotent sync.
- Outcome benchmarking.
- Later evaluation of learned ranking.

## Key technical decision

The system should be permitted to return no recommendation. Without that invariant, scarcity will continue to pressure the algorithm into violating the very boundaries the product is supposed to enforce.
