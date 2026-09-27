# 06: Phone app text clean-up

**What to build:** The participant builder and result page carry only the questions, answers and results.

- Builder: remove the "Synthetic demo data" pill, the start-screen lead and made-up-name note, "Step N" eyebrows and the "Medical history" suffix, the step leads (name, age, cataract type, review), comorbidity descriptions and option hints. Bilateral Episodes skip the complication step silently, both forwards and back.
- Result page: remove "submitted and frozen", the pipeline role column, the facts caption, the bottom "Only the presenter…" note, the reason text under Auto-coded / Sent to review and the "no prepared result" sentence. Keep code explanations.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Builder and result page match the list above; a bilateral draft goes from side to cataract type to comorbidities with no complication screen.
- [ ] Typecheck, lint and unit tests pass.

Tracker: https://github.com/ali31com/version1/issues/20
