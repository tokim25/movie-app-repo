# Movie request processing log

This is no longer the request queue. Requests come from the in-app "Request a
movie" form, which submits to a Google Form and lands as rows in the
"Movie Night Requests (Responses)" Sheet
(fileId `1zRCemYIpnMSoQer2vhi7nPQbQlY9bg2pRl0h983Gd_Q`).

Since there's no reliable way to mark a row "processed" directly on the sheet,
the `movie-watchlist-updater` skill logs each timestamped row here once it's
been researched and added, so a future run doesn't reprocess the same title.
Format: one line per processed row, `<timestamp> — <title> — added as num <N>`
(or `— skipped: <reason>` if it wasn't added, e.g. already in the catalog).

<!-- add processed rows below, oldest first -->
8/24/2026 10:08:04 — The sheep detective — added as num 838
