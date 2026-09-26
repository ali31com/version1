# Measure and verify live demo readiness

Approved plan: [Live cataract demo](../plans/live-cataract-demo.md).

Blocked by: Ticket 07 (tracker ID inserted on publication)

## Acceptance criteria

- [ ] Typecheck, lint, build and deterministic scenario/Convex suites pass.
- [ ] Browser walkthrough covers join, submit, arrival, evidence and both review demonstrations.
- [ ] Live adapter integration is executed separately from mock regressions.
- [ ] Measure normal submit-to-actionable-result latency against the 30-second target.
- [ ] Test a burst of 50 submissions and report waiting, processing, completion and failure counts.
- [ ] Document any unmet targets and recovery limitations in the PR.

## Verification

Use focused domain/Convex/browser checks for the behaviour above, then run typecheck and lint. Preserve all model/reference versions and failures.
