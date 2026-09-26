# Discarded prototype findings

Date: 26 September 2026. Implementation was cancelled and removed. These observations preserve investigation results, not reusable implementation or completed acceptance criteria. See the [pickup guide](../START-HERE.md) and [approved plan](../plans/live-cataract-demo.md).

## Observed provider behavior

Four live requests to `gemini-3.8-flash` returned HTTP 503 / UNAVAILABLE (high demand): one initial smoke request, then three bounded attempts from a submitted phone Episode. No successful live coding output was observed. No normal-load latency or 50-participant burst measurement was completed. No alternate model was tested and no provider environment setting was changed.

Before committing to a model, verify account access with a small live request. Google's [model catalogue](https://ai.google.dev/gemini-api/docs/models) is the source for current IDs; documentation availability does not prove account availability or capacity. Record the exact model ID per attempt. Any change must retain the approved Flash-emulation behavior and pass contract tests.

## Investigated dependencies and processing design

Investigated versions were Workpool 0.4.12, qrcode.react 4.2.0, convex-test 0.0.60, Vitest 5.0.2 and @edge-runtime/vm 5.0.0. These additions were removed from the lockfile. They are historical compatibility candidates, not dependencies already installed or a mandate to use those versions. Recheck against the restored package versions and current official documentation.

The discarded implementation used three live calls (annotations → facts → codes), deterministic reference retrieval/checks, immutable accepted output and generation/attempt fences. Candidate settings were five concurrent calls, 20-second provider timeouts, 25-second watchdogs and three total requests per failed stage with 1-/2-second backoff. Those settings were not performance-validated. Prevent stacked SDK/Workpool/application retries from multiplying requests; define one total budget and explicit pause/resume behavior.

## Review lessons to carry forward

- Validate exact diagnosis/procedure coverage, including duplicates. One-way membership checks can accept a duplicate code while omitting a required comorbidity. Use exact multiset comparison or explicit uniqueness plus complete expected coverage.
- Fence completion/failure callbacks with the exact work identifier, generation and stage. An old callback must not overwrite a new retry. Scheduled backoff also needs an attempt token and due-time guard.
- Passage selection must reveal related facts and codes. Clear stale fact selection when selecting an annotation or review-question passage.
- Keep QR/modal callbacks stable: an elapsed-time rerender must not repeatedly reset modal focus.
- Regenerate Convex API types before validating backend changes. Frontend compilation alone may not cover backend test files.

A local mocked suite reached 18 passing tests, including a loop over 48 uncomplicated preset combinations. These tests were removed with the implementation; passing mocked checks did not establish clinical correctness, provider success or ticket completion. A 390×844 phone walkthrough exercised guided choices, refresh/resume, bilateral complication skipping and one submission appearing live. Model failure prevented a successful codes/evidence walkthrough.

## Clinical reference gaps

Retain the detailed source citations in [clinical preset research](cataract-preset-references.md). The nuclear preset requires explicit age-related nuclear documentation for H25.1; age alone is insufficient. Positive comorbidity choices need explicit documented disease. Glaucoma alone does not imply iris hooks.

Capsule rupture alone does not imply vitreous loss or anterior vitrectomy. The approved unilateral fixture explicitly documents the treatment. Its complete complication diagnosis/external-cause mapping and combined procedure ordering still require verification; keep final approval blocked rather than presenting partial coverage as complete. Mature/white confirmation is an approved teaching policy, not an established national requirement.
