export { PIPELINE_STAGES, stageLabel } from "../../convex/lib/stages";

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
