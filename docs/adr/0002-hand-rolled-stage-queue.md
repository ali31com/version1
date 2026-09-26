# Hand-rolled stage queue instead of the Workpool component

## Status

Accepted during implementation, 26 September 2026. Deviates from the plan's "version-pinned Convex Workpool component" recommendation; recorded for owner review on PR #14.

## Context

The plan needs bounded concurrency and a pause that stops new stages but lets active requests finish, with one shared budget of three model attempts per stage (SDK and queue retries must not multiply) and fencing that rejects stale completions after retry or rerun.

## Decision

Model stage attempts are rows in the `attempts` table. A `pump` mutation starts due `queued` attempts while `control.running < control.maxConcurrent` and processing is not paused. Each attempt schedules its model action and a watchdog. Completion, failure, timeout, backoff and the next stage's enqueue are committed in one mutation, fenced by attempt `startedAt`, active run and retry round. SDK retries are disabled.

## Consequences

- Pause, per-stage budgets and fencing come from one small state machine, fully covered by convex-test regressions.
- No component dependency to pin, but slot counting is ours: `control.running` self-heals from the running attempts whenever the presenter resumes processing.
- Deterministic stages (retrieval, Open questions, checks) run inside the mutation that accepts a model result, so a request that finishes during a pause also completes its deterministic follow-up. No new model stage starts while paused.
- A presenter retry opens a new round with a fresh three-attempt budget. The budget bounds automatic retries; deliberate presenter retries are recorded as decisions.
