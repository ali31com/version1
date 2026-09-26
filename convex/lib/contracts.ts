// Stage output contracts and application validation of model JSON.
// Structured output constrains shape; these checks decide acceptance.

import type { Passage } from "./presets";

export type ModelStage = "annotate" | "extract" | "propose";

export const ANNOTATION_CATEGORIES = [
  "disorder",
  "procedure",
  "body structure",
  "finding",
  "substance",
  "device",
] as const;
export const ANNOTATION_STATUSES = ["affirmed", "negated", "historical", "hypothetical"] as const;
export const FACT_KINDS = [
  "diagnosis",
  "comorbidity",
  "procedure",
  "implant",
  "laterality",
  "complication",
  "other",
] as const;
export const FACT_LATERALITIES = ["left", "right", "both", "not_applicable", "unclear"] as const;
export const CONFLICT_TOPICS = ["laterality", "diagnosis", "procedure", "other"] as const;

export type Annotation = {
  id: string;
  passageId: string;
  span: string;
  start: number;
  end: number;
  concept: string;
  category: (typeof ANNOTATION_CATEGORIES)[number];
  status: (typeof ANNOTATION_STATUSES)[number];
};

export type RejectedAnnotation = { passageId: string; span: string; reason: string };

export type ClinicalFact = {
  id: string;
  kind: (typeof FACT_KINDS)[number];
  statement: string;
  passageIds: string[];
  annotationIds: string[];
  laterality: (typeof FACT_LATERALITIES)[number];
  source: "model" | "presenter";
};

export type Conflict = {
  id: string;
  topic: (typeof CONFLICT_TOPICS)[number];
  description: string;
  sides: { value: string; passageIds: string[] }[];
};

export type ProposedCode = {
  code: string;
  position?: "primary" | "secondary";
  factIds: string[];
  referenceIds: string[];
  explanation: string;
};

export type Proposal = {
  diagnoses: ProposedCode[];
  procedureGroups: { label: string; codes: ProposedCode[] }[];
  omissions: { blocked: string; reason: string }[];
};

export type AnnotateOutput = { annotations: Annotation[]; rejected: RejectedAnnotation[] };
export type ExtractOutput = { facts: ClinicalFact[]; conflicts: Conflict[] };
export type ProposeOutput = { proposal: Proposal };

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

class ContractError extends Error {}

function fail(message: string): never {
  throw new ContractError(message);
}

function obj(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}

function str(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string") fail(`${path} must be a string`);
  if (!allowEmpty && value.trim().length === 0) fail(`${path} must not be empty`);
  return value;
}

function strArr(value: unknown, path: string): string[] {
  return arr(value, path).map((v, i) => str(v, `${path}[${i}]`));
}

function oneOf<T extends string>(value: unknown, options: readonly T[], path: string): T {
  if (typeof value !== "string" || !(options as readonly string[]).includes(value)) {
    fail(`${path} must be one of ${options.join(", ")}`);
  }
  return value as T;
}

function run<T>(raw: string, parse: (json: unknown) => T): Validated<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Model output is not valid JSON." };
  }
  try {
    return { ok: true, value: parse(json) };
  } catch (e) {
    if (e instanceof ContractError) return { ok: false, error: e.message };
    throw e;
  }
}

export function validateAnnotations(raw: string, passages: Passage[]): Validated<AnnotateOutput> {
  const byId = new Map(passages.map((p) => [p.id, p]));
  return run(raw, (json) => {
    const root = obj(json, "output");
    const items = arr(root.annotations, "annotations");
    const annotations: Annotation[] = [];
    const rejected: RejectedAnnotation[] = [];
    items.forEach((item, i) => {
      const a = obj(item, `annotations[${i}]`);
      const passageId = str(a.passageId, `annotations[${i}].passageId`);
      const span = str(a.span, `annotations[${i}].span`);
      const concept = str(a.concept, `annotations[${i}].concept`);
      const category = oneOf(a.category, ANNOTATION_CATEGORIES, `annotations[${i}].category`);
      const status = oneOf(a.status, ANNOTATION_STATUSES, `annotations[${i}].status`);
      const passage = byId.get(passageId);
      if (!passage) {
        rejected.push({ passageId, span, reason: "Unknown passage ID" });
        return;
      }
      const start = passage.text.indexOf(span);
      if (start < 0) {
        rejected.push({ passageId, span, reason: "Span is not an exact substring of the passage" });
        return;
      }
      annotations.push({
        id: `a${String(annotations.length + 1).padStart(2, "0")}`,
        passageId,
        span,
        start,
        end: start + span.length,
        concept,
        category,
        status,
      });
    });
    if (annotations.length === 0) fail("No annotation had an exact span in an existing passage");
    return { annotations, rejected };
  });
}

export function validateFacts(
  raw: string,
  passages: Passage[],
  annotations: Annotation[],
): Validated<ExtractOutput> {
  const passageIds = new Set(passages.map((p) => p.id));
  const annotationIds = new Set(annotations.map((a) => a.id));
  return run(raw, (json) => {
    const root = obj(json, "output");
    const facts = arr(root.facts, "facts").map((item, i): ClinicalFact => {
      const f = obj(item, `facts[${i}]`);
      const cited = strArr(f.passageIds, `facts[${i}].passageIds`);
      if (cited.length === 0) fail(`facts[${i}] must cite at least one passage`);
      for (const id of cited) if (!passageIds.has(id)) fail(`facts[${i}] cites unknown passage ${id}`);
      const hints = strArr(f.annotationIds ?? [], `facts[${i}].annotationIds`);
      for (const id of hints) if (!annotationIds.has(id)) fail(`facts[${i}] cites unknown annotation ${id}`);
      return {
        id: `f${String(i + 1).padStart(2, "0")}`,
        kind: oneOf(f.kind, FACT_KINDS, `facts[${i}].kind`),
        statement: str(f.statement, `facts[${i}].statement`),
        passageIds: unique(cited),
        annotationIds: unique(hints),
        laterality: oneOf(f.laterality ?? "not_applicable", FACT_LATERALITIES, `facts[${i}].laterality`),
        source: "model",
      };
    });
    if (facts.length === 0) fail("No clinical facts were extracted");
    const conflicts = arr(root.conflicts ?? [], "conflicts").map((item, i): Conflict => {
      const c = obj(item, `conflicts[${i}]`);
      const sides = arr(c.sides, `conflicts[${i}].sides`).map((s, j) => {
        const side = obj(s, `conflicts[${i}].sides[${j}]`);
        const ids = strArr(side.passageIds, `conflicts[${i}].sides[${j}].passageIds`);
        if (ids.length === 0) fail(`conflicts[${i}].sides[${j}] must cite a passage`);
        for (const id of ids) if (!passageIds.has(id)) fail(`conflicts[${i}] cites unknown passage ${id}`);
        return { value: str(side.value, `conflicts[${i}].sides[${j}].value`), passageIds: unique(ids) };
      });
      if (sides.length < 2) fail(`conflicts[${i}] must preserve both sides`);
      return {
        id: `c${String(i + 1).padStart(2, "0")}`,
        topic: oneOf(c.topic, CONFLICT_TOPICS, `conflicts[${i}].topic`),
        description: str(c.description, `conflicts[${i}].description`),
        sides,
      };
    });
    return { facts, conflicts };
  });
}

// Structural validation only; evidence and clinical checks run in checks.ts
// so their failures are visible as routing reasons.
export function validateProposal(raw: string): Validated<ProposeOutput> {
  return run(raw, (json) => {
    const root = obj(json, "output");
    const code = (item: unknown, path: string, diagnosis: boolean): ProposedCode => {
      const c = obj(item, path);
      const out: ProposedCode = {
        code: str(c.code, `${path}.code`).trim().toUpperCase(),
        factIds: strArr(c.factIds, `${path}.factIds`),
        referenceIds: strArr(c.referenceIds, `${path}.referenceIds`),
        explanation: str(c.explanation, `${path}.explanation`),
      };
      if (diagnosis) out.position = oneOf(c.position, ["primary", "secondary"] as const, `${path}.position`);
      return out;
    };
    const diagnoses = arr(root.diagnoses, "diagnoses").map((d, i) => code(d, `diagnoses[${i}]`, true));
    const procedureGroups = arr(root.procedureGroups, "procedureGroups").map((g, i) => {
      const group = obj(g, `procedureGroups[${i}]`);
      return {
        label: str(group.label, `procedureGroups[${i}].label`),
        codes: arr(group.codes, `procedureGroups[${i}].codes`).map((c, j) =>
          code(c, `procedureGroups[${i}].codes[${j}]`, false),
        ),
      };
    });
    const omissions = arr(root.omissions ?? [], "omissions").map((o, i) => {
      const om = obj(o, `omissions[${i}]`);
      return { blocked: str(om.blocked, `omissions[${i}].blocked`), reason: str(om.reason, `omissions[${i}].reason`) };
    });
    if (diagnoses.length === 0) fail("Proposal has no diagnoses");
    return { proposal: { diagnoses, procedureGroups, omissions } };
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export type StageOutput =
  | ({ stage: "annotate" } & AnnotateOutput)
  | ({ stage: "extract" } & ExtractOutput)
  | ({ stage: "propose" } & ProposeOutput);

export function validateStageOutput(
  stage: ModelStage,
  raw: string,
  context: { passages: Passage[]; annotations: Annotation[] },
): Validated<StageOutput> {
  if (stage === "annotate") {
    const r = validateAnnotations(raw, context.passages);
    return r.ok ? { ok: true, value: { stage, ...r.value } } : r;
  }
  if (stage === "extract") {
    const r = validateFacts(raw, context.passages, context.annotations);
    return r.ok ? { ok: true, value: { stage, ...r.value } } : r;
  }
  const r = validateProposal(raw);
  return r.ok ? { ok: true, value: { stage, ...r.value } } : r;
}
