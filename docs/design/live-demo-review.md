# Live coding demo: design interview

Status: interview complete; plan and ticket breakdown approved by the owner on 26 September 2026.

## Request and PRD relationship

The owner's request governs scope. [PRD.md](../PRD.md) is a draft proposal to review, not an instruction to execute every requirement. Its clinical workflow and evidence interactions are valuable design input. Its broader pilot features and proposed Python/PostgreSQL/SSE architecture are not automatically part of this demo.

## Settled requirements

- Audience members obtain personal URLs through a QR entry point.
- Audience interactions create Episodes using prepared data customised by name, age, laterality, condition, complications and comorbidities.
- Submitted Episodes appear in a live presenter interface resembling clinical coding software.
- Gemini Flash performs the MedCAT and MedGemma roles; the completed codes and Episode details are inspectable.
- Convex supplies the live application state.
- Only cataract surgery Episodes are supported in the first demo.
- Audience screens present one question at a time, with two or three answer buttons where appropriate. Name and age are inputs, not forced into button choices.
- Submitted Episodes start processing automatically, subject to available processing slots; the presenter can pause processing.
- Each participant submits once, then watches their own progress and result on their personal URL.
- The maximum expected audience is 50 participants, with a 30-second normal-load submit-to-result target. Burst queue waits must remain visible; timing must be measured before it is promised.
- Accepted starting choices: age-related or mature/white cataract; Left / Right / Both; diabetes, hypertension and glaucoma asked separately; no complication or posterior capsule rupture with its treatment. The exact clinical note fragments and coding references require verification before implementation.
- Presenter actions include inspecting evidence, resolving review questions, approving results and retrying processing. Unrestricted code adding, removing and reordering are outside this accepted first-demo scope.
- Gemini failures remain visible with retry; there is no prepared-result fallback.
- Include both review demonstrations: mature/white-cataract confirmation and a presenter-only contradictory-laterality example.
- Security and production governance work are outside the requested design review.

## Initial recommendations (historical; approved plan supersedes these)

- Separate the mobile participant builder from the dense presenter workspace.
- Build clinical notes deterministically from compatible preset fragments. Name and age alone should not imply a diagnosis; “complication: yes” should branch to a named complication and its management.
- Treat a small pupil requiring iris hooks as an operative feature, not automatically as a surgical complication.
- Use a common QR join route to create or resume a participant session, then redirect to its personal URL. Exact session persistence remains open.
- Keep the presenter selection steady when new Episodes arrive. Use arrival highlights and counts rather than forcing navigation.
- Persist real pipeline stages and show actual progress. Distinguish queue wait, active processing, successful result and failure.
- Preserve the useful evidence chain from the PRD: Source passage → Clinical fact → Proposed code → Coding reference.
- Keep expected reference codes separate from model inputs. Preset input generation should not secretly choose the output codes.
- Provide bounded concurrency, explicit retry and a presenter recovery action for API failures. Define limits after audience size is known.
- Plan capacity for a possible burst of all 50 submissions. Set processing concurrency after testing the actual Gemini account limits; audience size is not the same as concurrent model calls.
- Pause should stop new stages from starting, allow already running requests to finish, and continue accepting submissions. Resume continues queued work; the UI explains that current requests may finish while paused.
- Begin with curated references for the supported scenarios; do not add embedding retrieval unless the agreed scenario coverage needs it.

## PRD gaps to resolve in the plan

- The PRD does not define audience entry, personal URLs, a guided builder or presenter session controls. These are central to this request and need their own acceptance criteria.
- Its proposed checks validate structure and links, but do not establish complete clinical correctness. In particular, C5 checks that a laterality code is present, not that it agrees with the documented eye; C3 checks that evidence references exist, not that their text supports a code. The plan should add supported-scenario checks for side agreement, expected procedures, documented comorbidities and unresolved contradictions.
- `ClinicalFact.kind` omits `contradiction`, although the uncertainty stage says facts of that kind trigger it. A typed contradiction indicator or explicit structured conflict is needed rather than relying on prose.
- The PRD alternates between one retry and two retries for invalid model output. The plan needs a single attempt budget and a distinct budget for uncertainty re-reading.
- The example mature-white-cataract fact infers likely age-related disease from age, and the fixture deliberately routes a coding-standard override to review. Whether that review is a teaching feature or required routing policy needs a decision; age should not silently become a documented diagnosis.
- The five golden Episodes are scenarios described in the PRD, not five complete fixture files already present in this repository. Build the missing fixtures and validate their expected codes against the cited references before using them as regression expectations.
- A preset output should be coherent for every selectable combination. Unsupported combinations need either a different branch, a disabled option with an explanation, or an explicit review result; they cannot rely on the model to repair a malformed note.
- The plan needs a separate processing state and coding decision. Queued/running/failed describe execution; Auto-coded/Sent to review describe the coding result. The UI should preserve both when an API failure creates a review question.

## Interview record

Round 1 accepted by the owner: cataract only; one question with two or three answers; automatic processing with presenter pause; one submission followed by watching the result; maximum 50 participants. Result latency remains unanswered.

Round 2 partially answered: the proposed starting scenario set and presenter inspection/resolution/approval/retry were accepted. Failure behaviour and latency are still unanswered; review-demonstration policy is the remaining product question.

Round 3 accepted by the owner: visible failure with retry, 30-second target, and both review demonstrations. All product questions posed so far are now answered. Routine defaults and scenario compatibility boundaries are presented in the draft plan for final scope consensus.

## Final consensus

The interview is complete. The 60-second recommendation was rejected in favour of a 30-second target.

Final consensus: the owner explicitly approved the plan and ticket breakdown, including its routine defaults and complication boundaries. Tracker publication is complete. Implementation was subsequently cancelled by the owner; retain this consensus for a future authorized restart.

The reviewable [plan and proposed ticket breakdown](../plans/live-cataract-demo.md) are now written. [Clinical preset research](../research/cataract-preset-references.md) verified the diagnosis specificity and anterior-vitrectomy entry, but did not establish the complete rupture diagnosis/external-cause mapping or combined procedure sequence. The draft therefore proposes uncomplicated bilateral surgery only and a unilateral complication review path, with final approval blocked until missing coding coverage is resolved. The owner approved these boundaries.

## Approved routine defaults

The approved defaults are a dark presenter workspace with paper clinical documents, a light phone builder, steady presenter selection, pause that allows active requests to finish, and a new-demo control that starts a fresh Worklist and QR join route while preserving the previous demo's results. These are settled requirements.

## Repository findings

The repository currently contains a React/Vite/Convex starter, a health-check page, a sample numbers table and a Gemini connectivity action. It does not yet contain an Episode schema or demo UI. See [App.tsx](../../src/App.tsx), [schema.ts](../../convex/schema.ts) and [gemini.ts](../../convex/gemini.ts).

The existing Gemini action specifies `gemini-3.8-flash`; model availability must be verified against official documentation before adopting it. Dependencies are declared in [package.json](../../package.json).

`docs/` is tracked on the planning branch. The [delivery map](../delivery.md) links the published milestone and nine open issues. The cancelled implementation PR is closed; the planning branch remains available.

## Delivery sequence requested by the owner

Research and interview → agreed plan document → dependency-linked tickets and milestone → GitHub issues and PR → incremental implementation using implement or implement-spec as appropriate. Broad implementation starts once the scope is agreed.
