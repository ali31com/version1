# 03: Full-width Episode workspace

**What to build:** Opening an Episode hides the Worklist sidebar completely; the workspace uses the full width and "← Worklist" returns home.

- Header: keep Episode ID, name, age, side, scenario, result badge and processing label; keep Retry failed stage, Approve final coding and Rerun. Remove the submitted/first-actionable/run line, the teaching-fixture tag and the approve hint text.
- Stage rail: five larger steps (MedCAT annotations → Clinical facts → References → Proposed codes → Result). Hide Episode packet; fold Open questions and Checks and routing into Result. Status by dot or tick only: no status words, durations, attempt counts or role lines.
- Remove the Coding result card (reason paragraph and model/provider line). A processing failure message still appears.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] No Worklist sidebar is visible while an Episode is open.
- [ ] Header, stage rail and failure display match the list above.
- [ ] Typecheck, lint and unit tests pass.

Tracker: https://github.com/ali31com/version1/issues/17
