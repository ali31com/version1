// Stages 6–7: deterministic uncertainty handling, checks and routing.

import type { ClinicalFact, Conflict, Proposal, ProposedCode } from "./contracts";
import { expectedCoding } from "./expected";
import type { Passage, Preset, Side } from "./presets";
import { classificationOf, referenceForCode } from "./references";

export type CheckStatus = "passed" | "failed" | "blocked";
export type Check = { id: string; label: string; status: CheckStatus; detail: string };

export type QuestionKind = "laterality" | "diagnosis_confirmation" | "completeness" | "conflict";
export type QuestionOption = { id: string; label: string; detail: string };
export type QuestionSpec = {
  key: string;
  kind: QuestionKind;
  // Teaching policy vs evidence problem, shown to the presenter.
  basis: "teaching_policy" | "source_conflict" | "reference_gate";
  question: string;
  revisited: string;
  blocks: string;
  passageIds: string[];
  factIds: string[];
  options: QuestionOption[];
  answerable: boolean;
};

export type AnsweredQuestion = { key: string; optionId: string };

export type CheckInput = {
  preset: Preset;
  passages: Passage[];
  facts: ClinicalFact[];
  conflicts: Conflict[];
  retrievedReferenceIds: string[];
  proposal: Proposal;
  rejectedAnnotations: number;
  answers: AnsweredQuestion[];
};

const LATERALITY_CODES = ["Z94.1", "Z94.2", "Z94.3"];

export function resolvedSide(preset: Preset, answers: AnsweredQuestion[]): Side | null {
  if (preset.documentedSide) return preset.documentedSide;
  return answers.some((a) => a.key === "laterality" && a.optionId === "clarify_right") ? "right" : null;
}

function passagesMatching(passages: Passage[], pattern: RegExp): string[] {
  return passages.filter((p) => pattern.test(p.text)).map((p) => p.id);
}

function factsCiting(facts: ClinicalFact[], passageIds: string[]): string[] {
  const set = new Set(passageIds);
  return facts.filter((f) => f.passageIds.some((id) => set.has(id))).map((f) => f.id);
}

// The only audience scenario that goes to review by policy: bilateral
// surgery with a complication in a patient with diabetes or glaucoma. Every
// other audience scenario auto-codes unless a check fails.
export function isReviewScenario(preset: Preset): boolean {
  const s = preset.selections;
  return preset.presetId === "audience" && s.side === "both" && s.complication === "pcr" && (s.diabetes || s.glaucoma);
}

export function deriveQuestions(input: Omit<CheckInput, "answers" | "rejectedAnnotations">): QuestionSpec[] {
  const { preset, passages, facts, conflicts } = input;
  const questions: QuestionSpec[] = [];
  const lateralityConflicts = conflicts.filter((c) => c.topic === "laterality");

  if (lateralityConflicts.length > 0 || preset.documentedSide === null) {
    const conflictPassages = lateralityConflicts.flatMap((c) => c.sides.flatMap((s) => s.passageIds));
    const passageIds = unique([
      ...conflictPassages,
      ...passagesMatching(passages, /\b(left|right)\b/i),
    ]);
    const curated = preset.presetId === "teaching_contradictory_laterality";
    const sides = lateralityConflicts.flatMap((c) =>
      c.sides.map((s) => `${s.value} (${s.passageIds.join(", ")})`),
    );
    questions.push({
      key: "laterality",
      kind: "laterality",
      basis: "source_conflict",
      question: "Which eye was operated on?",
      revisited:
        sides.length > 0
          ? `Structured contradiction from fact extraction; every passage naming an eye is linked below. The source supports more than one side: ${sides.join("; ")}. No passage explains the difference.`
          : "Deterministic side check: passages name different eyes, but fact extraction did not record the contradiction. Every passage naming an eye is linked below.",
      blocks: "Laterality code (Z94.2 or Z94.3) cannot be assigned; PCSZ2 requires documented laterality to be coded.",
      passageIds,
      factIds: factsCiting(facts, passageIds),
      options: curated
        ? [
            {
              id: "clarify_right",
              label: "Apply surgeon clarification: right eye",
              detail:
                "Curated demo clarification: the operating surgeon confirms the right eye. Adds Z94.2 after the procedures; source text is unchanged.",
            },
          ]
        : [
            {
              id: "dismiss",
              label: "Presenter reviewed: documentation is consistent",
              detail: "Records that the presenter re-read the passages and found no contradiction.",
            },
          ],
      answerable: true,
    });
  }

  for (const c of conflicts.filter((c) => c.topic !== "laterality")) {
    const passageIds = unique(c.sides.flatMap((s) => s.passageIds));
    questions.push({
      key: `conflict:${c.id}`,
      kind: "conflict",
      basis: "source_conflict",
      question: `Resolve the ${c.topic} contradiction: ${c.description}`,
      revisited: `Sides kept: ${c.sides.map((s) => `${s.value} (${s.passageIds.join(", ")})`).join("; ")}.`,
      blocks: "Final coding cannot be approved while the contradiction is open.",
      passageIds,
      factIds: factsCiting(facts, passageIds),
      options: [
        {
          id: "dismiss",
          label: "Presenter reviewed: documentation is consistent",
          detail: "Records that the presenter re-read the passages and found no contradiction.",
        },
      ],
      answerable: true,
    });
  }

  if (isReviewScenario(preset)) {
    const s = preset.selections;
    const comorbid = joinAnd([s.diabetes && "diabetes", s.glaucoma && "glaucoma"].filter((x): x is string => Boolean(x)));
    const passageIds = passagesMatching(passages, /rupture|vitrectomy|sulcus|Right eye:|diabetes|glaucoma/i);
    questions.push({
      key: "complicated_bilateral",
      kind: "completeness",
      basis: "teaching_policy",
      question: `Confirm the coding for bilateral surgery with a posterior capsule rupture in a patient with ${comorbid}.`,
      revisited: `The left (second) eye had a posterior capsule rupture managed with anterior vitrectomy and a sulcus lens; the right eye was uncomplicated. The rupture is coded T81.2 with Y60.0 after it (DCS.XIX.7, DCS.XX.8). PCSZ2 does not settle whether the shared procedures form one bilateral group or one group per eye. The documented ${comorbid} is coded as a comorbidity, not as a cause of the rupture.`,
      blocks: "Final coding waits for presenter confirmation. Reviewing complicated bilateral surgery with diabetes or glaucoma is a demo teaching policy, not a national coding requirement.",
      passageIds,
      factIds: factsCiting(facts, passageIds),
      options: [
        {
          id: "confirm_coding",
          label: "Confirm complication and procedure grouping",
          detail: "Records the presenter's confirmation of T81.2 + Y60.0 and the proposed procedure grouping.",
        },
      ],
      answerable: true,
    });
  }
  return questions;
}

function allCodes(proposal: Proposal): ProposedCode[] {
  return [...proposal.diagnoses, ...proposal.procedureGroups.flatMap((g) => g.codes)];
}

export function runChecks(input: CheckInput): Check[] {
  const { preset, facts, conflicts, proposal } = input;
  const checks: Check[] = [];
  const codes = allCodes(proposal);
  const factIds = new Set(facts.map((f) => f.id));
  const retrieved = new Set(input.retrievedReferenceIds);

  checks.push({
    id: "C1",
    label: "Output format",
    status: "passed",
    detail:
      "Annotation, fact and proposal outputs passed schema and evidence-ID validation." +
      (input.rejectedAnnotations > 0
        ? ` ${input.rejectedAnnotations} annotation hint(s) with inexact spans were rejected.`
        : ""),
  });

  const unknown = codes.filter((c) => !referenceForCode(c.code));
  const wrongClass = [
    ...proposal.diagnoses.filter((c) => referenceForCode(c.code) && classificationOf(c.code) !== "ICD-10"),
    ...proposal.procedureGroups
      .flatMap((g) => g.codes)
      .filter((c) => referenceForCode(c.code) && classificationOf(c.code) !== "OPCS-4"),
  ];
  checks.push({
    id: "C2",
    label: "Catalogue membership",
    status: unknown.length === 0 && wrongClass.length === 0 ? "passed" : "failed",
    detail:
      unknown.length > 0
        ? `Not in the demo catalogue: ${unknown.map((c) => c.code).join(", ")}.`
        : wrongClass.length > 0
          ? `Wrong classification for its role: ${wrongClass.map((c) => c.code).join(", ")}.`
          : "Every code is in the loaded ICD-10/OPCS-4 demo catalogue with a matching role.",
  });

  const evidenceProblems: string[] = [];
  for (const c of codes) {
    if (c.factIds.length === 0) evidenceProblems.push(`${c.code} cites no fact`);
    for (const id of c.factIds) if (!factIds.has(id)) evidenceProblems.push(`${c.code} cites missing fact ${id}`);
    if (c.referenceIds.length === 0) evidenceProblems.push(`${c.code} cites no reference`);
    for (const id of c.referenceIds) {
      if (!retrieved.has(id)) evidenceProblems.push(`${c.code} cites unretrieved reference ${id}`);
    }
    const own = referenceForCode(c.code);
    if (own && !c.referenceIds.includes(own.id)) evidenceProblems.push(`${c.code} omits its classification reference`);
  }
  checks.push({
    id: "C3",
    label: "Evidence references",
    status: evidenceProblems.length === 0 ? "passed" : "failed",
    detail:
      evidenceProblems.length === 0
        ? "Every code cites at least one existing fact and retrieved references, including its own classification entry."
        : `${evidenceProblems.slice(0, 4).join("; ")}.`,
  });

  const seqProblems: string[] = [];
  // A code may repeat across procedure groups (the same operation on each
  // eye), never within one group or among the diagnoses.
  for (const list of [proposal.diagnoses.map((c) => c.code), ...proposal.procedureGroups.map((g) => g.codes.map((c) => c.code))]) {
    for (const code of list.filter((c, i) => list.indexOf(c) !== i)) seqProblems.push(`${code} appears more than once`);
  }
  for (const g of proposal.procedureGroups) {
    const list = g.codes.map((c) => c.code);
    if (list.length > 0 && /^[YZ]/.test(list[0])) seqProblems.push(`PRule 7: ${list[0]} cannot be primary`);
    const i75 = list.findIndex((c) => c.startsWith("C75"));
    const i71 = list.findIndex((c) => /^C7[1-4]/.test(c));
    if (i75 >= 0 && i71 >= 0 && i71 < i75) seqProblems.push("PConvention 2: C75.1 must precede the extraction code");
    if (i75 >= 0 && i71 < 0) seqProblems.push("C75 requires a supplementary extraction code (C71–C74)");
    const iHooks = list.indexOf("C64.7");
    if (iHooks >= 0 && i71 >= 0 && iHooks < i71) seqProblems.push("C64.7 is supplementary and must follow the extraction code");
    const zs = list.filter((c) => LATERALITY_CODES.includes(c));
    if (zs.length > 1) seqProblems.push("PCSZ2: laterality is coded once per site");
    if (zs.length === 1 && !LATERALITY_CODES.includes(list[list.length - 1])) {
      seqProblems.push("PCSZ2: laterality must follow all procedures on the site");
    }
  }
  checks.push({
    id: "C4",
    label: "Sequencing",
    status: seqProblems.length === 0 ? "passed" : "failed",
    detail: seqProblems.length === 0 ? "C75.1 precedes C71.2, supplementary codes follow, laterality is last and coded once." : `${seqProblems.join("; ")}.`,
  });

  const side = resolvedSide(preset, input.answers);
  const expected = expectedCoding(preset, side);
  const groupCodes = proposal.procedureGroups.map((g) => g.codes.map((c) => c.code));
  const grouping = expected.groupings.find((gr) => sameGroups(gr, groupCodes)) ?? expected.groupings[0];
  const zCodes = groupCodes.flat().filter((c) => LATERALITY_CODES.includes(c));
  let lateralityStatus: CheckStatus = "passed";
  let lateralityDetail: string;
  if (side) {
    const accepted = expected.groupings.map((gr) => gr.flat().filter((c) => LATERALITY_CODES.includes(c)));
    const wanted = grouping.flat().filter((c) => LATERALITY_CODES.includes(c)).join(" + ");
    const sideText = side === "both" ? "bilateral" : `${side}-sided`;
    if (accepted.some((z) => z.length === zCodes.length && multisetMinus(z, zCodes).length === 0)) {
      lateralityDetail = `${zCodes.join(" + ")} agree${zCodes.length > 1 ? "" : "s"} with the documented ${sideText} operation${preset.documentedSide ? "" : " (presenter clarification)"}.`;
    } else {
      lateralityStatus = "failed";
      lateralityDetail =
        zCodes.length === 0
          ? `Documented ${sideText} operation but no laterality code; expected ${wanted}.`
          : `Laterality ${zCodes.join(", ")} disagrees with the documented side (expected ${wanted}).`;
    }
  } else if (zCodes.length > 0) {
    lateralityStatus = "failed";
    lateralityDetail = `${zCodes.join(", ")} was assigned although the source documents conflicting sides.`;
  } else {
    lateralityDetail = "Side is contradictory in the source; laterality is correctly withheld pending an Open question.";
  }
  checks.push({ id: "C5", label: "Laterality agreement", status: lateralityStatus, detail: lateralityDetail });

  const primaries = proposal.diagnoses.filter((d) => d.position === "primary");
  checks.push({
    id: "C6",
    label: "Primary diagnosis",
    status: primaries.length === 1 ? "passed" : "failed",
    detail:
      primaries.length === 1
        ? `${primaries[0].code} is the single primary diagnosis.`
        : `Expected exactly one primary diagnosis; found ${primaries.length}.`,
  });

  const coverage: string[] = [];
  const primary = primaries[0]?.code;
  if (primary !== expected.primary) coverage.push(`primary should be ${expected.primary}${primary ? `, not ${primary}` : ""}`);
  const secondary = proposal.diagnoses.filter((d) => d.position === "secondary").map((d) => d.code);
  const missingSecondary = multisetMinus(expected.secondary, secondary);
  const extraSecondary = multisetMinus(secondary, expected.secondary);
  if (missingSecondary.length) coverage.push(`missing secondary diagnosis ${missingSecondary.join(", ")}`);
  if (extraSecondary.length) coverage.push(`unsupported diagnosis ${extraSecondary.join(", ")}`);
  const procedures = groupCodes.flat();
  const wantedProcedures = grouping.flat();
  const missingProc = multisetMinus(wantedProcedures, procedures);
  const extraProc = multisetMinus(procedures, wantedProcedures);
  if (missingProc.length) coverage.push(`missing procedure ${missingProc.join(", ")}`);
  if (extraProc.length) coverage.push(`unexpected procedure ${extraProc.join(", ")}`);
  if (missingProc.length === 0 && extraProc.length === 0 && !sameGroups(grouping, groupCodes)) {
    coverage.push(`procedure sequence should be ${grouping.map((g) => g.join(" → ")).join("; ")}`);
  }
  const coverageStatus: CheckStatus = coverage.length === 0 ? "passed" : "failed";
  const coverageDetail =
    coverage.length === 0
      ? "Diagnoses, comorbidities and ordered procedures match the verified coverage for this supported scenario."
      : `Supported-scenario coverage: ${coverage.join("; ")}.`;
  checks.push({ id: "C7", label: "Supported-scenario coverage", status: coverageStatus, detail: coverageDetail });

  const lateralityConflict = conflicts.some((c) => c.topic === "laterality");
  checks.push({
    id: "C8",
    label: "Contradictions recorded",
    status: preset.documentedSide === null && !lateralityConflict ? "failed" : "passed",
    detail:
      preset.documentedSide === null && !lateralityConflict
        ? "The source names different operated eyes but no structured contradiction was extracted."
        : conflicts.length > 0
          ? `${conflicts.length} structured contradiction(s) kept with both sides and routed to an Open question.`
          : "No contradictions in the source; none recorded.",
  });
  return checks;
}

export function routeResult(
  checks: Check[],
  questions: { question: string; status: "unresolved" | "answered" }[],
): { value: "auto_coded" | "sent_to_review"; reason: string } {
  const failing = checks.filter((c) => c.status !== "passed");
  if (failing.length === 0 && questions.length === 0) {
    return {
      value: "auto_coded",
      reason:
        "All checks passed and no Open question remains: the condition, operation, side and documented comorbidities are consistent, and every code is supported by a fact and a reference.",
    };
  }
  const parts: string[] = [];
  if (questions.length > 0) parts.push(`${questions.length} Open question${questions.length > 1 ? "s" : ""}: ${questions.map((q) => q.question).join(" ")}`);
  if (failing.length > 0) parts.push(`Checks not passed: ${failing.map((c) => `${c.id} ${c.label}`).join(", ")}.`);
  return { value: "sent_to_review", reason: parts.join(" ") };
}

// References cited by the laterality amendment (right-side code, laterality
// standard, Chapter Z secondary-only rule).
export const CLARIFICATION_REFERENCE_IDS = ["opcs:Z94.2", "std:PCSZ2", "std:PRule7"];

// Bounded, verified amendment after the curated laterality clarification:
// append the right-side code to the lens group. Source evidence is kept.
export function applyLateralityClarification(proposal: Proposal, presenterFactId: string): Proposal {
  const groups = proposal.procedureGroups.map((g) => ({ ...g, codes: g.codes.filter((c) => !LATERALITY_CODES.includes(c.code)) }));
  const target = groups.find((g) => g.codes.some((c) => c.code.startsWith("C75"))) ?? groups[0];
  if (!target) return proposal;
  target.codes.push({
    code: "Z94.2",
    factIds: [presenterFactId],
    referenceIds: CLARIFICATION_REFERENCE_IDS,
    explanation: "Presenter applied the surgeon's clarification (right eye); laterality coded once, after the procedures on that site.",
  });
  target.label = target.label.replace(/\s*\(eye unresolved\)/i, "") + " — right eye (clarified)";
  return { ...proposal, procedureGroups: groups };
}

function multisetMinus(a: string[], b: string[]): string[] {
  const counts = new Map<string, number>();
  for (const x of b) counts.set(x, (counts.get(x) ?? 0) + 1);
  const out: string[] = [];
  for (const x of a) {
    const n = counts.get(x) ?? 0;
    if (n > 0) counts.set(x, n - 1);
    else out.push(x);
  }
  return out;
}

// Same procedure groups, each in order; the groups themselves may come in
// any order.
function sameGroups(expected: string[][], actual: string[][]): boolean {
  const key = (g: string[]) => g.join(",");
  return expected.length === actual.length && multisetMinus(expected.map(key), actual.map(key)).length === 0;
}

function joinAnd(words: string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
