# Catalog queue screening

The screener collects evidence in windows of 100 entries by default. Follow the catalog batch guide when preparing a release, including the new-release check, the 15-title limit, and the two PRs. [Catalog batch guide](../docs/codex-catalog-batch.md)

```sh
git fetch origin master
node tools/screen-catalog-queue.mjs --limit 100 --offline
node tools/screen-catalog-queue.mjs --limit 100
```

The scanner reads the queue and catalog from the requested Git revision, starting at `origin/master` by default. `--ref` can point to a verified titles branch when screening ahead of a pending PR. The scanner leaves the catalog and queue intact. Use `--offset 100` to screen the next window against the same revision, or start from offset zero after the preceding titles and skips land.

The scanner resolves exact review URL duplicates locally. Possible title matches and uncertain review metadata go to review. Use repeatable `--held <slug>` options to keep documented holds visible without requesting their reviews again. Use `--import-cache <directory>` to reuse full review HTML saved as `<slug>.html` by an earlier scan.

The main checkout’s gitignored `.scratch-csm-cache/` holds the full reviews and per-window JSON reports. Rerun the same command with the same cache to resume. A blocked or malformed response stops the scan and preserves the completed work. The scanner uses the shared CSM rate guard and spaces requests at least 7.1 seconds apart. `--offline` performs the same local checks and writes a separate report without making source requests.

Each window also writes a `-next-15.json` packet in queue order. It contains the first 15 records requiring editorial or metadata review. The packet’s `complete` field indicates whether the full window was screened.

## Prepare a titles batch

Review the candidate’s actual source and confirm the release, runtime, credits, and poster before approving it. Use the compact record’s labeled excerpts for the parent-facing notes. The cached full review is available for context and for checking a proposed flag adjustment.

In a fresh titles worktree, pass a reviewed JSON manifest to `prepare-catalog-batch.mjs`. The script assigns IDs, prepares append-only data edits, and generates PR tables, a draft log entry, and input for the existing flag derivation script.

```sh
node /path/to/tools/prepare-catalog-batch.mjs --manifest /path/to/reviewed.json --output /path/to/artifacts
node /path/to/tools/prepare-catalog-batch.mjs --manifest /path/to/reviewed.json --output /path/to/artifacts --apply
```

The manifest has a `date`, ordered `entries`, and optional `skipped`, `held`, and `possibleLists` arrays. Each entry supplies the queue `slug`, exact reviewed `srcUrl`, `t`, `y`, `rating`, `genre`, `studio`, `runtimeMinutes`, `runtimeSourceId`, `reviewDate`, CSM scores as `csm` with `age`, `v`, `s`, `l` and `d`, and paraphrased `full` notes. The script adds the closing CSM age sentence. Mark a new release with `newRelease: true`.

Optional entry fields include `pins` with list IDs, `predecessor` with the immediate predecessor’s ID, `concerns` with `[level, exact quote]` values, `watch` with `[title, note]` and its `ask` question, and `bumps` with `{quote, why}` values keyed by flag. A `poster` uses the catalog `{u,w,h,p}` shape and requires `posterHeaders`, the path to the saved HTTP 200 image headers for that exact URL. Relative header paths resolve from the manifest directory.

Complete the generated log entry and PR checks from the actual run. Use the full build and test sequence in the batch guide on the titles and flags branches. Apply the generated `flags.json` using `scripts/derive-flags.mjs` on the separate flags branch.

## Run the evidence pipeline

The pipeline collects source evidence once, prepares a small editorial packet, then sends the approved material to the same titles builder and flag derivation. Use the same cache across stages and worktrees. The default is the main checkout’s ignored `.scratch-csm-cache/`. For an offline experiment, choose a temporary `--cache` and pass the existing cache to `--import-cache`.

### Screen and enrich the next titles

1. Fetch current `master` and check for overlapping catalog PRs. Check the CSM new-release list first as described in the batch guide. For shortlisted release slugs, use the same guarded review parser with `--release-slug` once per slug. Set `--request-budget` to what remains after the list and any other CSM release lookups. The budget includes redirects. Backlog scanning for the batch follows the release check.
2. Take the remaining candidates in queue order from screening. `--held SLUG --hold-reason REASON` records a hold in the evidence cache. `--clear-hold SLUG` clears it for reconsideration. Rerun screening against fresh `master` after upstream changes. The scanner recalculates eligibility and matches using locally cached evidence.
3. Nominate only the next batch for Wikipedia. In `nominations.json`, supply an array of objects such as `{"slug":"example-film","wikipediaTitle":"Example Film"}`. Include `year` when the CSM release information has no unique year. The tool checks the film title and year against the infobox before accepting metadata. An ambiguous page gets `needs-review`. If the article has no usable infobox image, the result records that finding.

```sh
node tools/screen-catalog-queue.mjs --release-slug example-film --request-budget 10
node tools/screen-catalog-queue.mjs --limit 100
node tools/enrich-catalog-candidates.mjs --input nominations.json
```

The cache stores stage receipts under `evidence/<slug>/`, alongside raw reviews and saved Wikipedia articles and image headers. The screening and enrichment commands share one source-worker lock and the existing aggregate rate guard. A source block stops the online pass. If Wikipedia succeeded and the poster request stopped, the next permitted pass starts at the poster. `--offline` on either command makes zero requests. Carry the actual request counts and any source stop into the batch log.

### Send the editorial work as a compact packet

Create `selection.json` with the batch `date`, `releaseScan` containing `checkedAt`, `requestsUsed`, and a short `note`, and `entries` containing `{slug, newRelease?}`. Put confirmed new releases first and then backlog entries in queue order, with at most 15 selected titles. An optional `skips` array records specifically selected, freshly screened exact duplicates or deterministic ineligible results. Possible matches stay in review.

```sh
node tools/catalog-editorial-packet.mjs pack --selection selection.json --output editorial.json
node tools/catalog-editorial-packet.mjs manifest --selection selection.json --decisions decisions.json --output reviewed.json
```

Return one object per title in `decisions.json`. Include its `slug`, `evidenceId`, and `action`. Use `action: "held"` with a reason for a title that needs a decision or more evidence. For `action: "approve"`, confirm `reviewed: true` after reading the source and include `full` and `genre`. Supply `studio` when the source credits need a choice or the franchise uses an established catalog name. Add `concerns`, `watch`, `ask`, `pins`, `predecessor`, `bumps`, and `possibleLists` where relevant. `possibleLists` entries take `list` and `reason`. Resolve flagged exceptions in `confirmed`, using `standalone`, `distinctBecause`, `releasedOn` with `releaseSource`, `rating`, or `csm` only as supported by the source. The saved source date, scores, route, runtime and poster evidence flow through to the manifest. Any changed evidence makes the corresponding approval stale. For older specials or exceptional metadata that needs a manual resolution beyond these fields, use the existing reviewed-manifest workflow above.

### Apply and verify the two branches

Run the titles command from a fresh titles worktree. With no mode flag it previews. `--apply` writes the batch, builds and stamps the data, then runs both validators, unit tests and Playwright. It stops at the first failed check, keeps logs, and writes a PR body draft with the actual results. Use `--verify` in the same worktree to repeat checks after applying a phase. Finish the draft log with total source requests, hold and skip reasons, check results, and both actual PR links.

```sh
node tools/run-catalog-batch.mjs titles --manifest /path/to/reviewed.json --output /path/to/artifacts --apply
node tools/run-catalog-batch.mjs flags --output /path/to/artifacts --titles-pr https://github.com/tokim25/movie-app-repo/pull/123 --apply
```

Before running the flags command, open the titles PR and branch from its commit. Reuse the same artifacts directory. The runner checks the generated flag input against the titles before running the dry run, applying flags and running the full checks again. Fetch and dedupe before publishing as specified by the batch guide. Open both PRs against `master`, titles first, and leave merging to review.

Run the source-free tooling tests with `node --test tools/catalog-evidence-pipeline.test.mjs`.
