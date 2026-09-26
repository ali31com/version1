# Agent pickup: live cataract coding demo

Status: planning approved; implementation cancelled by the owner on 26 September 2026. Start fresh from the restored React/Vite/Convex starter. The owner retained the plan, research, milestone and all nine implementation issues. This handoff preserves context; it does not authorize resuming implementation without a new request.

## Read only what the task needs

- **Implementing the demo:** [approved plan](plans/live-cataract-demo.md), then [delivery map](delivery.md) and the current issue. The plan governs scope and acceptance criteria.
- **Changing clinical presets or code checks:** [clinical reference research](research/cataract-preset-references.md). Complete issue #4 before dependent slices.
- **Choosing model or processing APIs:** [technical research](research/live-coding-demo.md) and [discarded prototype findings](research/discarded-prototype-findings.md). Recheck installed types and provider availability.
- **Understanding owner decisions:** [design interview](design/live-demo-review.md), [domain language](../CONTEXT.md) and [ADR](adr/0001-convex-and-emulated-model-roles.md).
- **Using the original proposal:** [PRD](PRD.md) is design input. Its broader pilot features and Python/PostgreSQL/SSE stack do not override the owner's approved Convex demo plan.
- **Writing Convex code:** read [generated guidelines](../convex/_generated/ai/guidelines.md) first, as required by [AGENTS.md](../AGENTS.md).

## Repository and tracker

Repository: [ali31com/version1](https://github.com/ali31com/version1). Planning branch: `codex/live-cataract-demo`. Original starter commit: `bee698f9097c8bb72bee4128bf80570d6f904f84`. This branch retains documentation and the change that makes `docs/` tracked; app source and dependencies match the starter.

[Milestone #1](https://github.com/ali31com/version1/milestone/1) contains open issues [#4–#12](delivery.md), with local ticket copies under `docs/tickets/`. Start with [#4: fixture/reference verification](https://github.com/ali31com/version1/issues/4); follow the dependency chain. None is completed. [PR #13](https://github.com/ali31com/version1/pull/13) was the cancelled implementation vehicle and contains planning commits only; it is closed without merging or closing the issues. Create a new implementation PR when asked to resume.

## Essential approved decisions

- Cataract surgery only; up to 50 participants; one submission per personal URL. One question per phone screen, usually two or three answer buttons.
- Automatic processing with presenter pause. Pause prevents new stages, lets active requests finish and accepts submissions. New demo sessions preserve earlier results.
- Gemini Flash emulates MedCAT annotations and MedGemma facts/code proposals. Show the actual provider and emulated role. Persist real stages and evidence in Convex.
- Presenter actions: inspect evidence, resolve questions, approve and retry. Keep the selected Episode steady as submissions arrive.
- Visible failure and retry; no prepared-result fallback. Target 30 seconds under normal load; measure it, including queue time to first actionable result.
- Nuclear and mature/white cataracts; left/right/both; explicit diabetes, hypertension and glaucoma documentation. Bilateral audience preset is uncomplicated. Unilateral capsule rupture includes explicit treatment and remains approval-blocked until missing coding coverage is verified.
- Include mature/white confirmation and a presenter-only contradictory-laterality review example. These are teaching policies, distinct from national standards.
- Dark presenter workspace, light paper notes and light guided phone builder. Production security, EPR integration and unrestricted code editing are outside scope.

## Starting state and known gaps

The starter contains a health page, `numbers` table and internal Gemini connectivity action. There is no demo implementation, fixture library, test suite or readiness measurement to reuse. Test-case data has been cleared and the personal development backend restored. Existing environment settings and starter data were preserved; inspect local configuration before any deployment rather than assuming a target.

The discarded prototype's live requests to `gemini-3.8-flash` all returned HTTP 503. Successful end-to-end model behavior, the 30-second target and 50-participant capacity remain unverified. Model configuration alternatives were considered but not implemented or tested. Complete complication diagnosis/external-cause mapping and combined procedure sequence are also unresolved.

## Completion bounds for a future implementation

A slice is complete only when its issue acceptance criteria are demonstrated and relevant verification is recorded. Preserve owner decisions; distinguish source-backed clinical rules from demo review policies. Expected fixture codes must stay out of model inputs. Before declaring the milestone complete, demonstrate the full phone-to-presenter evidence flow, both review examples, pause/retry/stale-output behavior and measured normal-load/burst performance. Do not close issues based on discarded prototype checks.
