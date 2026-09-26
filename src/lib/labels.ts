export const PIPELINE_STAGES = [
  { stage: "packet", label: "Episode packet", short: "Packet", role: "Deterministic" },
  { stage: "annotate", label: "MedCAT annotations", short: "Annotate", role: "Gemini Flash as MedCAT" },
  { stage: "extract", label: "Clinical facts", short: "Facts", role: "Gemini Flash as MedGemma" },
  { stage: "retrieve", label: "Coding references", short: "References", role: "Deterministic" },
  { stage: "propose", label: "Proposed codes", short: "Codes", role: "Gemini Flash as MedGemma" },
  { stage: "resolve", label: "Open questions", short: "Questions", role: "Deterministic" },
  { stage: "route", label: "Checks and routing", short: "Checks", role: "Deterministic" },
] as const;

export type StageName = (typeof PIPELINE_STAGES)[number]["stage"];

export function stageLabel(stage: string): string {
  return PIPELINE_STAGES.find((s) => s.stage === stage)?.label ?? stage;
}

// Participant builder copy: precise preset descriptions (approved plan).
export const SIDE_OPTIONS = [
  { value: "left", label: "Left eye" },
  { value: "right", label: "Right eye" },
  { value: "both", label: "Both eyes", hint: "Same operative session" },
] as const;

export const CONDITION_OPTIONS = [
  { value: "nuclear", label: "Age-related nuclear cataract" },
  { value: "mature", label: "Mature or white cataract" },
] as const;

export const COMPLICATION_OPTIONS = [
  { value: "none", label: "No complication" },
  {
    value: "pcr",
    label: "Posterior capsule rupture",
    hint: "Documented with vitreous prolapse, anterior vitrectomy and an unsutured sulcus lens",
  },
] as const;

export const COMORBIDITY_QUESTIONS = [
  {
    field: "diabetes",
    title: "Type 2 diabetes?",
    description: "Type 2 diabetes treated with metformin, without documented diabetic complications. It is not recorded as the cause of the cataract.",
  },
  {
    field: "hypertension",
    title: "High blood pressure?",
    description: "Diagnosed essential hypertension, treated with amlodipine.",
  },
  {
    field: "glaucoma",
    title: "Glaucoma?",
    description: "Primary open-angle glaucoma in both eyes, documented as relevant to this operation.",
  },
] as const;
