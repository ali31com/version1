import { describe, expect, test } from "vitest";
import { annotateRaw, extractRaw, proposeRaw } from "../fakeModel.testkit";
import { applyLateralityClarification, deriveQuestions, routeResult, runChecks, type AnsweredQuestion } from "./checks";
import { validateAnnotations, validateFacts, validateProposal, type Proposal } from "./contracts";
import { allPassages, audiencePreset, generateSourceDocument, teachingPreset, type Preset } from "./presets";
import { retrieveReferences } from "./references";

function pipeline(preset: Preset, mutate?: (p: Proposal) => Proposal, answers: AnsweredQuestion[] = []) {
  const passages = allPassages(generateSourceDocument(preset, "OPH-1001", "26 September 2026"));
  const a = validateAnnotations(annotateRaw(passages), passages);
  if (!a.ok) throw new Error(a.error);
  const f = validateFacts(extractRaw(passages, a.value.annotations, preset), passages, a.value.annotations);
  if (!f.ok) throw new Error(f.error);
  const retrievedReferenceIds = retrieveReferences(f.value.facts.map((x) => x.statement).concat(passages.map((p) => p.text)));
  const pr = validateProposal(proposeRaw(f.value.facts, preset));
  if (!pr.ok) throw new Error(pr.error);
  const proposal = mutate ? mutate(pr.value.proposal) : pr.value.proposal;
  const base = { preset, passages, facts: f.value.facts, conflicts: f.value.conflicts, retrievedReferenceIds, proposal };
  const questions = deriveQuestions(base);
  const checks = runChecks({ ...base, rejectedAnnotations: 0, answers });
  return { questions, checks, route: routeResult(checks, questions.map((q) => ({ question: q.question, status: "unresolved" as const }))), base };
}

const routine = audiencePreset({ displayName: "A", age: 89, side: "left", condition: "nuclear", complication: "none", diabetes: false, hypertension: false, glaucoma: false });

describe("routing", () => {
  test("routine unilateral auto-codes", () => {
    const r = pipeline(routine);
    expect(r.checks.filter((c) => c.status !== "passed")).toEqual([]);
    expect(r.route.value).toBe("auto_coded");
  });
  test("iris hooks with comorbidities auto-codes", () => {
    expect(pipeline(teachingPreset("teaching_iris_hooks")).route.value).toBe("auto_coded");
  });
  test("bilateral with all comorbidities auto-codes", () => {
    const p = audiencePreset({ ...routine.selections, side: "both", diabetes: true, hypertension: true, glaucoma: true });
    expect(pipeline(p).route.value).toBe("auto_coded");
  });
  test("mature white routes to a teaching confirmation", () => {
    const r = pipeline(audiencePreset({ ...routine.selections, condition: "mature" }));
    expect(r.route.value).toBe("sent_to_review");
    expect(r.questions.map((q) => [q.kind, q.basis])).toEqual([["diagnosis_confirmation", "teaching_policy"]]);
    expect(r.checks.every((c) => c.status === "passed")).toBe(true);
  });
  test("contradictory laterality withholds Z94 and resolves with the curated clarification", () => {
    const preset = teachingPreset("teaching_contradictory_laterality");
    const r = pipeline(preset);
    expect(r.route.value).toBe("sent_to_review");
    const q = r.questions.find((x) => x.kind === "laterality")!;
    expect(q.options.map((o) => o.id)).toEqual(["clarify_right"]);
    expect(r.checks.find((c) => c.id === "C5")!.status).toBe("passed");
    const amended = applyLateralityClarification(r.base.proposal, "f90");
    const facts = [...r.base.facts, { id: "f90", kind: "laterality" as const, statement: "right", passageIds: q.passageIds, annotationIds: [], laterality: "right" as const, source: "presenter" as const }];
    const checks = runChecks({ ...r.base, facts, proposal: amended, retrievedReferenceIds: [...r.base.retrievedReferenceIds, "opcs:Z94.2"], rejectedAnnotations: 0, answers: [{ key: "laterality", optionId: "clarify_right" }] });
    expect(checks.filter((c) => c.status !== "passed")).toEqual([]);
    expect(amended.procedureGroups[0].codes.map((c) => c.code)).toEqual(["C75.1", "C71.2", "Z94.2"]);
  });
  test("capsule rupture is sent to review with an unanswerable completeness question", () => {
    const r = pipeline(audiencePreset({ ...routine.selections, complication: "pcr" }));
    expect(r.route.value).toBe("sent_to_review");
    const q = r.questions.find((x) => x.kind === "completeness")!;
    expect(q.answerable).toBe(false);
    expect(r.checks.find((c) => c.id === "C7")!.status).toBe("blocked");
  });
});

describe("checks catch wrong proposals", () => {
  const codesOf = (p: Proposal) => p.procedureGroups[0].codes;
  test("wrong sequence", () => {
    const r = pipeline(routine, (p) => ({ ...p, procedureGroups: [{ label: "x", codes: [codesOf(p)[1], codesOf(p)[0], codesOf(p)[2]] }] }));
    expect(r.checks.find((c) => c.id === "C4")!.status).toBe("failed");
    expect(r.route.value).toBe("sent_to_review");
  });
  test("wrong side", () => {
    const r = pipeline(routine, (p) => ({ ...p, procedureGroups: [{ label: "x", codes: codesOf(p).map((c) => (c.code === "Z94.3" ? { ...c, code: "Z94.2", referenceIds: ["opcs:Z94.2"] } : c)) }] }));
    expect(r.checks.find((c) => c.id === "C5")!.status).toBe("failed");
  });
  test("duplicate code while omitting a comorbidity", () => {
    const preset = audiencePreset({ ...routine.selections, diabetes: true });
    const r = pipeline(preset, (p) => ({ ...p, diagnoses: [p.diagnoses[0], { ...p.diagnoses[0], position: "secondary" }] }));
    const failed = r.checks.filter((c) => c.status === "failed").map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(["C4", "C7"]));
  });
  test("unsupported code and missing evidence", () => {
    const r = pipeline(routine, (p) => ({ ...p, diagnoses: [...p.diagnoses, { code: "H25.9", position: "secondary", factIds: [], referenceIds: [], explanation: "x" }] }));
    const failed = r.checks.filter((c) => c.status === "failed").map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(["C2", "C3", "C7"]));
  });
  test("two primaries", () => {
    const r = pipeline(routine, (p) => ({ ...p, diagnoses: [p.diagnoses[0], { ...p.diagnoses[0], code: "H26.9", referenceIds: ["icd:H26.9"] }] }));
    expect(r.checks.find((c) => c.id === "C6")!.status).toBe("failed");
  });
});

describe("output validation", () => {
  const passages = allPassages(generateSourceDocument(routine, "OPH-1001", "d"));
  test("inexact spans are rejected individually", () => {
    const r = validateAnnotations(JSON.stringify({ annotations: [
      { passageId: passages[5].id, span: "Age-related nuclear cataract", concept: "c", category: "disorder", status: "affirmed" },
      { passageId: passages[5].id, span: "age related", concept: "c", category: "disorder", status: "affirmed" },
      { passageId: "nope", span: "x", concept: "c", category: "disorder", status: "affirmed" },
    ] }), passages);
    expect(r.ok && r.value.annotations.length).toBe(1);
    expect(r.ok && r.value.rejected.length).toBe(2);
    expect(r.ok && r.value.annotations[0].start).toBe(passages[5].text.indexOf("Age-related"));
  });
  test("facts citing unknown passages fail the attempt", () => {
    const r = validateFacts(JSON.stringify({ facts: [{ kind: "diagnosis", statement: "x", passageIds: ["OPH-9.p01"], annotationIds: [], laterality: "left" }], conflicts: [] }), passages, []);
    expect(r.ok).toBe(false);
  });
  test("one-sided conflicts fail the attempt", () => {
    const r = validateFacts(JSON.stringify({ facts: [{ kind: "diagnosis", statement: "x", passageIds: [passages[0].id], annotationIds: [], laterality: "left" }], conflicts: [{ topic: "laterality", description: "x", sides: [{ value: "left", passageIds: [passages[0].id] }] }] }), passages, []);
    expect(r.ok).toBe(false);
  });
  test("non-JSON fails", () => {
    expect(validateProposal("not json").ok).toBe(false);
  });
});
