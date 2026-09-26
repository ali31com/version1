import { v } from "convex/values";

export const sideV = v.union(v.literal("left"), v.literal("right"), v.literal("both"));
export const conditionV = v.union(v.literal("nuclear"), v.literal("mature"));
export const complicationV = v.union(v.literal("none"), v.literal("pcr"));

export const selectionsV = v.object({
  displayName: v.string(),
  age: v.number(),
  side: sideV,
  condition: conditionV,
  complication: complicationV,
  diabetes: v.boolean(),
  hypertension: v.boolean(),
  glaucoma: v.boolean(),
});

export const draftV = selectionsV.partial();

export const presetIdV = v.union(
  v.literal("audience"),
  v.literal("teaching_contradictory_laterality"),
  v.literal("teaching_iris_hooks"),
);

export const presetV = v.object({
  presetId: presetIdV,
  selections: selectionsV,
  documentedSide: v.union(sideV, v.null()),
  irisHooks: v.boolean(),
});

export const passageV = v.object({
  id: v.string(),
  text: v.string(),
  context: v.union(v.literal("current"), v.literal("history"), v.literal("plan")),
});

export const sourceDocumentV = v.object({
  title: v.string(),
  organisation: v.string(),
  date: v.string(),
  header: v.array(v.object({ label: v.string(), value: v.string() })),
  sections: v.array(v.object({ heading: v.string(), passages: v.array(passageV) })),
});

export const modelStageV = v.union(v.literal("annotate"), v.literal("extract"), v.literal("propose"));

export const pipelineStageV = v.union(
  v.literal("packet"),
  v.literal("annotate"),
  v.literal("extract"),
  v.literal("retrieve"),
  v.literal("propose"),
  v.literal("resolve"),
  v.literal("route"),
);

export const stageStatusV = v.union(
  v.literal("pending"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("done"),
  v.literal("failed"),
);

export const annotationV = v.object({
  id: v.string(),
  passageId: v.string(),
  span: v.string(),
  start: v.number(),
  end: v.number(),
  concept: v.string(),
  category: v.union(
    v.literal("disorder"),
    v.literal("procedure"),
    v.literal("body structure"),
    v.literal("finding"),
    v.literal("substance"),
    v.literal("device"),
  ),
  status: v.union(v.literal("affirmed"), v.literal("negated"), v.literal("historical"), v.literal("hypothetical")),
});

export const rejectedAnnotationV = v.object({ passageId: v.string(), span: v.string(), reason: v.string() });

export const factV = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("diagnosis"),
    v.literal("comorbidity"),
    v.literal("procedure"),
    v.literal("implant"),
    v.literal("laterality"),
    v.literal("complication"),
    v.literal("other"),
  ),
  statement: v.string(),
  passageIds: v.array(v.string()),
  annotationIds: v.array(v.string()),
  laterality: v.union(
    v.literal("left"),
    v.literal("right"),
    v.literal("both"),
    v.literal("not_applicable"),
    v.literal("unclear"),
  ),
  source: v.union(v.literal("model"), v.literal("presenter")),
});

export const conflictV = v.object({
  id: v.string(),
  topic: v.union(v.literal("laterality"), v.literal("diagnosis"), v.literal("procedure"), v.literal("other")),
  description: v.string(),
  sides: v.array(v.object({ value: v.string(), passageIds: v.array(v.string()) })),
});

export const proposedCodeV = v.object({
  code: v.string(),
  position: v.optional(v.union(v.literal("primary"), v.literal("secondary"))),
  factIds: v.array(v.string()),
  referenceIds: v.array(v.string()),
  explanation: v.string(),
});

export const proposalV = v.object({
  diagnoses: v.array(proposedCodeV),
  procedureGroups: v.array(v.object({ label: v.string(), codes: v.array(proposedCodeV) })),
  omissions: v.array(v.object({ blocked: v.string(), reason: v.string() })),
});

export const checkV = v.object({
  id: v.string(),
  label: v.string(),
  status: v.union(v.literal("passed"), v.literal("failed"), v.literal("blocked")),
  detail: v.string(),
});

export const stageOutputV = v.union(
  v.object({
    stage: v.literal("annotate"),
    annotations: v.array(annotationV),
    rejected: v.array(rejectedAnnotationV),
  }),
  v.object({ stage: v.literal("extract"), facts: v.array(factV), conflicts: v.array(conflictV) }),
  v.object({ stage: v.literal("propose"), proposal: proposalV }),
);

export const questionOptionV = v.object({ id: v.string(), label: v.string(), detail: v.string() });
