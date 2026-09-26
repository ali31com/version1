# Live demo readiness: verification record

Date: 26 September 2026. Branch `codex/live-cataract-demo-impl`, [PR #14](https://github.com/ali31com/version1/pull/14). Deployment: personal dev deployment from `.env.local`.

## Automated checks

| Check | Result |
|---|---|
| `npm run lint` (typecheck + ESLint) | Pass |
| `npm run build` | Pass |
| `npm test` (Vitest, convex-test, edge runtime) | 120 passed |

The suites cover all 80 audience preset combinations plus both teaching fixtures (coherent note, explicit comorbidities, rupture treatment, no codes in the note, expected codes reachable by retrieval), the five PRD golden scenarios, routing and check failures (sequence, side, duplicates, missing comorbidity, unknown code, two primaries), output validation, submit-once idempotency, draft resume, pause/resume, the concurrency limit, the shared attempt budget, visible failure and retry keeping accepted work, the watchdog and late-result fencing, rerun staleness, clarification/confirmation/approval, blocked rupture approval and new demo sessions. These use a deterministic fake model (`convex/fakeModel.testkit.ts`) and do not show live provider behaviour or clinical correctness beyond the fixture references.

## Live Gemini runs (separate from the mock regressions)

| Episode | Scenario | Outcome | Submit → first actionable result | Model attempts (failed) |
|---|---|---|---|---|
| OPH-1001 | Iris hooks teaching fixture | Auto-coded; matched golden H25.1, H40.1, E11.9, I10.X \| C75.1, C71.2, C64.7, Z94.2 | 71.8 s (included one visible failure and presenter retry) | 11 (8) |
| OPH-2001 | Audience phone: mature white, left, hypertension | Sent to review (H26.9 confirmation) → confirmed → approved; phone updated live | 281.7 s (two failed rounds, two presenter retries) | 15 (12) |
| OPH-2002 | Contradictory laterality teaching fixture | Sent to review, Z94 withheld, conflict kept both sides → curated right-eye clarification → Z94.2 → approved | 45.8 s | 6 (3) |

Successful single attempts took 3–18 s per stage (`gemini-3.8-flash` 3–7 s, `gemini-3.5-flash` 13–18 s). A run with no provider failures therefore needs roughly 15–40 s of model time, depending on which model answers.

## Provider limits found

The configured `GEMINI_API_KEY` is on the **free tier**. Provider responses:

- HTTP 429 `generate_content_free_tier_requests, limit: 20` per model: a hard cap far below the ~150 requests a 50-participant demo needs.
- Frequent HTTP 503 `UNAVAILABLE` ("high demand"). Free-tier traffic is shed first. 23 of the 32 live pipeline attempts above failed with 503 or 429; plain probes seconds later succeeded.

Mitigation implemented: retries rotate across `gemini-3.8-flash` → `gemini-3.7-flash` → `gemini-3.5-flash` (override with a comma-separated `GEMINI_MODEL`), with 2 s / 5 s backoff within the approved three-attempts-per-stage budget. Every attempt records its exact model. There is no prepared-result fallback.

## Targets not met / not measured

- **30-second normal-load target: not met on this key.** Only OPH-2002 approached it (45.8 s). All delay came from provider 503/429 retries; queue wait was under 0.5 s.
- **50-submission burst: not run.** It needs ~150 generation requests, which exceeds the free-tier cap and would only measure quota rejections. Run `node scripts/measure.mjs --submit 50 --burst` after enabling billing on the Google AI project. Then choose `maxConcurrent` (default 8, adjustable with `presenter:setMaxConcurrent`) from the observed latency and rate limits.
- Normal-load measurement tool: `node scripts/measure.mjs --submit 5`. Report an existing session with `--report <sessionId>`.

## Recovery limitations

- An interrupted model request may still be billed by Google even though Convex fencing discards its late result.
- The capsule-rupture preset always ends Sent to review with approval blocked (reference gate); complete complication coding is not verified.
- The presenter workspace has no authentication (production security is out of scope).
