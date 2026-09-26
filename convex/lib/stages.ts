// Single source for pipeline stage names, labels and who performs them.
export const PIPELINE_STAGES = [
  { stage: "packet", label: "Episode packet", role: "Deterministic" },
  { stage: "annotate", label: "MedCAT annotations", role: "Gemini Flash as MedCAT" },
  { stage: "extract", label: "Clinical facts", role: "Gemini Flash as MedGemma" },
  { stage: "retrieve", label: "Coding references", role: "Deterministic" },
  { stage: "propose", label: "Proposed codes", role: "Gemini Flash as MedGemma" },
  { stage: "resolve", label: "Open questions", role: "Deterministic" },
  { stage: "route", label: "Checks and routing", role: "Deterministic" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["stage"];

export function stageLabel(stage: string): string {
  return PIPELINE_STAGES.find((s) => s.stage === stage)?.label ?? stage;
}
