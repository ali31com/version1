# Join, build and submit one live Episode

Approved plan: [Live cataract demo](../plans/live-cataract-demo.md).

Blocked by: #4

## Acceptance criteria

- [ ] QR join creates or resumes a personal URL for the demo session.
- [ ] One-question builder preserves name, age, side, condition and separate comorbidity answers through refresh and back navigation.
- [ ] Both skips the complication branch with an explanation.
- [ ] Submission freezes selections and inserts one Episode despite double-click/retry.
- [ ] Worklist displays the new Episode live; participant cannot submit twice.

## Verification

Use focused domain/Convex/browser checks for the behaviour above, then run typecheck and lint. Preserve all model/reference versions and failures.

Tracker: https://github.com/ali31com/version1/issues/5
