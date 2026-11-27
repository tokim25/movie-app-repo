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
