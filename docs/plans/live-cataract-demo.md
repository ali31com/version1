# Live audience cataract coding demo

Status: approved by the owner on 26 September 2026, including the scenario boundaries, defaults and ticket breakdown below.

Execution status: implementation cancelled on 26 September 2026; approved requirements remain retained for a future authorized restart. See [agent pickup guide](../START-HERE.md).

Date: 26 September 2026.

## Purpose

An audience member creates one synthetic cataract surgery Episode on their phone. It appears immediately on a clinical coding Worklist, proceeds through live Gemini stages, and produces codes with inspectable evidence. The presenter demonstrates both automatic coding and review-question resolution.

The owner's request and recorded interview decisions govern this demo. [PRD.md](../PRD.md) supplies clinical workflow and evidence concepts; its broader pilot scope and suggested Python/PostgreSQL/SSE stack are not mandatory.

## Accepted scope

- Cataract surgery only, using prepared clinical data customised by audience choices.
- Up to 50 participants, each with a personal URL obtained through the shared QR entry point.
- One question per phone screen; two or three answer buttons where appropriate. Name and age use suitable inputs.
- One submitted Episode per participant, followed by live progress and result viewing.
- Automatic processing with a presenter pause control.
- Age-related or mature/white cataract; left, right or both eyes; diabetes, hypertension and glaucoma; no complication or posterior capsule rupture with its documented treatment.
- A clinical coding software style presenter workspace supporting evidence inspection, Open question resolution, approval and retry.
- Gemini Flash performs the MedCAT and MedGemma roles; no real MedCAT or MedGemma runtime is required.
- Convex supplies shared live state and backend processing.
- Visible failures and retry; no prepared-result fallback.
- Mature/white-cataract confirmation and presenter-only contradictory laterality demonstrate review.
- Target 30 seconds from submission to an actionable result under normal load, excluding the presenter's time answering a question. Measure performance and report queue time during bursts.

## Approved defaults

These defaults make the accepted flow concrete and were approved with the plan.

- The phone builder is light and spacious. The presenter workspace is dark, dense and legible, with light paper clinical documents and monospace codes.
- New arrivals update the Worklist and counts without changing the selected Episode. Clicking a row opens its workspace.
- Pause stops new stages from starting and allows an active request to finish. Submissions remain open. Resume releases queued stages.
- A new-demo control creates a fresh session, Worklist and QR join route; it preserves previous results. Existing personal URLs continue to show their original results.
- Reopening the join route on the same browser resumes its personal session for that demo. A personal URL always opens the participant's existing draft or submitted Episode. New submissions on another device count as a different participant; identity verification is not part of this demo.
- The initial bilateral preset is uncomplicated same-session surgery. The capsule-rupture preset is unilateral until asymmetric bilateral coding is explicitly supported and verified. The phone skips the complication choice for bilateral surgery and explains the preset boundary.
- The capsule-rupture note explicitly documents the affected eye, vitreous prolapse, anterior-approach vitrectomy, adequate remaining support and unsutured sulcus lens placement. Code coverage must match these details; a generic rupture flag cannot imply treatment. This curated clinical scenario still requires fixture review. Its full complication diagnosis/external-cause mapping and combined procedure sequence are not yet verified, so the initial implementation routes it to review with a specific completeness question and blocks final approval while that question remains unanswered. Complete automatic coding can be enabled only after the reference gate passes.
- Adult synthetic ages are accepted within a documented range; cataract type is explicitly documented by the selected preset and is never inferred from age.
- The condition button says “Age-related nuclear cataract” so the source supports the PRD's H25.1 fixture rather than silently inferring a subtype. Positive comorbidity choices explicitly describe type 2 diabetes without documented diabetic complications, diagnosed essential hypertension and primary open-angle glaucoma relevant to the Episode. Diabetes is not automatically the cause of the cataract. Iris hooks appear only when their use is explicitly documented in a presenter teaching fixture; the audience's glaucoma answer does not itself select this procedure.
- Mature/white confirmation is a deliberate teaching policy, recorded separately from the national coding standard. The contradictory-laterality fixture offers a curated clarification representing information obtained for the demo; the presenter does not infer the operated eye from conflicting text.

## Audience journey

1. Scan the shared QR; the app creates or resumes a participant session and opens its personal URL.
2. Enter a display name and synthetic age, each on its own step.
3. Choose Left / Right / Both. Both means both eyes treated during the same operative session.
4. Choose Age-related nuclear / Mature or white cataract.
5. For a unilateral Episode, choose No complication / Posterior capsule rupture. Treatment details come from the verified preset.
6. Answer the three comorbidity questions separately, using the precise preset descriptions above and Yes / No buttons. Back navigation preserves choices.
7. Review a plain-English summary and submit once. Before submission, choices are editable; afterwards, clinical input is frozen.
8. Watch queued and processing progress. On completion, see diagnoses and ordered procedures, explanations and any review question. The participant cannot resolve or approve it; presenter changes update this view live.

Acceptance: a refresh resumes the correct step or result; a double click or submission retry creates one Episode; already submitted participants cannot create a second Episode in that demo session.

## Presenter workspace

The Worklist shows Episode ID, display name, age, scenario summary, laterality, current stage, elapsed time and coding result. Include simple stage/result filters and name/ID search. The QR and submission count remain easy to display on a projector.

Opening an Episode shows its clinical note on the left and stage/result detail on the right, with a compact stage rail. Diagnosis codes and procedure codes remain separate; procedure sequence is explicit.

- Select a code: highlight its supporting passages and show linked facts, coding references and the explanation.
- Select a fact: highlight its passages. Select a passage: show the related facts and codes.
- Annotations are labelled as hints. Provider labels show Gemini Flash and the emulated role.
- Auto-coded Episodes show their result immediately. Review Episodes show the precise Open question, blocked code and relevant passages.
- Resolving a question creates a recorded presenter decision; affected proposal/check stages run or a bounded verified amendment is applied. Approval saves the final ordered codes and reviewer decision.
- Retry preserves accepted work for unchanged inputs and retries the failed stage with a new attempt. A deliberate full rerun creates a new run. Stale outputs cannot replace the active run.
- A presenter-only control loads the contradictory-laterality demonstration Episode and its curated clarification; it is not an audience builder option.

Acceptance: one click from a displayed code reveals the supporting clinical text and reference; new submissions never interrupt the presenter selection; participant results reflect clarification and approval without refresh.

## Architecture

Use the existing React/Vite/TypeScript frontend, Convex backend and Google SDK. [Research](../research/live-coding-demo.md) verifies installed versions and the current SDK/model interfaces. [ADR 0001](../adr/0001-convex-and-emulated-model-roles.md) records the accepted stack.

Candidate Convex records: demo sessions, participants/drafts, versioned presets, Episodes, source documents/passages, pipeline runs, stage attempts/outputs, versioned references, proposals, checks, Open questions and presenter decisions. Keep Worklist summaries small; query selected Episode details separately. Keep growing attempt history in child records.

A submission mutation validates selections, freezes their preset version, deterministically generates the operation note and passages, inserts the Episode/run and atomically enqueues processing. Its stable submission key prevents duplicate Episodes.

Use a version-pinned Convex Workpool component for measured concurrency, completion handling and bounded idempotent retries. Verify component compatibility before installation. Model actions use internal queries/mutations for persistence; their internal functions are not browser APIs. Do not add a parallel database or separate realtime transport.

## Pipeline and evidence

Preserve the PRD's logical stages:

1. Deterministic Episode packet and stable Source passages.
2. Live MedCAT-role annotation call.
3. Live MedGemma-role Clinical fact extraction call.
4. Deterministic retrieval from the curated, versioned reference library.
5. Live MedGemma-role code proposal call.
6. Bounded uncertainty handling when needed.
7. Deterministic validation and routing.

Persist actual stage state and validated output. Schema-constrained model JSON must also pass application checks. Expected fixture codes are kept out of model inputs; preset generation produces the source note, not the coding answer.

Checks include catalogue membership, exact annotation spans, valid evidence links, code sequence, primary diagnosis, laterality agreement, documented procedure/comorbidity coverage for supported presets, and unresolved contradictions. A valid JSON shape or existing evidence ID alone does not establish clinical correctness.

All required checks pass and no unresolved Open question remains → Auto-coded. Otherwise → Sent to review. A model failure additionally preserves a failed execution state and provides retry. No confidence percentages are shown.

Record model/role, prompt version, source/preset/reference versions, stage inputs and raw output, accepted output, attempts and presenter decisions. Structured conflicts have explicit fields; do not detect them solely through prose.

## Reliability and timing

Proposed implementation budgets: no more than three total model attempts per stage, counting initial requests and any transport/schema retries; no more than two semantic re-reading iterations. SDK and Workpool retries share the stage budget rather than multiplying each other. Deadline handling terminates stuck work visibly and permits retry. The exact timeout/concurrency settings are selected through measurements.

Commit accepted stage output and its successor enqueue atomically. Use run/stage/attempt identifiers to reject stale completions and reuse already accepted output. Database idempotency prevents duplicated state, but cannot guarantee that an interrupted external request is charged only once.

Verify a 30-second normal-load target for a first actionable result. Test a burst of 50 submissions separately and record total wait, active processing time, completions and failures. Report missed targets rather than conceal waits or substitute fixtures. Account quotas and external API latency must be tested before choosing concurrent processing slots.

## Clinical reference gate

The PRD's seed does not fully cover the accepted complication preset. C79.1 for explicitly documented anterior-approach vitrectomy is verified, but the full complication diagnosis/external-cause mapping and combined sequence remain open. Add verified references as available; expose the complication preset as a review demonstration until complete coding coverage and a reviewed fixture are established. Do not permit final approval of an incomplete code set.

Use official NHS classification and coding-standard sources for each supported scenario. The technical research note does not independently validate clinical rules. The new [preset research](../research/cataract-preset-references.md) records verified facts and outstanding questions. If a code or combined procedure sequence remains unverified, it is not an enabled automatic-coding path.

Create complete fixtures for the five PRD teaching scenarios plus supported complication and comorbidity interactions. Expected results must be traced to their references. The narrow supported catalogue is a demo boundary; it does not claim coverage of arbitrary cataract notes.

## Approved vertical implementation slices

These are the approved ticket granularity and dependencies for the to-tickets step. Tracker links are recorded in the delivery document after publication.

| Slice | Delivered behaviour | Blocked by |
|---|---|---|
| 0. Verify preset fixtures | Confirm supported note fragments and references, complete uncomplicated golden fixtures, document the complication review boundary and approval block | None |
| 1. Join, build and submit | QR join, personal URL, one-question builder, validated note generation, submit-once mutation and live Worklist arrival | 0 |
| 2. Live annotation | Submitted Episodes automatically queue and receive persisted Gemini annotations; both views show stages; pause/resume and failure/retry work | 1 |
| 3. Facts and references | Live extraction with explicit conflicts and curated reference retrieval; both views expose accepted facts and evidence | 2 |
| 4. Codes and routing | Live proposal, completeness/sequence/side checks, ordered code results and review demonstration routing | 3 |
| 5. Evidence workspace | Worklist selection, paper note, code/fact/passage navigation and reference explanations | 4 |
| 6. Resolve and approve | Presenter clarification, mature/white confirmation, final coding approval and live participant result updates; incomplete complication results cannot be approved | 5 |
| 7. Demo session controls and presentation | New demo/QR, preserved prior results, projector and phone layouts, keyboard/reduced-motion behaviour | 6 |
| 8. Measured demo readiness | Normal/burst timing, replay/failure recovery, duplicate/stale-output checks and complete regression verification | 7 |

Every published ticket receives binary acceptance criteria, context links, a dependency list and focused verification. Slice 0 is a research/fixture prerequisite; each subsequent functional slice delivers a verifiable behaviour through backend and UI rather than splitting database and UI into isolated tickets.

## Verification and completion

- Test preset note generation for every enabled combination, including bilateral restrictions and specific documented complication treatment.
- Use Convex tests for submission idempotency, pause/resume, accepted stage persistence, stale attempt rejection, retry and presenter resolution/approval.
- Mock model adapters for deterministic scenario regressions; use separate live adapter smoke/integration checks.
- Drive QR join, submission, arrival, evidence inspection and both review demonstrations in browser verification. Check phone and projector layouts.
- Run typecheck, lint, build and relevant test suites; review changes against this approved plan and repository rules before commits.
- The complete demo is ready when supported scenarios run live, evidence navigation and presenter actions work, failures are visible/recoverable, and measured timing is reported.

## Explicitly outside this first demo

Other specialties, outpatient Attendances, production security/governance work, EPR integration, export formats, hospital dashboards, spot-check programmes, a full TRUD catalogue, arbitrary note upload, numeric confidence, real MedCAT/MedGemma hosting and unrestricted manual code editing.

## GitHub delivery after approval

Use the existing `ali31com/version1` repository, a `codex/` branch and a milestone for the live cataract demo. Publish approved dependency-linked issues in order, label unblocked issues ready for agent work, and open a draft PR containing the plan and linked issues before implementation. Include the relevant local documents in Git; `/docs` is currently ignored and must be explicitly unignored or included as part of that PR.

Use implement for incremental vertical slices. Use implement-spec with isolated managed worktrees only if the approved ticket graph exposes meaningful independent work; avoid parallel editing in the shared checkout. Maintain one unified PR with verification and code review. Attach the PR to this chat and leave merging to the owner.
