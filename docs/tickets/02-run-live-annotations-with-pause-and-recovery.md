# Run live annotations with pause and recovery

Approved plan: [Live cataract demo](../plans/live-cataract-demo.md).

Blocked by: Ticket 01 (tracker ID inserted on publication)

## Acceptance criteria

- [ ] Submission queues a real Gemini MedCAT-role annotation call with bounded concurrency.
- [ ] Stage start, accepted output, metadata and failure are persisted.
- [ ] Annotations require exact spans and existing passage IDs.
- [ ] Pause blocks new stages while accepting submissions; active calls may finish.
- [ ] Visible retry resumes failed work without duplicating accepted output.

## Verification

Use focused domain/Convex/browser checks for the behaviour above, then run typecheck and lint. Preserve all model/reference versions and failures.
