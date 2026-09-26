# Extract Clinical facts and retrieve references live

Approved plan: [Live cataract demo](../plans/live-cataract-demo.md).

Blocked by: #6

## Acceptance criteria

- [ ] Gemini extracts facts from the source passages and annotation hints.
- [ ] Facts cite existing passages and structured conflicts preserve both sides.
- [ ] Retrieved references come only from the frozen curated library.
- [ ] Audience and presenter can observe accepted facts and processing state.
- [ ] Invalid schema/evidence fails visibly within the shared attempt budget.

## Verification

Use focused domain/Convex/browser checks for the behaviour above, then run typecheck and lint. Preserve all model/reference versions and failures.

Tracker: https://github.com/ali31com/version1/issues/7
