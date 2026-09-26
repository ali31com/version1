// Expected coding for supported presets, traced to references.ts entries.
// Used ONLY by deterministic checks and tests; never imported by prompt
// construction, so fixture answers stay out of model inputs.

import type { Preset, Side } from "./presets";

export type ExpectedCoding = {
  primary: string;
  secondary: string[];
  // Ordered procedure sequence. Omits laterality when the side is
  // unresolved.
  procedures: string[];
  // False when the reference gate has not verified complete coverage.
  verified: boolean;
  gaps: string[];
};

export function lateralityCode(side: Side): string {
  return { both: "Z94.1", right: "Z94.2", left: "Z94.3" }[side];
}

export function expectedCoding(preset: Preset, resolvedSide: Side | null): ExpectedCoding {
  const s = preset.selections;
  // DCS.VII.1: documented nuclear age-related → H25.1; mature/white → H26.9.
  const primary = s.condition === "nuclear" ? "H25.1" : "H26.9";
  // DGCS.3 (+ DCS.IV.1 / DCS.IX.1). Glaucoma is documented as relevant.
  const secondary = [
    s.glaucoma && "H40.1",
    s.diabetes && "E11.9",
    s.hypertension && "I10.X",
  ].filter((c): c is string => Boolean(c));
  // PConvention 2: C75.1 → C71.2; supplementary C64.7 after the extraction;
  // PCSZ2 / PRule 7: Z94 once, last.
  const procedures = ["C75.1", "C71.2"];
  if (preset.irisHooks) procedures.push("C64.7");
  if (s.complication === "pcr") procedures.push("C79.1");
  const side = preset.documentedSide ?? resolvedSide;
  if (side) procedures.push(lateralityCode(side));

  const gaps: string[] = [];
  if (s.complication === "pcr") {
    gaps.push(
      "Posterior capsule rupture diagnosis and external-cause codes are not verified in the reference library (DCS.XIX.7).",
      "The combined sequence of C75.1, C71.2 and C79.1 is not verified.",
    );
  }
  return { primary, secondary, procedures, verified: gaps.length === 0, gaps };
}
