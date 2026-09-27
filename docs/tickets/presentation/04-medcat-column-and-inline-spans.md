# 04: MedCAT column and inline spans

**What to build:** The Episode workspace reads left to right like the pipeline: **Note | MedCAT | Codes (MedGemma)**, with no tabs.

- The paper note highlights every MedCAT annotation span inline, coloured by category; negated spans are struck through. Passage IDs, context tags and the synthetic-data footer are removed from the note.
- The MedCAT column (headed "MedCAT") lists the concepts with a category colour legend. Clicking a concept highlights its span; clicking a span selects its concept.
- The Codes column (headed "MedGemma") holds the existing code list for now.
- Remove the Facts, Hints, References, Checks and Run log tabs, the hints disclaimer and the rejected-hints list. Data stays in Convex.

**Blocked by:** 03: Full-width Episode workspace.

**Status:** ready-for-agent

- [ ] Three columns render with no tab bar.
- [ ] Spans are coloured by category and linked both ways with the concept list.
- [ ] Typecheck, lint and unit tests pass.

Tracker: https://github.com/ali31com/version1/issues/18
