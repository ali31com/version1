# 02: Presenter chrome clean-up

**What to build:** The top bar, Worklist home and QR overlay show only what the demo needs.

- Top bar: remove the "Live cataract coding" subtitle, the "Synthetic demo · not for clinical use" pill, the processing-slots counter and the paused-banner sentence (the Resume button shows the state). Keep submitted and joined counts, Pause, Teaching cases (titles only) and Show QR. Move the session selector and New demo into a "⋯" menu.
- Worklist home: remove search and filter buttons, keep a one-line count, drop the Teaching tag, keep all columns including the live Elapsed timer.
- QR overlay: remove the session title; keep the heading, QR, URL and live counts.
- Amend the approved plan and CONTEXT with a dated note: the provider and emulated role stay in the data and stage naming but are no longer shown as text. The no-confidence rule is unchanged.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Top bar, Worklist and QR overlay match the list above; session switching and New demo still work from the menu.
- [ ] Plan and CONTEXT carry the dated amendment.
- [ ] Typecheck, lint and unit tests pass.

Tracker: https://github.com/ali31com/version1/issues/16
