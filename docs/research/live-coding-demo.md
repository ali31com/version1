# Live audience clinical-coding demo: implementation research

Research date: 26 September 2026. Status: research and recommendations, not an approved implementation plan.

## Summary

The proposed interaction is feasible on this repository's existing React, Convex and Gemini stack. The strongest demonstration is an audience member creating a synthetic Episode through small choices, seeing it enter a shared Worklist, then watching persisted pipeline stages produce an inspectable evidence chain. Keep source-note generation deterministic and run the clinical annotation, extraction and proposal stages live.

The PRD is proposal context. Its REST routes, embedding retrieval and broader hospital-product workflows are suggestions or draft requirements, not instructions to implement during this research. The current request adds audience participation and presenter controls that are absent from the PRD. Clinical coding rules and clinical references in the PRD remain proposed until verified against the applicable classification and national standards; this technical note does not independently validate them.

## Verified repository facts

| Item | Verified state | Evidence |
|---|---|---|
| Convex | Installed and locked at **1.46.0**; manifest range is `^1.44.0` | [lockfile](/Users/ali/Documents/ali31com/version1/package-lock.json:3113), [manifest](/Users/ali/Documents/ali31com/version1/package.json:16) |
| Google SDK | Installed and locked `@google/genai` **2.23.0** | [lockfile](/Users/ali/Documents/ali31com/version1/package-lock.json:932) |
| React / Vite | Installed and locked React **19.3.0**, Vite **8.3.0** | [React lock](/Users/ali/Documents/ali31com/version1/package-lock.json:4664), [Vite lock](/Users/ali/Documents/ali31com/version1/package-lock.json:5139) |
| Current UI | Backend health screen; no participant builder or coding workspace yet | [App](/Users/ali/Documents/ali31com/version1/src/App.tsx:4) |
| Current schema | Starter `numbers` table; no Episode entities yet | [schema](/Users/ali/Documents/ali31com/version1/convex/schema.ts:8) |
| Gemini integration | Node internal action constructs `GoogleGenAI`, uses `gemini-3.8-flash`, and checks nonempty text | [Gemini action](/Users/ali/Documents/ali31com/version1/convex/gemini.ts:1) |
| Environment contract | Typed `APP_ENV` and `GEMINI_API_KEY` already declared | [Convex config](/Users/ali/Documents/ali31com/version1/convex/convex.config.ts:4) |

The generated Convex guidelines target `^1.44.0`; installed 1.46.0 satisfies that range. They require validated function arguments, internal functions for pipeline internals, bounded queries, and separate child tables for unbounded history. Their component guidance calls for Workpool when bounded async parallelism is needed. [Generated guidelines](/Users/ali/Documents/ali31com/version1/convex/_generated/ai/guidelines.md:3), [function guidance](/Users/ali/Documents/ali31com/version1/convex/_generated/ai/guidelines.md:85), [schema guidance](/Users/ali/Documents/ali31com/version1/convex/_generated/ai/guidelines.md:182), [component guidance](/Users/ali/Documents/ali31com/version1/convex/_generated/ai/guidelines.md:323).

## Verified platform facts

### Realtime and background processing

React `useQuery` subscribes to a Convex query; changes to underlying database data update the component. This supports both the projected Worklist and the participant's own submitted Episode without a separate polling API. [Convex React: reactivity](https://docs.convex.dev/client/react/overview#reactivity).

Convex actions can call external services and access database functions through `ctx.runQuery` / `ctx.runMutation`; they have no direct `ctx.db`. Node-dependent code belongs in an action-only file with `"use node"`. [Convex actions](https://docs.convex.dev/functions/actions), [local action guidance](/Users/ali/Documents/ali31com/version1/convex/_generated/ai/guidelines.md:351).

Scheduling from a mutation is atomic with its database writes. Scheduled mutations execute exactly once, while scheduled actions execute at most once and are not automatically retried. Therefore a scheduled model action requires explicit failure recovery. These guarantees are also stated in installed Convex 1.46.0 source. [Scheduling](https://docs.convex.dev/scheduling/scheduled-functions#scheduling-from-mutations), [installed scheduler](/Users/ali/Documents/ali31com/version1/node_modules/convex/src/server/scheduler.ts:31).

Workpool queues actions with configurable parallelism, retries for idempotent actions, and completion callbacks. It is an available candidate rather than an installed dependency; its exact version and compatibility must be pinned and checked before adopting its API. [Official Workpool repository](https://github.com/get-convex/workpool#readme).

### Gemini availability and schema output

Google's current model catalogue lists **`gemini-3.8-flash` as stable**. Its model page lists structured outputs and thinking levels `low`, `medium`, `high`; `minimal` is unsupported. The existing repository's model ID is therefore documented, although access with this project's API key was not tested here. Google currently limits Gemini 2.5 access to prior users and recommends newer models for new projects. [Model catalogue](https://ai.google.dev/gemini-api/docs/models), [Gemini 3.8 Flash capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).

Structured output constrains JSON shape but still requires application validation of values; only a subset of JSON Schema is supported, and overly complex schemas may be rejected. [Structured output validation and limitations](https://ai.google.dev/gemini-api/docs/structured-output#best-practices).

Installed SDK 2.23.0 supports `ai.models.generateContent({ model, contents, config })`, `config.responseMimeType: "application/json"`, and `config.responseJsonSchema`. The JSON-schema option must not be combined with `responseSchema`. These signatures were verified against installed declarations rather than copied from newer Interactions API examples. [Installed output options](/Users/ali/Documents/ali31com/version1/node_modules/@google/genai/dist/genai.d.ts:5965), [installed method](/Users/ali/Documents/ali31com/version1/node_modules/@google/genai/dist/genai.d.ts:11445).

Gemini quotas apply per project and vary by model and account tier; published capacity is not a guarantee. Inspect this project's current limits before promising an audience capacity. [Google rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). Google recommends bounded exponential backoff with jitter for transient failures. Installed SDK declarations expose millisecond `httpOptions.timeout` and retry options whose `attempts` includes the original request. [Troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting#retry-strategy), [installed HTTP options](/Users/ali/Documents/ali31com/version1/node_modules/@google/genai/dist/genai.d.ts:8168), [retry declarations](/Users/ali/Documents/ali31com/version1/node_modules/@google/genai/dist/genai.d.ts:8246).

## Recommended architecture — design proposals

These are engineering recommendations, not settled product decisions.

1. **Join:** A shared QR code opens a demo-session join route. A join mutation creates a Participant and returns its own URL, for example `/join/:demoSessionId/p/:participantToken`. The participant keeps that URL through refresh and sees their own draft/result. A shared printed QR cannot itself contain a different URL for every scanner; the application issues that URL after entry.
2. **Compose:** Present one question, or at most two related inputs, per phone screen: display name → synthetic age → laterality → cataract type → complication choice → one comorbidity choice at a time → summary and submit. Interpret the requested “1–2 choices” as one or two decisions per screen; laterality naturally has three answer options and needs interview confirmation.
3. **Submit:** Freeze selected preset version, selections and generated operation note in one mutation; insert the Episode, source passages, initial Pipeline run and Worklist entry. Enforce a stable submission key so double clicks or retries do not create new Episodes. Atomically enqueue processing. Keep drafts off the main Worklist until submission unless the user explicitly wants live draft previews.
4. **Process:** Persist every stage start, success, failure and validated output. Use live Gemini adapters for annotation, clinical facts, proposal and optional uncertainty resolution. Use deterministic packet preparation, coding-reference selection and routing checks. This preserves the PRD's seven logical stages while the UI can group them into MedCAT and MedGemma phases. [PRD stage specification](/Users/ali/Documents/ali31com/version1/docs/PRD.md:188).
5. **Inspect:** Subscribe to bounded worklist summaries and the selected Episode's detail separately. Show real stage state, elapsed time and completed evidence counts. Clicking a proposed code highlights its facts, source passages and coding references. Do not present incomplete streamed JSON as accepted output. Do not auto-navigate away from an Episode when another audience submission arrives.

Candidate entities: Demo session, Participant, Draft, Preset version, Episode, Source document, Source passage, Pipeline run, Stage attempt, Annotation, Clinical fact, Coding reference, Proposal, Coding result, Open question and Coder decision. The PRD already defines the clinical entities and evidence relationships; session/preset/participant entities are additions for this demo. [PRD entity definitions](/Users/ali/Documents/ali31com/version1/docs/PRD.md:287).

### Stage persistence, idempotency and failure recovery

- Keep Episode status and current stage in a small summary record; keep attempt history and stage payloads in child records. Freeze source and reference versions for each run.
- Identify accepted stage output by `(runId, stage, inputHash)` and fence commits with an attempt identifier or revision. A commit mutation must reject stale output from an earlier run. Re-running creates a new Pipeline run rather than overwriting previous evidence.
- Commit a stage output and enqueue its successor in the same mutation. Before repeating a stage, check for an already accepted output. A server crash after a model call but before persistence can still cause a duplicate paid request: database idempotency does not guarantee exactly-once execution at Google's endpoint.
- Separate schema repair attempts from transport retries and semantic uncertainty iterations. The PRD is inconsistent: §7.1 says retry then review, while §7.9 allows two retries; §7.7 allows two resolution iterations. Set explicit total budgets in the plan. [PRD general principles](/Users/ali/Documents/ali31com/version1/docs/PRD.md:190), [adapter contract](/Users/ali/Documents/ali31com/version1/docs/PRD.md:260).
- Prefer Workpool with a small measured concurrency limit for an audience burst. Avoid stacking Workpool retries and SDK retries without a shared total-attempt budget. Record attempt counts and terminal failures. A timeout, empty response, refusal or unresolved invalid output creates a visible system Open question and routes to review, as the draft PRD specifies. [PRD failure default](/Users/ali/Documents/ali31com/version1/docs/PRD.md:258).

### Structured-output call shape — declaration-verified, not executed

```ts
const response = await ai.models.generateContent({
  model: modelId,
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: stageSchema,
    httpOptions: {
      timeout: 30_000, // proposed demo budget; measure before adopting
      retryOptions: { attempts: 1 }, // let the stage runner own retries
    },
  },
});
const raw: unknown = JSON.parse(response.text ?? "");
// Validate shape, evidence IDs, exact spans and catalogue membership
// before accepting the stage output.
```

The request fields above exist in SDK 2.23.0 declarations cited above. No model call or standalone example compilation was performed. The current structured-output web guide favors Interactions examples; changing the repository's working API surface is unnecessary for the requested demo until an integration test establishes a concrete benefit.

## Preset strategy — recommended bounded catalogue

Start with cataract operations only. Make presets a curated matrix of compatible note fragments and reference entries, rather than allowing arbitrary combinations whose code coverage is unknown. The PRD offers five regression scenarios: routine unilateral surgery, comorbidities with iris hooks, bilateral surgery, conflicting laterality, and mature white cataract with a standard override. [PRD golden set](/Users/ali/Documents/ali31com/version1/docs/PRD.md:606).

Each preset should carry `presetId`, version, allowed ages/options, deterministic note fragments, applicable reference-library version, and expected review triggers. Name and age can personalize the synthetic note; clinical meaning comes from the curated choices. A generic “complication: yes” is insufficient to select a meaningful complication code: either name a supported complication and its treatment or deliberately route the resulting incomplete Episode to review.

Begin reference retrieval with deterministic mappings over the small curated library. Embeddings add an unnecessary dependency for five scenario families; add them when catalogue growth demonstrates a retrieval problem. Keep live pipeline output separate from fixture expected output. A fixture fallback, if requested, must identify itself visibly as a prepared demonstration rather than silently posing as a successful model run.

The intended quality gate is deterministic regression coverage for note generation, evidence links, code ordering, conflict routing and retry behavior, plus live Gemini adapter integration checks. A five-case golden set alone does not establish correctness for every newly enabled combination; expand fixtures with each supported condition, complication and comorbidity interaction. This is a demonstration-quality boundary, not a security review.

## Questions needed before the plan

1. Is the first release the live cataract demo only, or the PRD's broader coder product including exports, dashboards and reference editing?
2. Does the presenter start each Episode manually, or should every submission process automatically? Should the presenter be able to pause the queue?
3. Does the participant choose any combination of supported options, or choose a scenario first and customize within its allowed combinations?
4. Which concrete complication scenarios are supported, and can contradictory laterality be intentionally selected as a demonstration?
5. Should a participant make one Episode per session or several? What does reopening the shared QR do after submission?
6. Are all stages required live, and what should the audience see during an API outage? Prepared fallback requires an explicit product decision.
7. Expected audience size and acceptable submit-to-result latency need measurement with the project's account, not an invented guarantee.

No application implementation, deployment, credential inspection, model invocation or git operation was performed for this note.
