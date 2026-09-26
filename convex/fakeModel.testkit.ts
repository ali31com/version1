// Test-only deterministic stand-in for the Gemini stages. It produces the
// raw JSON a well-behaved model would return, so regressions exercise the
// real validation, checks and state machine without network calls. The
// file name has two dots, so Convex never deploys it.

import type { Annotation, ClinicalFact } from "./lib/contracts";
import { expectedCoding } from "./lib/expected";
import type { Passage, Preset } from "./lib/presets";
import { referenceForCode } from "./lib/references";

const CONCEPTS: [RegExp, string, Annotation["category"]][] = [
  [/Age-related nuclear cataract/, "Senile nuclear cataract", "disorder"],
  [/Mature white cataract/, "Mature cataract", "disorder"],
  [/Phacoemulsification of the nucleus|phacoemulsification of the nucleus/, "Phacoemulsification of lens", "procedure"],
  [/posterior chamber intraocular lens/, "Insertion of posterior chamber intraocular lens", "procedure"],
  [/Type 2 diabetes mellitus/, "Type 2 diabetes mellitus", "disorder"],
  [/Essential hypertension/, "Essential hypertension", "disorder"],
  [/Primary open-angle glaucoma/, "Primary open-angle glaucoma", "disorder"],
  [/iris hooks inserted|Four iris hooks/, "Insertion of iris hooks", "procedure"],
  [/posterior capsule rupture/i, "Rupture of posterior lens capsule", "disorder"],
  [/Anterior vitrectomy/, "Anterior vitrectomy", "procedure"],
  [/Laterality: (Left|Right|Both eyes)/, "Laterality", "body structure"],
  [/left eye/, "Left eye structure", "body structure"],
  [/right eye/, "Right eye structure", "body structure"],
];

export function annotateRaw(passages: Passage[]): string {
  const annotations = [];
  for (const p of passages) {
    for (const [re, concept, category] of CONCEPTS) {
      const m = p.text.match(re);
      if (m) annotations.push({ passageId: p.id, span: m[0], concept, category, status: "affirmed" });
    }
    if (p.text === "None.") {
      annotations.push({ passageId: p.id, span: "None.", concept: "No complication", category: "finding", status: "affirmed" });
    }
    const neg = p.text.match(/^No history of .+\.$/);
    if (neg) annotations.push({ passageId: p.id, span: neg[0], concept: "Negated history", category: "finding", status: "negated" });
  }
  return JSON.stringify({ annotations });
}

function find(passages: Passage[], re: RegExp): string[] {
  return passages.filter((p) => re.test(p.text)).map((p) => p.id);
}

export function extractRaw(passages: Passage[], annotations: Annotation[], preset: Preset): string {
  const hint = (ids: string[]) => annotations.filter((a) => ids.includes(a.passageId)).map((a) => a.id).slice(0, 3);
  const facts: Omit<ClinicalFact, "id" | "source">[] = [];
  const add = (kind: ClinicalFact["kind"], statement: string, ids: string[], laterality: ClinicalFact["laterality"] = "not_applicable") => {
    if (ids.length > 0) facts.push({ kind, statement, passageIds: ids, annotationIds: hint(ids), laterality });
  };
  const side = preset.documentedSide ?? "unclear";
  add("diagnosis", preset.selections.condition === "nuclear" ? "Age-related nuclear cataract." : "Mature white cataract.", find(passages, /Indication:|cataract, (left|right|both)/), side);
  add("procedure", "Lens removed by phacoemulsification.", find(passages, /[Pp]hacoemulsification of the nucleus/));
  add("implant", "Posterior chamber intraocular lens implanted without sutures.", find(passages, /intraocular lens.*without sutures/));
  add("laterality", preset.documentedSide ? `Operated side: ${preset.documentedSide}.` : "Operated eye is contradictory.", find(passages, /Laterality:|of the (left|right) eye|over the (left|right) eye/), side);
  add("complication", preset.selections.complication === "pcr" ? "Posterior capsule rupture with vitreous prolapse." : "No intra-operative complication.", find(passages, /^None\.$|posterior capsule rupture/i));
  if (preset.selections.complication === "pcr") add("procedure", "Anterior vitrectomy by an anterior approach.", find(passages, /Anterior vitrectomy performed/));
  if (preset.irisHooks) add("procedure", "Iris hooks inserted to expand a small pupil.", find(passages, /Four iris hooks/));
  if (preset.selections.diabetes) add("comorbidity", "Type 2 diabetes without documented complications.", find(passages, /Type 2 diabetes/));
  if (preset.selections.hypertension) add("comorbidity", "Diagnosed essential hypertension.", find(passages, /Essential hypertension/));
  if (preset.selections.glaucoma) add("comorbidity", "Primary open-angle glaucoma relevant to this operation.", find(passages, /Primary open-angle glaucoma/));
  const conflicts =
    preset.documentedSide === null
      ? [
          {
            topic: "laterality",
            description: "Right in the procedure details and indication; left in the operative description and discharge plan.",
            sides: [
              { value: "right", passageIds: find(passages, /Laterality: Right|right eye/) },
              { value: "left", passageIds: find(passages, /left eye/) },
            ],
          },
        ]
      : [];
  return JSON.stringify({ facts, conflicts });
}

const FACT_FOR_CODE: Record<string, string> = {
  "H25.1": "diagnosis",
  "H26.9": "diagnosis",
  "H40.1": "glaucoma",
  "E11.9": "diabetes",
  "I10.X": "hypertension",
  "C75.1": "implant",
  "C71.2": "Lens removed",
  "C64.7": "Iris hooks",
  "C79.1": "vitrectomy",
  "Z94.1": "laterality",
  "Z94.2": "laterality",
  "Z94.3": "laterality",
};

export function proposeRaw(facts: ClinicalFact[], preset: Preset): string {
  const expected = expectedCoding(preset, null);
  const cite = (code: string) => {
    const key = FACT_FOR_CODE[code];
    const fact = facts.find((f) => f.kind === key) ?? facts.find((f) => f.statement.toLowerCase().includes(key.toLowerCase()));
    return {
      code,
      factIds: fact ? [fact.id] : [],
      referenceIds: [referenceForCode(code)!.id],
      explanation: `Supported by the cited fact; ${code} applied.`,
    };
  };
  return JSON.stringify({
    diagnoses: [
      { ...cite(expected.primary), position: "primary" },
      ...expected.secondary.map((c) => ({ ...cite(c), position: "secondary" })),
    ],
    procedureGroups: [{ label: "Cataract extraction with lens implant", codes: expected.procedures.map(cite) }],
    omissions: preset.documentedSide === null ? [{ blocked: "Z94.2 or Z94.3", reason: "Operated eye conflicts" }] : [],
  });
}
