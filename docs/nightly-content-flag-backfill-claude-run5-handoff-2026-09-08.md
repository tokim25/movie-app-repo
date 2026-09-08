# Nightly Content-Flag Backfill - Claude Run 5 Handoff (final 69 titles, catalog complete)

Date: 2026-09-08
Scope: research-prep-only handoff for `tokim25/movie-app-repo`
Branch: `research/backfill-audit-20260907-codex`
Author: Claude (local session with real network access, completing the last remaining segment)

## Result: the entire 938-title catalog now has research coverage

This commit adds the final 69 uncovered titles (nums 940-1010). Combined with everything already on this
branch, every entry in the catalog now has a research file backing it: 830 titles from Codex, 108 from
Claude across two commits (39 from nums 1011-1055, plus this batch of 69).

938 covered, 0 remaining. This is the last research-prep commit needed before someone can do a full
end-to-end review and import pass across the whole catalog.

The 69 entries are split across four files matching the earlier naming pattern:
`research/csm-content-flags-claude-final-group1-2026-09-08.json` through `-group4-...json`, plus
`research/final-69-titles-2026-09-08.json` documenting the selection (all remaining uncovered nums,
ascending, since this was the entire remainder rather than a subset).

None of the 69 carried a "Not on CSM" or "(approximate)" `currentCa` flag going in, though one title (North,
see below) turned out to have no real CSM review despite a normal-looking catalog age.

## Notable findings for a human reviewer

North (num 963) has no real CSM review at all. The direct URL guess 404s, and search only surfaces
unrelated CSM pages for other titles with similar names. The catalog's existing 8+ rating is not actually
CSM-backed; the entry now uses a Wikipedia fallback and is flagged for a reviewer to decide whether the
rating should change.

The Land Before Time IV, V, and VI (direct-to-video sequels, nums 946, 949, 950) also have no CSM reviews,
confirmed by checking each directly rather than assuming from the earlier films in the series having
reviews. All three fell back to Wikipedia.

Curious George (num 967) and Corpse Bride (num 971) both show a CSM label/detail conflict worth a
reviewer's attention: CSM's category label reads "Not present" for violence and language respectively, but
its own descriptive text mentions relevant content (slapstick and a kiss for Curious George; a death/decay
theme for Corpse Bride) that the label doesn't reflect. The research entries preserve CSM's literal label
but flag the mismatch in `handoffNotes`.

Blank Check (num 953) and First Kid (num 957) both have sensitive content worth flagging ahead of any
prose review: Blank Check includes a scene where an adult woman kisses an 11-year-old boy, and First Kid
has an online-stalker and near-abduction subplot. Neither is captured by the standard age rating alone.

Wicked: For Good, KPop Demon Hunters, and Swapped (from the previous batch and this one) continue a pattern
worth noting across this whole research effort: several recent family and animated titles carry meaningful
character death or grief content that a plain age rating doesn't surface. The `handoffNotes` field has been
carrying this consistently across every batch in this backfill, which is exactly what it's for.

## CSM request accounting (this run)

Rate-guard `acquire` calls: roughly 69, split across an initial pass and a resume after a session-limit
interruption partway through. All 4 groups hit it around the same point; incremental per-title writes meant
no completed research was lost, and each group resumed from its own remaining list. Never hit the nightly
cap (220) or per-minute cap (10/min) at any point; no blocks, no `signal-block` calls.

## What this does and does not mean for the catalog

This is still research-only output, same as every prior pass on this branch. Nothing here has been written
to `index.html`, any `data-*.js` file, or `scripts/validate-data.mjs`. With the candidate list now fully
researched across every title in the catalog, the next real step is a review and import pass, not more
research.

## Recommended next step

With research coverage complete, the work should shift from research to review. A human or a dedicated
review pass should go through all `research/csm-content-flags-*.json` files on this branch, both Codex's
and Claude's, and produce the actual catalog PR: applying confirmed content-flag data and resolving every
flagged discrepancy, upgrade case, and sensitive-content note collected across all five Claude handoff docs
and Codex's own handoff docs on this branch. It's also worth deciding whether the branch's outstanding
`csmRecheckedAt`/`csmRecheckVersion` tracking work, referenced in earlier handoff docs and tied to PR
#30/#31, should land before or alongside this import, since that affects how future re-research passes get
scheduled once the initial backfill is done.

## Non-goals for this pass

- No production catalog changes (`index.html`, `data-*.js`, `scripts/validate-data.mjs` untouched).
- No changes to PR #30, #31, or the rate-guard script itself.
- No scheduling decisions.
