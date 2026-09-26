# Live demo readiness: verification record

Date: 26 September 2026. Branch `codex/live-cataract-demo-impl`, [PR #14](https://github.com/ali31com/version1/pull/14). Deployment: personal dev deployment from `.env.local`.

## Automated checks

| Check | Result |
|---|---|
| `npm run lint` (typecheck + ESLint) | Pass |
| `npm run build` | Pass |
| `npm test` (Vitest, convex-test, edge runtime) | 120 passed |

The suites cover all 80 audience preset combinations plus both teaching fixtures (coherent note, explicit comorbidities, rupture treatment, no codes in the note, expected codes reachable by retrieval), the five PRD golden scenarios, routing and check failures (sequence, side, duplicates, missing comorbidity, unknown code, two primaries), output validation, submit-once idempotency, draft resume, pause/resume, the concurrency limit, the shared attempt budget, visible failure and retry keeping accepted work, the watchdog and late-result fencing, rerun staleness, clarification/confirmation/approval, blocked rupture approval and new demo sessions. These use a deterministic fake model (`convex/fakeModel.testkit.ts`) and do not show live provider behaviour or clinical correctness beyond the fixture references.

## Browser walkthrough

Headless Chromium against Vite + the dev deployment (desktop 1600×900, phone 390×844). Kept to one pass, per the repository's instruction to limit browser testing.

- QR overlay opened and closed with Esc. Phone join → personal URL. Name and age inputs, then side, cataract type, complication and three comorbidity answers. A refresh mid-builder resumed on the cataract step. The review summary edited correctly. A double-clicked Submit created one Episode. Rejoining through the shared QR in the same browser returned the same personal URL.
- The Episode arrived live on the Worklist (highlighted, selection unchanged). Its provider failure was visible on phone and presenter, and the presenter Retry button resumed it, keeping accepted stages.
- Mature/white review: code click → supporting facts, highlighted passages, explanation and references. Confirm H26.9 → Approve; the phone showed "Approved by the presenter" live without a refresh.
- Contradictory laterality (presenter-only teaching case): question with conflicting passages highlighted → curated right-eye clarification → Z94.2 appended → approval → run log shows decisions. Passage click showed the citing facts, including the presenter fact, and Z94.2.
- Two console errors were found and fixed: a missing favicon (404) and a duplicate answer submission (answer buttons now disable while pending).

## Live Gemini runs (separate from the mock regressions)

| Episode | Scenario | Outcome | Submit → first actionable result | Model attempts (failed) |
|---|---|---|---|---|
| OPH-1001 | Iris hooks teaching fixture | Auto-coded; matched golden H25.1, H40.1, E11.9, I10.X \| C75.1, C71.2, C64.7, Z94.2 | 71.8 s (included one visible failure and presenter retry) | 11 (8) |
| OPH-2001 | Audience phone: mature white, left, hypertension | Sent to review (H26.9 confirmation) → confirmed → approved; phone updated live | 281.7 s (two failed rounds, two presenter retries) | 15 (12) |
| OPH-2002 | Contradictory laterality teaching fixture | Sent to review, Z94 withheld, conflict kept both sides → curated right-eye clarification → Z94.2 → approved | 45.8 s | 6 (3) |

Successful single attempts took 3–18 s per stage (`gemini-3.8-flash` 3–7 s, `gemini-3.5-flash` 13–18 s). A run with no provider failures therefore needs roughly 15–40 s of model time, depending on which model answers.

### Normal-load measurement after the owner enabled billing (18:50 UTC)

`node scripts/measure.mjs --submit 3` (sequential): 1 of 3 Episodes completed, auto-coded, first actionable result in 80.1 s. The other 2 failed visibly after exhausting the attempt budget. 16 of 21 attempts failed. Every `gemini-3.8-flash` attempt still returned 429 `generate_content_free_tier_requests`; `gemini-3.7-flash` and `gemini-3.5-flash` returned 503 (high demand). So the key configured in the Convex deployment was still on the free tier when measured. Queue wait stayed at or below 0.2 s.

## Provider limits found (free tier, before billing)

The configured `GEMINI_API_KEY` was initially on the **free tier**. Provider responses:

- HTTP 429 `generate_content_free_tier_requests, limit: 20` per model: a hard cap far below the ~150 requests a 50-participant demo needs.
- Frequent HTTP 503 `UNAVAILABLE` ("high demand"). Free-tier traffic is shed first. 23 of the 32 live pipeline attempts above failed with 503 or 429; plain probes seconds later succeeded.

Mitigation implemented: retries rotate across `gemini-3.8-flash` → `gemini-3.7-flash` → `gemini-3.5-flash` (override with a comma-separated `GEMINI_MODEL`), with 2 s / 5 s backoff within the approved three-attempts-per-stage budget. Every attempt records its exact model. There is no prepared-result fallback.

## Paid tier: normal load and burst (19:00 UTC, after billing took effect)

| Measurement | Episodes | Completed / failed | Routing | First actionable result | Queue wait | Model time | Attempts (failed) |
|---|---|---|---|---|---|---|---|
| Normal load, `--submit 3` sequential | 3 | 3 / 0 | 3 auto-coded | 11.3–14.1 s (p50 13.5 s) | ≤ 0.2 s | 10.8–13.4 s | 9 (0) |
| Burst, `--submit 50 --burst`, 8 slots | 50 | 50 / 0 | 40 auto-coded (all nuclear), 10 sent to review (all mature/white confirmation) | p50 71.6 s, p90 74.9 s, max 77.8 s | p50 59.3 s, max 63.4 s | p50 11.6 s | 150 (0) |

All attempts used `gemini-3.8-flash` (no rotation needed). Per stage: annotate ~6.5–7.2 s, extract ~2.3–3.8 s, propose ~2.0–3.2 s.

## Targets

- **30-second normal-load target: met** on the paid tier (max 14.1 s).
- **50-submission burst: measured.** No failures and every Episode routed correctly. Wait time is dominated by queueing at 8 concurrent model calls, so the last of 50 simultaneous submissions reached a result in 77.8 s. To shorten bursts, raise slots with `npx convex run presenter:setMaxConcurrent '{"maxConcurrent": 24}'` (untested; check the project's Gemini rate limits first).
- Free-tier keys cannot run the demo: see the provider limits above.

## Implementation decisions

See [ADR 0002](../adr/0002-hand-rolled-stage-queue.md): a hand-rolled stage queue instead of Workpool, deterministic follow-up stages completing inside the accepting mutation (also while paused), and a fresh attempt budget for each deliberate presenter retry. Stage 6 is deterministic: it links the relevant passages but makes no model re-reading call. Each attempt stores its exact prompt and raw output in `attemptPayloads`.

## Recovery limitations

- An interrupted model request may still be billed by Google even though Convex fencing discards its late result.
- The capsule-rupture preset always ends Sent to review with approval blocked (reference gate); complete complication coding is not verified.
- The presenter workspace has no authentication (production security is out of scope).
