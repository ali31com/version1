// Expected coding for supported presets, traced to references.ts entries.
// Used ONLY by deterministic checks and tests; never imported by prompt
// construction, so fixture answers stay out of model inputs.

import type { Preset, Side } from "./presets";

export type ExpectedCoding = {
  primary: string;
  secondary: string[];
  // Accepted ordered procedure groupings; the first is preferred. Each
  // grouping lists its procedure groups, and each group ends with its
  // laterality code. Laterality is omitted when the side is unresolved.
  groupings: string[][][];
  // The preferred grouping flattened.
  procedures: string[];
};

export function lateralityCode(side: Side): string {
  return { both: "Z94.1", right: "Z94.2", left: "Z94.3" }[side];
}

export function expectedCoding(preset: Preset, resolvedSide: Side | null): ExpectedCoding {
  const s = preset.selections;
  const pcr = s.complication === "pcr";
  // DCS.VII.1: documented nuclear age-related → H25.1; mature/white → H26.9.
  const primary = s.condition === "nuclear" ? "H25.1" : "H26.9";
  // DCS.XIX.7 / DCS.XX.8: capsule rupture during surgery is T81.2 with the
  // misadventure external cause Y60.0 directly after it. DGCS.3 (+ DCS.IV.1
  // / DCS.IX.1) for comorbidities; glaucoma is documented as relevant.
  const secondary = [
    pcr && "T81.2",
    pcr && "Y60.0",
    s.glaucoma && "H40.1",
    s.diabetes && "E11.9",
    s.hypertension && "I10.X",
  ].filter((c): c is string => Boolean(c));
  // PConvention 2: C75.1 → C71.2; supplementary C64.7 after the extraction;
  // the corrective vitrectomy follows (PGCS5); PCSZ2 / PRule 7: Z94 once
  // per site, last.
  const extraction = ["C75.1", "C71.2"];
  if (preset.irisHooks) extraction.push("C64.7");
  const side = preset.documentedSide ?? resolvedSide;
  let groupings: string[][][];
  if (side === "both" && pcr) {
    // Rupture in the second (left) eye. PCSZ2 does not settle whether the
    // shared procedures form one bilateral group or one group per eye, so
    // both readings are accepted (docs/research/complication-and-bilateral-coding.md).
    groupings = [
      [
        [...extraction, "Z94.2"],
        [...extraction, "C79.1", "Z94.3"],
      ],
      [
        [...extraction, "Z94.1"],
        ["C79.1", "Z94.3"],
      ],
    ];
  } else {
    const group = [...extraction];
    if (pcr) group.push("C79.1");
    if (side) group.push(lateralityCode(side));
    groupings = [[group]];
  }
  return { primary, secondary, groupings, procedures: groupings[0].flat() };
}
