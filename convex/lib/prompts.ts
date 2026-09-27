// Prompt templates and response schemas for the three live model stages.
// Inputs are passages, accepted outputs and retrieved references only:
// no patient header, no preset selections and no expected codes.

import {
  ANNOTATION_CATEGORIES,
  ANNOTATION_STATUSES,
  CONFLICT_TOPICS,
  FACT_KINDS,
  FACT_LATERALITIES,
  type Annotation,
  type ClinicalFact,
  type ModelStage,
} from "./contracts";
import type { Passage } from "./presets";
import type { Reference } from "./references";

export const PROMPT_VERSIONS: Record<ModelStage, string> = {
  annotate: "annotate@1.0.0",
  extract: "extract@1.0.0",
  propose: "propose@1.0.0",
};

export const EMULATED_ROLE: Record<ModelStage, "MedCAT" | "MedGemma"> = {
  annotate: "MedCAT",
  extract: "MedGemma",
  propose: "MedGemma",
};

export type StageInput = {
  stage: ModelStage;
  passages: Passage[];
  annotations: Annotation[];
  facts: ClinicalFact[];
  references: Reference[];
};

function passageBlock(passages: Passage[]): string {
  return passages.map((p) => `[${p.id}] (${p.context}) ${p.text}`).join("\n");
}

export function buildPrompt(input: StageInput): string {
  switch (input.stage) {
    case "annotate":
      return [
        "You are a clinical concept annotator equivalent to MedCAT.",
        "Annotate clinical concepts in the operation note passages below: disorders, procedures, body structures, findings, substances and devices.",
        "Rules:",
        "- Return only concepts literally present in the text. `span` must be copied EXACTLY (same characters and case) from a single passage.",
        "- Use the passage ID shown in square brackets.",
        "- Mark negation (for example 'No history of diabetes' → negated), history and plans. Findings of 'None.' under Complications are an affirmed 'no complication' finding.",
        "- Prefer short, specific spans. Include laterality words (left/right/both eyes) as body structure concepts.",
        "",
        "Passages:",
        passageBlock(input.passages),
      ].join("\n");
    case "extract":
      return [
        "You are MedGemma, a clinical interpretation model, extracting clinical facts for clinical coding of one surgical Episode.",
        "Read the ORIGINAL passages; the annotations are hints only.",
        "Rules:",
        "- Each fact is one plain-English statement and must cite every passage ID that supports it.",
        "- Capture: the diagnosis treated (keep the documented type, e.g. nuclear, mature, white; never infer type from age), each procedure performed, implant details, the operated side, complications (including an explicit 'none'), and each documented comorbidity with its relevance to this operation.",
        "- Do not create facts for conditions that are negated or absent.",
        "- Set `laterality` to the side the fact concerns, or not_applicable.",
        "- If passages disagree (for example the operated eye is right in one passage and left in another), add ONE entry to `conflicts` that keeps every side with its passage IDs. Also emit a laterality fact with laterality 'unclear' citing all of them. Never pick a side yourself.",
        "- Return an empty conflicts array when the documentation is consistent.",
        "",
        "Passages:",
        passageBlock(input.passages),
        "",
        "Annotation hints (id, passage, span, concept, category, status):",
        ...input.annotations.map(
          (a) => `${a.id} ${a.passageId} "${a.span}" → ${a.concept} [${a.category}, ${a.status}]`,
        ),
      ].join("\n");
    case "propose":
      return [
        "You are MedGemma acting as a clinical coder. Propose the complete coding for this admitted-care Episode using ICD-10 5th Edition diagnoses and OPCS-4.11 procedures.",
        "You may use ONLY the codes and references listed below. Cite fact IDs and reference IDs for every code; include the code's own classification reference.",
        "Rules:",
        "- Exactly one primary diagnosis (the condition treated). Add secondary diagnoses for documented comorbidities that the standards require.",
        "- Put the procedures for one operation in one ordered procedure group; the order is the sequence. Apply the sequencing standards and code laterality once, last in the group.",
        "- When the eyes received different procedures in the same session, use one procedure group per eye, each ending with that eye's laterality code.",
        "- A documented intra-operative complication is a secondary diagnosis followed directly by its external cause; code the procedures that treated it after the main operation.",
        "- If a required code cannot be chosen because the documentation conflicts or is missing, omit it and record an omission naming what is blocked. Never guess a side.",
        "- Explanations are one or two short sentences naming the rule applied.",
        "",
        "Clinical facts:",
        ...input.facts.map(
          (f) => `${f.id} [${f.kind}; laterality ${f.laterality}] ${f.statement} (passages: ${f.passageIds.join(", ")})`,
        ),
        "",
        "Retrieved references:",
        ...input.references.map((r) =>
          [
            `${r.id}:`,
            r.code ? `${r.code} ${r.title}.` : `${r.standard ?? r.title} — ${r.title}.`,
            r.note ?? "",
            r.summary ?? "",
          ]
            .filter(Boolean)
            .join(" "),
        ),
      ].join("\n");
  }
}

const stringArray = { type: "array", items: { type: "string" } };

export function responseSchema(stage: ModelStage): Record<string, unknown> {
  switch (stage) {
    case "annotate":
      return {
        type: "object",
        properties: {
          annotations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                passageId: { type: "string" },
                span: { type: "string" },
                concept: { type: "string", description: "Preferred clinical concept name" },
                category: { type: "string", enum: [...ANNOTATION_CATEGORIES] },
                status: { type: "string", enum: [...ANNOTATION_STATUSES] },
              },
              required: ["passageId", "span", "concept", "category", "status"],
            },
          },
        },
        required: ["annotations"],
      };
    case "extract":
      return {
        type: "object",
        properties: {
          facts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: [...FACT_KINDS] },
                statement: { type: "string" },
                passageIds: stringArray,
                annotationIds: stringArray,
                laterality: { type: "string", enum: [...FACT_LATERALITIES] },
              },
              required: ["kind", "statement", "passageIds", "annotationIds", "laterality"],
            },
          },
          conflicts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topic: { type: "string", enum: [...CONFLICT_TOPICS] },
                description: { type: "string" },
                sides: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { value: { type: "string" }, passageIds: stringArray },
                    required: ["value", "passageIds"],
                  },
                },
              },
              required: ["topic", "description", "sides"],
            },
          },
        },
        required: ["facts", "conflicts"],
      };
    case "propose": {
      const code = (withPosition: boolean) => ({
        type: "object",
        properties: {
          code: { type: "string" },
          ...(withPosition ? { position: { type: "string", enum: ["primary", "secondary"] } } : {}),
          factIds: stringArray,
          referenceIds: stringArray,
          explanation: { type: "string" },
        },
        required: ["code", ...(withPosition ? ["position"] : []), "factIds", "referenceIds", "explanation"],
      });
      return {
        type: "object",
        properties: {
          diagnoses: { type: "array", items: code(true) },
          procedureGroups: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, codes: { type: "array", items: code(false) } },
              required: ["label", "codes"],
            },
          },
          omissions: {
            type: "array",
            items: {
              type: "object",
              properties: { blocked: { type: "string" }, reason: { type: "string" } },
              required: ["blocked", "reason"],
            },
          },
        },
        required: ["diagnoses", "procedureGroups", "omissions"],
      };
    }
  }
}

// Small stable hash (FNV-1a) for recording stage input identity.
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
