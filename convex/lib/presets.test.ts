import { describe, expect, test } from "vitest";
import { expectedCoding } from "./expected";
import {
  allPassages,
  audiencePreset,
  generateSourceDocument,
  teachingPreset,
  validateSelections,
  type Preset,
  type Selections,
} from "./presets";
import { buildPrompt } from "./prompts";
import { REFERENCES, referenceForCode, retrieveReferences } from "./references";

function allAudienceSelections(): Selections[] {
  const out: Selections[] = [];
  for (const side of ["left", "right", "both"] as const)
    for (const condition of ["nuclear", "mature"] as const)
      for (const complication of ["none", "pcr"] as const)
        for (const diabetes of [false, true])
          for (const hypertension of [false, true])
            for (const glaucoma of [false, true])
              out.push({ displayName: "Test", age: 72, side, condition, complication, diabetes, hypertension, glaucoma });
  return out;
}

const presets: Preset[] = [
  ...allAudienceSelections().map(audiencePreset),
  teachingPreset("teaching_contradictory_laterality"),
  teachingPreset("teaching_iris_hooks"),
];

describe("preset note generation", () => {
  test("covers every enabled audience combination", () => {
    expect(allAudienceSelections()).toHaveLength(96);
  });

  test.each(presets.map((p, i) => [i, p] as const))("preset %i is coherent and reference-covered", (_i, preset) => {
    const doc = generateSourceDocument(preset, "OPH-1001", "26 September 2026");
    const passages = allPassages(doc);
    const text = passages.map((p) => p.text).join("\n");
    // Stable, unique, sequential passage IDs.
    expect(passages.map((p) => p.id)).toEqual(passages.map((_, i) => `OPH-1001.p${String(i + 1).padStart(2, "0")}`));
    // No classification codes leak into the source note.
    expect(text).not.toMatch(/\b[A-Z]\d{2}\.[\dX]\b/);
    // Cataract type is explicit, never inferred from age.
    expect(text).toMatch(preset.selections.condition === "nuclear" ? /Age-related nuclear cataract/ : /Mature white cataract/);
    // Comorbidities are explicit when chosen and negated when not.
    expect(/Type 2 diabetes mellitus/.test(text)).toBe(preset.selections.diabetes);
    expect(/Essential hypertension/.test(text)).toBe(preset.selections.hypertension);
    expect(/Primary open-angle glaucoma/.test(text)).toBe(preset.selections.glaucoma);
    expect(/iris hooks/i.test(text)).toBe(preset.irisHooks);
    if (preset.selections.complication === "pcr") {
      expect(text).toMatch(/posterior capsule rupture/i);
      expect(text).toMatch(/vitreous prolapse/);
      expect(text).toMatch(/Anterior vitrectomy performed by an anterior \(limbal\) approach/);
      expect(text).toMatch(/ciliary sulcus .* without sutures/);
      if (preset.selections.side === "both") {
        // The rupture is in the second eye; the first eye is uncomplicated.
        expect(text).toMatch(/ciliary sulcus of the left eye/);
        expect(text).toMatch(/Right eye: .*capsular bag.*Uncomplicated\./);
      } else {
        expect(text).not.toMatch(/capsular bag/);
      }
    } else {
      expect(text).toMatch(/Complications?\b|None\./);
      expect(text).not.toMatch(/rupture|vitrectomy/i);
    }
    if (preset.selections.side === "both") expect(text).toMatch(/same operative session/);

    // Every expected code is a verified library entry, and deterministic
    // retrieval from the note text itself reaches each one.
    const expected = expectedCoding(preset, preset.documentedSide ?? "right");
    const retrieved = new Set(retrieveReferences(passages.map((p) => p.text)));
    for (const code of [expected.primary, ...expected.secondary, ...expected.procedures]) {
      const ref = referenceForCode(code);
      expect(ref, code).toBeDefined();
      expect(retrieved.has(ref!.id), `${code} retrievable`).toBe(true);
    }
  });

  test("model prompts never contain expected codes or patient header", () => {
    const preset = teachingPreset("teaching_iris_hooks");
    const doc = generateSourceDocument(preset, "OPH-1001", "26 September 2026");
    const prompt = buildPrompt({ stage: "extract", passages: allPassages(doc), annotations: [], facts: [], references: [] });
    expect(prompt).not.toMatch(/H25\.1|C75\.1|Z94/);
    expect(prompt).not.toContain(preset.selections.displayName);
  });
});

describe("golden fixtures (PRD §9.7)", () => {
  const nuclearLeft = audiencePreset({ displayName: "A", age: 89, side: "left", condition: "nuclear", complication: "none", diabetes: false, hypertension: false, glaucoma: false });
  test("OPH-0002 routine left", () => {
    expect(expectedCoding(nuclearLeft, null)).toMatchObject({ primary: "H25.1", secondary: [], procedures: ["C75.1", "C71.2", "Z94.3"] });
  });
  test("OPH-0012 comorbidities with iris hooks", () => {
    expect(expectedCoding(teachingPreset("teaching_iris_hooks"), null)).toMatchObject({
      primary: "H25.1",
      secondary: ["H40.1", "E11.9", "I10.X"],
      procedures: ["C75.1", "C71.2", "C64.7", "Z94.2"],
    });
  });
  test("OPH-0032 bilateral same session", () => {
    expect(expectedCoding({ ...nuclearLeft, selections: { ...nuclearLeft.selections, side: "both" }, documentedSide: "both" }, null).procedures).toEqual(["C75.1", "C71.2", "Z94.1"]);
  });
  test("OPH-0022 contradictory laterality withholds Z94 until clarified", () => {
    const p = teachingPreset("teaching_contradictory_laterality");
    expect(expectedCoding(p, null).procedures).toEqual(["C75.1", "C71.2"]);
    expect(expectedCoding(p, "right").procedures).toEqual(["C75.1", "C71.2", "Z94.2"]);
  });
  test("OPH-0042 mature white cataract", () => {
    expect(expectedCoding({ ...nuclearLeft, selections: { ...nuclearLeft.selections, condition: "mature" } }, null).primary).toBe("H26.9");
  });
  test("capsule rupture adds T81.2, Y60.0 and C79.1", () => {
    const p = audiencePreset({ ...nuclearLeft.selections, side: "right", complication: "pcr", diabetes: true });
    expect(expectedCoding(p, null)).toMatchObject({
      primary: "H25.1",
      secondary: ["T81.2", "Y60.0", "E11.9"],
      procedures: ["C75.1", "C71.2", "C79.1", "Z94.2"],
    });
  });
  test("bilateral capsule rupture accepts per-eye or bilateral grouping", () => {
    const p = audiencePreset({ ...nuclearLeft.selections, side: "both", complication: "pcr" });
    expect(expectedCoding(p, null).groupings).toEqual([
      [["C75.1", "C71.2", "Z94.2"], ["C75.1", "C71.2", "C79.1", "Z94.3"]],
      [["C75.1", "C71.2", "Z94.1"], ["C79.1", "Z94.3"]],
    ]);
  });
  test("every library entry has a source", () => {
    for (const r of REFERENCES) expect(r.source.length).toBeGreaterThan(0);
  });
});

describe("selection validation", () => {
  test("bilateral keeps a chosen complication", () => {
    const { selections } = validateSelections({ displayName: "B", age: 70, side: "both", condition: "nuclear", complication: "pcr", diabetes: false, hypertension: false, glaucoma: false });
    expect(selections?.complication).toBe("pcr");
  });
  test("rejects out-of-range ages and missing answers", () => {
    const { errors } = validateSelections({ displayName: "B", age: 12, side: "left" });
    expect(errors.map((e) => e.field)).toEqual(expect.arrayContaining(["age", "condition", "complication", "diabetes"]));
  });
});
