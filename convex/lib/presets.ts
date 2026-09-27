// Episode presets: validated audience selections and presenter teaching
// fixtures, turned deterministically into a Source document with stable
// passage IDs. Presets produce the clinical note only; expected codes live
// in ./expected.ts and never reach model inputs.

export const PRESET_VERSION = "cataract-preset@1.0.0";

export const MIN_AGE = 40;
export const MAX_AGE = 100;

export type Side = "left" | "right" | "both";
export type Condition = "nuclear" | "mature";
export type Complication = "none" | "pcr";

export type Selections = {
  displayName: string;
  age: number;
  side: Side;
  condition: Condition;
  complication: Complication;
  diabetes: boolean;
  hypertension: boolean;
  glaucoma: boolean;
};

export type Draft = Partial<Selections>;

export type PresetId =
  | "audience"
  | "teaching_contradictory_laterality"
  | "teaching_iris_hooks";

export type Preset = {
  presetId: PresetId;
  selections: Selections;
  // Documented operated side after any conflict; null when the source
  // contradicts itself and needs a clarification.
  documentedSide: Side | null;
  irisHooks: boolean;
};

export type PassageContext = "current" | "history" | "plan";

export type Passage = { id: string; text: string; context: PassageContext };

export type SourceSection = { heading: string; passages: Passage[] };

export type SourceDocumentContent = {
  title: string;
  organisation: string;
  date: string;
  header: { label: string; value: string }[];
  sections: SourceSection[];
};

export type SelectionError = { field: keyof Selections; message: string };

export function validateSelections(draft: Draft): {
  selections: Selections | null;
  errors: SelectionError[];
} {
  const errors: SelectionError[] = [];
  const name = (draft.displayName ?? "").trim();
  if (name.length < 1 || name.length > 40) {
    errors.push({ field: "displayName", message: "Enter a display name of up to 40 characters." });
  }
  const age = draft.age;
  if (age === undefined || !Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
    errors.push({ field: "age", message: `Enter a whole-number age from ${MIN_AGE} to ${MAX_AGE}.` });
  }
  if (draft.side === undefined) errors.push({ field: "side", message: "Choose the operated eye." });
  if (draft.condition === undefined) errors.push({ field: "condition", message: "Choose the cataract type." });
  const complication = draft.complication;
  if (complication === undefined) {
    errors.push({ field: "complication", message: "Choose whether there was a complication." });
  }
  for (const field of ["diabetes", "hypertension", "glaucoma"] as const) {
    if (draft[field] === undefined) errors.push({ field, message: "Answer yes or no." });
  }
  if (errors.length > 0) return { selections: null, errors };
  return {
    selections: {
      displayName: name,
      age: age as number,
      side: draft.side as Side,
      condition: draft.condition as Condition,
      complication: complication as Complication,
      diabetes: draft.diabetes as boolean,
      hypertension: draft.hypertension as boolean,
      glaucoma: draft.glaucoma as boolean,
    },
    errors: [],
  };
}

export function audiencePreset(selections: Selections): Preset {
  return { presetId: "audience", selections, documentedSide: selections.side, irisHooks: false };
}

export function teachingPreset(
  kind: "teaching_contradictory_laterality" | "teaching_iris_hooks",
): Preset {
  if (kind === "teaching_contradictory_laterality") {
    return {
      presetId: kind,
      selections: {
        displayName: "Laterality teaching case",
        age: 81,
        side: "right",
        condition: "nuclear",
        complication: "none",
        diabetes: false,
        hypertension: false,
        glaucoma: false,
      },
      documentedSide: null,
      irisHooks: false,
    };
  }
  return {
    presetId: kind,
    selections: {
      displayName: "Iris hooks teaching case",
      age: 76,
      side: "right",
      condition: "nuclear",
      complication: "none",
      diabetes: true,
      hypertension: true,
      glaucoma: true,
    },
    documentedSide: "right",
    irisHooks: true,
  };
}

const EYE: Record<Side, string> = { left: "left eye", right: "right eye", both: "both eyes" };

export function scenarioSummary(preset: Preset): string {
  const s = preset.selections;
  const parts = [s.condition === "nuclear" ? "Age-related nuclear cataract" : "Mature white cataract"];
  if (s.complication === "pcr") parts.push("posterior capsule rupture");
  if (preset.irisHooks) parts.push("iris hooks");
  const comorbid = [
    s.diabetes && "T2 diabetes",
    s.hypertension && "hypertension",
    s.glaucoma && "POAG",
  ].filter(Boolean);
  if (comorbid.length > 0) parts.push(comorbid.join(", "));
  if (preset.presetId === "teaching_contradictory_laterality") parts.push("conflicting side");
  return parts.join(" · ");
}

export function lateralityLabel(preset: Preset): string {
  if (preset.documentedSide === null) return "Conflicting";
  return { left: "Left", right: "Right", both: "Bilateral" }[preset.documentedSide];
}

// Build the operation note. Fragments are fixed text per choice so that
// every enabled combination is coherent and reviewable.
export function generateSourceDocument(
  preset: Preset,
  worklistId: string,
  operationDate: string,
): SourceDocumentContent {
  const s = preset.selections;
  const sections: { heading: string; passages: [string, PassageContext][] }[] = [];
  const conflict = preset.presetId === "teaching_contradictory_laterality";
  const eye = EYE[s.side];
  const lateralityText =
    s.side === "both"
      ? "Laterality: Both eyes (immediately sequential bilateral surgery, same operative session)"
      : `Laterality: ${s.side === "left" ? "Left" : "Right"}`;
  const indication =
    s.condition === "nuclear"
      ? `Indication: Age-related nuclear cataract, ${eye}`
      : `Indication: Mature white cataract, ${eye}; vision hand movements`;

  sections.push({
    heading: "Procedure details",
    passages: [
      [`Date of surgery: ${operationDate}`, "current"],
      ["Patient class: Day case", "current"],
      [
        s.side === "both"
          ? "Procedure: Bilateral phacoemulsification with intraocular lens"
          : "Procedure: Phacoemulsification with intraocular lens",
        "current",
      ],
      [lateralityText, "current"],
      ["Anaesthesia: Topical with intracameral lidocaine", "current"],
      [indication, "current"],
    ],
  });

  const history: [string, PassageContext][] = [];
  if (s.diabetes) {
    history.push([
      "Type 2 diabetes mellitus, treated with metformin. No diabetic retinopathy or other documented diabetic complication; the cataract is not attributed to diabetes.",
      "history",
    ]);
  }
  if (s.hypertension) {
    history.push(["Essential hypertension, diagnosed in 2019 and treated with amlodipine.", "history"]);
  }
  if (s.glaucoma) {
    history.push([
      preset.irisHooks
        ? "Primary open-angle glaucoma, both eyes, on latanoprost. The surgeon links the glaucoma treatment to the small, poorly dilating pupil relevant to this operation."
        : "Primary open-angle glaucoma, both eyes, on latanoprost. Relevant to this operation: intraocular pressure checked before surgery and an early post-operative pressure review arranged.",
      "history",
    ]);
  }
  const absent = [
    !s.diabetes && "diabetes",
    !s.hypertension && "hypertension",
    !s.glaucoma && "glaucoma",
  ].filter((x): x is string => Boolean(x));
  if (absent.length > 0) {
    history.push([`No history of ${joinWords(absent)}.`, "history"]);
  }
  sections.push({ heading: "Pre-operative assessment", passages: history });

  const findings =
    s.condition === "nuclear"
      ? `Grade 3 nuclear sclerotic cataract, ${eye}.`
      : `Mature white cataract, ${eye}. No red reflex; trypan blue used to stain the anterior capsule.`;
  const pupil = preset.irisHooks
    ? "Pupil dilated poorly to 4 mm despite maximal drops."
    : "Pupil dilated well to 7 mm. Anterior chamber deep and quiet.";
  sections.push({ heading: "Operative findings", passages: [[`${findings} ${pupil}`, "current"]] });

  const performed: [string, PassageContext][] = [];
  if (s.side === "both" && s.complication === "pcr") {
    // The rupture is in the second eye: an uncomplicated first eye is what
    // allows the same-session second eye to proceed.
    performed.push([
      "Right eye operated first, then the left eye in the same operative session with a separate instrument set and fresh preparation.",
      "current",
    ]);
    performed.push([
      "Right eye: temporal 2.4 mm clear corneal incision, continuous curvilinear capsulorhexis, phacoemulsification of the nucleus and irrigation/aspiration of cortex. Single-piece hydrophobic acrylic posterior chamber intraocular lens, +21.0 D, implanted in the capsular bag without sutures. Uncomplicated.",
      "current",
    ]);
    performed.push([
      "Left eye: temporal 2.4 mm clear corneal incision, continuous curvilinear capsulorhexis, phacoemulsification of the nucleus using a stop-and-chop technique. During removal of the final nuclear fragment a posterior capsule rupture occurred, with vitreous prolapse into the anterior chamber.",
      "current",
    ]);
    performed.push([
      "Anterior vitrectomy performed by an anterior (limbal) approach; the anterior chamber was cleared of vitreous and residual cortex removed.",
      "current",
    ]);
    performed.push([
      "Anterior capsule rim assessed as providing adequate support. Three-piece posterior chamber intraocular lens, +21.5 D, placed in the ciliary sulcus of the left eye without sutures. Wounds confirmed watertight.",
      "current",
    ]);
    performed.push(["Intracameral cefuroxime given to each eye.", "current"]);
  } else if (s.side === "both") {
    performed.push([
      "Right eye operated first, then the left eye in the same operative session with a separate instrument set and fresh preparation.",
      "current",
    ]);
    performed.push([
      "Each eye: temporal 2.4 mm clear corneal incision, continuous curvilinear capsulorhexis, phacoemulsification of the nucleus and irrigation/aspiration of cortex.",
      "current",
    ]);
    performed.push([
      "Each eye: single-piece hydrophobic acrylic posterior chamber intraocular lens implanted in the capsular bag without sutures (right +21.0 D, left +21.5 D).",
      "current",
    ]);
  } else {
    if (preset.irisHooks) {
      performed.push([
        "Four iris hooks inserted through limbal stab incisions to expand the small pupil before capsulorhexis.",
        "current",
      ]);
    }
    performed.push([
      "Temporal 2.4 mm clear corneal incision. Continuous curvilinear capsulorhexis. Phacoemulsification of the nucleus using a stop-and-chop technique.",
      "current",
    ]);
    if (s.complication === "pcr") {
      performed.push([
        "During removal of the final nuclear fragment a posterior capsule rupture occurred, with vitreous prolapse into the anterior chamber.",
        "current",
      ]);
      performed.push([
        "Anterior vitrectomy performed by an anterior (limbal) approach; the anterior chamber was cleared of vitreous and residual cortex removed.",
        "current",
      ]);
      performed.push([
        `Anterior capsule rim assessed as providing adequate support. Three-piece posterior chamber intraocular lens, +20.5 D, placed in the ciliary sulcus of the ${eye} without sutures. Wounds confirmed watertight.`,
        "current",
      ]);
    } else {
      performed.push(["Irrigation/aspiration of cortex completed.", "current"]);
      performed.push([
        conflict
          ? "Single-piece hydrophobic acrylic posterior chamber intraocular lens, +22.0 D, implanted in the capsular bag of the left eye without sutures. Wounds confirmed watertight."
          : `Single-piece hydrophobic acrylic posterior chamber intraocular lens, +21.5 D, implanted in the capsular bag of the ${eye} without sutures. Wounds confirmed watertight.`,
        "current",
      ]);
      if (preset.irisHooks) {
        performed.push(["Iris hooks removed at the end of the case.", "current"]);
      }
    }
    performed.push(["Intracameral cefuroxime given.", "current"]);
  }
  sections.push({ heading: "Procedure performed", passages: performed });

  sections.push({
    heading: "Complications",
    passages: [
      s.complication === "pcr"
        ? [
            s.side === "both"
              ? "Posterior capsule rupture with vitreous loss during phacoemulsification, left eye; managed with anterior vitrectomy and sulcus intraocular lens placement. Right eye uncomplicated."
              : `Posterior capsule rupture with vitreous loss during phacoemulsification, ${eye}; managed with anterior vitrectomy and sulcus intraocular lens placement.`,
            "current",
          ]
        : ["None.", "current"],
    ],
  });

  const shieldEye = conflict ? "left eye" : eye;
  const discharge: [string, PassageContext][] = [
    [
      `Discharged the same day with post-operative drops. Clear shield to be worn over the ${shieldEye} at night for one week.`,
      "plan",
    ],
  ];
  if (s.complication === "pcr") {
    discharge.push(["Eye clinic review in one week because of the intra-operative complication.", "plan"]);
  }
  sections.push({ heading: "Discharge plan", passages: discharge });
  sections.push({
    heading: "Follow-up",
    passages: [["Routine post-operative review in 4 weeks with the community optometrist.", "plan"]],
  });

  let n = 0;
  const built: SourceSection[] = sections.map((section) => ({
    heading: section.heading,
    passages: section.passages.map(([text, context]) => {
      n += 1;
      return { id: `${worklistId}.p${String(n).padStart(2, "0")}`, text, context };
    }),
  }));

  return {
    title: "Operation note",
    organisation: "CodeGem Demo Hospital — Ophthalmology",
    date: operationDate,
    header: [
      { label: "Patient", value: `${s.displayName} (synthetic)` },
      { label: "Age", value: String(s.age) },
      { label: "Worklist ID", value: worklistId },
      { label: "Consultant", value: "Synthetic consultant ophthalmologist" },
      { label: "Specialty", value: "130 – Ophthalmology" },
    ],
    sections: built,
  };
}

export function allPassages(doc: SourceDocumentContent): Passage[] {
  return doc.sections.flatMap((s) => s.passages);
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}
