export { PIPELINE_STAGES, stageLabel } from "../../convex/lib/stages";

// Participant builder copy.
export const SIDE_OPTIONS = [
  { value: "left", label: "Left eye" },
  { value: "right", label: "Right eye" },
  { value: "both", label: "Both eyes" },
] as const;

export const CONDITION_OPTIONS = [
  { value: "nuclear", label: "Age-related nuclear cataract" },
  { value: "mature", label: "Mature or white cataract" },
] as const;

export const COMPLICATION_OPTIONS = [
  { value: "none", label: "No complication" },
  { value: "pcr", label: "Posterior capsule rupture" },
] as const;

export const COMORBIDITY_QUESTIONS = [
  { field: "diabetes", title: "Type 2 diabetes?" },
  { field: "hypertension", title: "High blood pressure?" },
  { field: "glaucoma", title: "Glaucoma?" },
] as const;
