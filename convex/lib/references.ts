// Curated, versioned coding reference library for the cataract demo.
// Sources and verification status are recorded in
// docs/research/cataract-preset-references.md and
// docs/research/complication-and-bilateral-coding.md. This is a narrow demo
// catalogue, not a full TRUD release.

export const REFERENCE_LIBRARY_VERSION =
  "cataract-refs@2026-09-27.1 (ICD-10 5th Ed 2026 · OPCS-4.11 · NCCS 2026)";

export type Classification = "ICD-10" | "OPCS-4";

export type Reference = {
  id: string;
  kind: "classification" | "standard";
  source: string;
  title: string;
  code?: string;
  classification?: Classification;
  note?: string;
  standard?: string;
  summary?: string;
  page?: string;
  url?: string;
  // Terms matched against extracted facts during deterministic retrieval.
  keywords: string[];
};

const ICD_SOURCE = "ICD-10 5th Edition (2026)";
const OPCS_SOURCE = "OPCS-4.11";
const NCCS_ICD = "NCCS ICD-10 2026 [V12.0]";
const NCCS_OPCS = "NCCS OPCS-4 2026 [V13.1]";
const ICD_LENS_URL =
  "https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol1/block-h25-h28.htm";
const ICD_GLAUCOMA_URL =
  "https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol1/block-h40-h42.htm";
const ICD_INJURY_URL =
  "https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol1/block-t80-t88.htm";
const ICD_MISADVENTURE_URL =
  "https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol1/block-y60-y69.htm";
const OPCS_C_URL = "https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-1.html";
const OPCS_Z_URL = "https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-9.html";
const NCCS_ICD_URL =
  "https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf";
const NCCS_OPCS_URL =
  "https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf";

export const REFERENCES: Reference[] = [
  {
    id: "icd:H25.1",
    kind: "classification",
    source: ICD_SOURCE,
    classification: "ICD-10",
    code: "H25.1",
    title: "Senile nuclear cataract",
    note: "Nuclear subtype must be documented; generic age-related cataract does not establish it.",
    url: ICD_LENS_URL,
    keywords: ["nuclear", "age-related", "senile", "cataract"],
  },
  {
    id: "icd:H26.9",
    kind: "classification",
    source: ICD_SOURCE,
    classification: "ICD-10",
    code: "H26.9",
    title: "Cataract, unspecified",
    url: ICD_LENS_URL,
    keywords: ["mature", "white", "cataract"],
  },
  {
    id: "icd:H40.1",
    kind: "classification",
    source: ICD_SOURCE,
    classification: "ICD-10",
    code: "H40.1",
    title: "Primary open-angle glaucoma",
    note: "Unspecified glaucoma is H40.9; open-angle disease must be documented.",
    url: ICD_GLAUCOMA_URL,
    keywords: ["glaucoma", "open-angle"],
  },
  {
    id: "icd:E11.9",
    kind: "classification",
    source: ICD_SOURCE,
    classification: "ICD-10",
    code: "E11.9",
    title: "Non-insulin-dependent diabetes mellitus without complications",
    keywords: ["diabetes", "diabetic"],
  },
  {
    id: "icd:I10.X",
    kind: "classification",
    source: ICD_SOURCE,
    classification: "ICD-10",
    code: "I10.X",
    title: "Essential (primary) hypertension",
    keywords: ["hypertension", "hypertensive", "blood pressure"],
  },
  {
    id: "icd:T81.2",
    kind: "classification",
    source: ICD_SOURCE,
    classification: "ICD-10",
    code: "T81.2",
    title: "Accidental puncture and laceration during a procedure, not elsewhere classified",
    note: "Index: Complications → surgical procedure → accidental puncture or laceration. Posterior capsule rupture has no index entry of its own; the eye postprocedural codes H59.8/H59.9 are not used when a specific code exists.",
    url: ICD_INJURY_URL,
    keywords: ["rupture", "perforation", "laceration"],
  },
  {
    id: "icd:Y60.0",
    kind: "classification",
    source: ICD_SOURCE,
    classification: "ICD-10",
    code: "Y60.0",
    title: "Unintentional cut, puncture, perforation or haemorrhage during surgical operation",
    note: "External cause for a misadventure during surgery; sequenced directly after the code describing the result. Y83.- applies only with no mention of misadventure.",
    url: ICD_MISADVENTURE_URL,
    keywords: ["rupture", "misadventure"],
  },
  {
    id: "opcs:C75.1",
    kind: "classification",
    source: OPCS_SOURCE,
    classification: "OPCS-4",
    code: "C75.1",
    title: "Insertion of prosthetic replacement for lens NEC",
    note: "C75 Prosthesis of lens: Use a supplementary code to identify method of concurrent extraction of lens (C71–C74). Includes insertion without sutures.",
    url: OPCS_C_URL,
    keywords: ["lens", "intraocular", "iol", "implant", "sulcus"],
  },
  {
    id: "opcs:C71.2",
    kind: "classification",
    source: OPCS_SOURCE,
    classification: "OPCS-4",
    code: "C71.2",
    title: "Phacoemulsification of lens",
    note: "C71 Extracapsular extraction of lens: Use as an additional code when associated with concurrent insertion of prosthetic replacement for lens (C75.1).",
    url: OPCS_C_URL,
    keywords: ["phaco", "phacoemulsification", "extraction"],
  },
  {
    id: "opcs:C64.7",
    kind: "classification",
    source: OPCS_SOURCE,
    classification: "OPCS-4",
    code: "C64.7",
    title: "Insertion of iris hooks",
    note: "Use as a supplementary code when associated with concurrent extraction of lens (C71–C74).",
    url: OPCS_C_URL,
    keywords: ["iris hook", "iris hooks", "pupil expansion"],
  },
  {
    id: "opcs:C79.1",
    kind: "classification",
    source: OPCS_SOURCE,
    classification: "OPCS-4",
    code: "C79.1",
    title: "Vitrectomy using anterior approach",
    note: "C79.2 is pars plana vitrectomy and includes unspecified vitrectomy; the anterior approach must be documented.",
    url: OPCS_C_URL,
    keywords: ["vitrectomy", "vitreous"],
  },
  {
    id: "opcs:Z94.1",
    kind: "classification",
    source: OPCS_SOURCE,
    classification: "OPCS-4",
    code: "Z94.1",
    title: "Bilateral operation",
    url: OPCS_Z_URL,
    keywords: ["laterality", "bilateral", "both eyes"],
  },
  {
    id: "opcs:Z94.2",
    kind: "classification",
    source: OPCS_SOURCE,
    classification: "OPCS-4",
    code: "Z94.2",
    title: "Right sided operation",
    url: OPCS_Z_URL,
    keywords: ["laterality", "right"],
  },
  {
    id: "opcs:Z94.3",
    kind: "classification",
    source: OPCS_SOURCE,
    classification: "OPCS-4",
    code: "Z94.3",
    title: "Left sided operation",
    url: OPCS_Z_URL,
    keywords: ["laterality", "left"],
  },
  {
    id: "std:DGCS.1",
    kind: "standard",
    source: NCCS_ICD,
    standard: "DGCS.1",
    title: "Primary diagnosis",
    summary:
      "The primary diagnosis is the main condition treated or investigated during the Episode.",
    page: "34",
    url: NCCS_ICD_URL,
    keywords: ["cataract"],
  },
  {
    id: "std:DGCS.3",
    kind: "standard",
    source: NCCS_ICD,
    standard: "DGCS.3",
    title: "Comorbidities and Appendix 1 comorbidities list",
    summary:
      "Appendix 1 conditions (including diabetes mellitus and hypertension) must always be coded when documented, including for day cases. Other conditions are coded when documented as relevant to the Episode.",
    page: "36",
    url: NCCS_ICD_URL,
    keywords: ["diabetes", "hypertension", "glaucoma", "comorbidity"],
  },
  {
    id: "std:DCS.IV.1",
    kind: "standard",
    source: NCCS_ICD,
    standard: "DCS.IV.1",
    title: "Diabetes mellitus fourth characters",
    summary:
      "Fourth characters .0–.8 are used only when the record clearly states a condition is due to diabetes; otherwise use .9.",
    page: "81",
    url: NCCS_ICD_URL,
    keywords: ["diabetes", "diabetic"],
  },
  {
    id: "std:DCS.VII.1",
    kind: "standard",
    source: NCCS_ICD,
    standard: "DCS.VII.1",
    title: "Cataract",
    summary:
      "Age-related cataract is coded to H25.-. Mature, advanced or white cataract is coded to H26.9 Cataract, unspecified, even when the patient is elderly.",
    page: "100",
    url: NCCS_ICD_URL,
    keywords: ["cataract", "mature", "white", "nuclear", "age-related"],
  },
  {
    id: "std:DCS.IX.1",
    kind: "standard",
    source: NCCS_ICD,
    standard: "DCS.IX.1",
    title: "Hypertension",
    summary:
      "Hypertension is coded only when the patient has been diagnosed as hypertensive.",
    page: "103",
    url: NCCS_ICD_URL,
    keywords: ["hypertension", "hypertensive"],
  },
  {
    id: "std:DCS.XIX.7",
    kind: "standard",
    source: NCCS_ICD,
    standard: "DCS.XIX.7",
    title: "Complications of surgical and medical care",
    summary:
      "A procedural complication is coded only when documented as such, and always with an external cause code (Y40–Y84) after it. A body-system postprocedural .8/.9 code is not used when the index leads to a specific code: posterior capsule rupture during surgery is T81.2.",
    page: "201–203",
    url: NCCS_ICD_URL,
    keywords: ["complication", "rupture", "capsule", "vitreous"],
  },
  {
    id: "std:DCS.XX.8",
    kind: "standard",
    source: NCCS_ICD,
    standard: "DCS.XX.8",
    title: "Misadventure during surgical and medical care",
    summary:
      "Misadventure during a procedure takes a Y60–Y69 code in a secondary position after the code describing its result (for example T81.2 then Y60.0). It does not imply a mistake by the consultant.",
    page: "224",
    url: NCCS_ICD_URL,
    keywords: ["rupture", "misadventure", "complication"],
  },
  {
    id: "std:PConvention2",
    kind: "standard",
    source: NCCS_OPCS,
    standard: "PConvention 2",
    title: "Sequencing of paired codes",
    summary:
      "A code carrying 'Use a supplementary code' takes the primary position; a code carrying 'Use as a supplementary/additional code' follows it. C75.1 therefore precedes C71.2.",
    page: "31",
    url: NCCS_OPCS_URL,
    keywords: ["lens", "phaco", "phacoemulsification", "iris hook", "sequence"],
  },
  {
    id: "std:PRule7",
    kind: "standard",
    source: NCCS_OPCS,
    standard: "PRule 7",
    title: "Chapter Y and Z codes",
    summary: "Chapter Y and Z codes are only ever used in a secondary position.",
    page: "25",
    url: NCCS_OPCS_URL,
    keywords: ["laterality"],
  },
  {
    id: "std:PCSZ2",
    kind: "standard",
    source: NCCS_OPCS,
    standard: "PCSZ2",
    title: "Laterality of operation (Z94)",
    summary:
      "Documented laterality must be coded once, after all procedures on the same site. The same procedure on both sides is coded once with Z94.1; procedures on only one side take that side's code.",
    page: "204",
    url: NCCS_OPCS_URL,
    keywords: ["laterality", "left", "right", "bilateral", "both eyes"],
  },
];

const BY_ID = new Map(REFERENCES.map((r) => [r.id, r]));
const BY_CODE = new Map(
  REFERENCES.filter((r) => r.code).map((r) => [r.code as string, r]),
);

export function referenceById(id: string): Reference | undefined {
  return BY_ID.get(id);
}

export function referenceForCode(code: string): Reference | undefined {
  return BY_CODE.get(code);
}

export function codeTitle(code: string): string {
  return BY_CODE.get(code)?.title ?? "Not in the demo catalogue";
}

export function classificationOf(code: string): Classification | undefined {
  return BY_CODE.get(code)?.classification;
}

// Stage 4: deterministic retrieval. Matches keywords against the accepted
// facts (and annotation concepts as hints). The proposal may cite only the
// references returned here.
export function retrieveReferences(texts: string[]): string[] {
  const haystack = texts.join("\n").toLowerCase();
  const ids = new Set<string>(["std:DGCS.1"]);
  for (const ref of REFERENCES) {
    if (ref.keywords.some((k) => matchesKeyword(haystack, k))) ids.add(ref.id);
  }
  // Any laterality evidence makes all three side codes candidates so the
  // proposer, not retrieval, chooses the side.
  if (["opcs:Z94.1", "opcs:Z94.2", "opcs:Z94.3"].some((id) => ids.has(id))) {
    for (const id of ["opcs:Z94.1", "opcs:Z94.2", "opcs:Z94.3", "std:PCSZ2", "std:PRule7"]) {
      ids.add(id);
    }
  }
  if (ids.has("icd:H25.1") || ids.has("icd:H26.9")) {
    ids.add("icd:H25.1");
    ids.add("icd:H26.9");
    ids.add("std:DCS.VII.1");
  }
  return REFERENCES.map((r) => r.id).filter((id) => ids.has(id));
}

function matchesKeyword(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}`, "i").test(haystack);
}
