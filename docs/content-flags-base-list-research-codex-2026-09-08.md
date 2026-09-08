# Content-Flags Base-List Research - Codex Handoff

Date: 2026-09-08
Scope: research-only coverage for `data.js` / `MOVIES_BASE`
Branch: `research/backfill-audit-20260907-codex`

Claude's import notes found that `data.js` was excluded from the previous 938-title research count. Codex researched the 99 missed `MOVIES_BASE` entries, covering nums `1-80` and `82-100`; num `81` does not exist in the base list.

Files added:

- `research/csm-content-flags-base-001-020-2026-09-08.json`
- `research/csm-content-flags-base-021-040-2026-09-08.json`
- `research/csm-content-flags-base-041-060-2026-09-08.json`
- `research/csm-content-flags-base-061-080-2026-09-08.json`
- `research/csm-content-flags-base-082-100-2026-09-08.json`

Validation:

- expected base-list entries: 99
- researched entries: 99
- duplicate nums: 0
- missing nums: 0
- extra nums: 0
- CSM-unavailable pages: 0

Notable item:

- `#42 Peter Pan (Broadway Musical)` currently uses a non-CSM catalog source, but targeted lookup found the CSM `Peter Pan (2000)` review. The research file captures that source and flags the catalog-source upgrade opportunity for import/review.

These files intentionally do not modify production catalog data. They are source-backed research inputs for the normal import/review path.
