# Complication and bilateral coding for the cataract demo

Researched 27 September 2026. Scope: the posterior capsule rupture (PCR) fragment in `convex/lib/presets.ts`, with its vitreous prolapse, limbal anterior vitrectomy and unsutured three-piece sulcus IOL, plus immediately sequential bilateral surgery (ISBCS) where only one eye is complicated. This follows up the gaps in [cataract-preset-references.md](cataract-preset-references.md). No application code changed. Page numbers are the printed pages. PDF links jump to that page (the PDF page is the printed page + 1).

## Verified: ICD-10 complication diagnosis and external cause

**Standard wording.** [DCS.XIX.7, p.201](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=202): "it must never be assumed that a condition is a postprocedural complication … it must be clearly documented as such by the responsible consultant", and "a code from categories Y40-Y84 must always be assigned". Where the index leads to T80-T88, the sequence is the T code followed by Y40-Y84 (pp.201–202). Where the index leads to a body-system postprocedural code ending in .8 or .9, "do not assign this code" and code the specific condition plus an external cause instead. The .8/.9 code is used only when no specific code exists ([p.202](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=203)). The flowchart [DFigure.XIX.1, p.209](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=210) shows the same logic.

**Misadventure versus Y83.** [DCS.XX.8, p.224](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=225): "Where misadventure to a patient occurs during a procedure, a code from categories Y60-Y69 … must be assigned in a secondary position to the code describing the result of the misadventure." Y83-Y84 apply only when "there is no mention of misadventure or device malfunction at the time of the procedure". Y70-Y82 apply only when a device is documented to have malfunctioned. The worked example on p.225 is "Bladder perforation during total abdominal hysterectomy → T81.2 + Y60.0". The same page also says that misadventure codes do "not necessarily indicate any mistake on the part of the consultant".

**Index paths (Section I, [KRA_C](https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol3/KRA_C.html), [KRA_P](https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol3/KRA_P.html), [KRA_L](https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol3/KRA_L.html)):**
- Complications → surgical procedure → accidental puncture or laceration: **T81.2**.
- Laceration → accidental, complicating surgery: **T81.2**.
- Perforation → accidental during procedure: **T81.2**.
- Complications → surgical procedure → eye: H59.9 (specified NEC H59.8). The .8/.9 rule above excludes these codes.
- Prolapse → vitreous (humor): H43.0.
- Rupture → lens (cataract) (traumatic): H26.1, which is traumatic cataract. It is not a PCR entry.
- There is **no index entry for posterior capsule rupture**.

Section II ([URS_M](https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol3/URS_M.html)) gives Misadventure(s) → cut, cutting, puncture, perforation or hemorrhage … → surgical operation: **Y60.0**. The [T81.2 tabular entry](https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol1/block-t80-t88.htm) includes accidental perforation of an organ "by … instrument … during a procedure". [H59](https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol1/block-h55-h59.htm) contains only H59.0 (bullous aphakic keratopathy / vitreous touch syndrome), H59.8 and H59.9.

**Sequencing against the cataract.** [DGCS.1, p.34](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=35): the primary diagnosis is "the main condition treated". [DCS.XIX.7 Sequencing, p.205](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=206): a complication "may on occasions" become the main condition when it changes management.

**Secondary corroboration (not a primary source).** The [UKOA Cataract Coding Handbook (Sept 2018), pp.9–10](https://uk-oa.co.uk/wp-content/uploads/2019/03/UKOA_worksteam_coding_CataractCodingHandbook_Sept_2018.pdf) was written with the NHS Digital Clinical Classifications Service. It states: "No ICD-10 index trails exist for 'intraoperative posterior capsular rupture' (either with or without vitreous loss)". It advises coding PCR, including PCR with vitreous loss, as **T81.2 + Y60.0**, and coding the extra procedures such as anterior vitrectomy. It advises T81.8 when "vitreous loss" is documented without a rupture. I could not reach NHS England Coding Clinic or the Query Resolution Database on Delen, which requires a login.

## Verified: OPCS-4.11 procedures

- The [C71 tabular entry](https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-1.html) says "Use as an additional code when associated with concurrent insertion of prosthetic replacement for lens (C75.1)". C75 says "Use a supplementary code to identify method of concurrent extraction of lens (C71-C74)". [PConvention 2, p.31](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=32) therefore puts **C75.1 before C71.2**.
- C75.1 "Includes: Insertion of prosthetic replacement for lens without sutures NEC". C75.4 is suture fixation and C75.5 is scleral fixation. "Sulcus" does not appear anywhere in the Chapter C tabular or the OPCS index.
- C79.1 "Vitrectomy using anterior approach" carries only one note, about tamponade (C79.5/C79.6). It has **no note about cataract surgery** and no paired-code instruction with C71/C75. The index path is Vitrectomy → Anterior Approach: C79.1 ([index V–Z](https://classbrowser.nhs.uk/OPCS-4.11/volume2-I-8.html)). The only Chapter C standards are PChSC1 (MIGS) and PCSC1 (anaesthetic), both on [p.68](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=69).
- [PGCS5, p.39](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=40): an unintentional action such as perforation "must not be recorded using OPCS-4 codes". Procedures that correct it "must be recorded". The associated diagnosis is coded in ICD-10.
- [PRule 2, p.19](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=20): the first procedure should be the MAIN intervention.
- [PRule 7, p.25](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=26): Y and Z codes are secondary only.

## Verified: laterality, bilateral surgery and clinical practice

[PCSZ2, p.204](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=205): "When multiple procedures are carried out on the same site it is only necessary to assign the laterality code once after all of the procedures on that site." [PCSZ1, p.203](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=204) covers site codes only. It is not a bilateral standard. The PCSZ2 examples on [p.205](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=206) show two patterns:
- The same procedure on both arms is coded once with Z94.1.
- Different procedures on different sides each get their own Z94 code.

No example, standard or tabular note covers an identical bilateral procedure with an extra procedure on one side only. [Z94](https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-9.html) has no notes.

**Clinical practice.** [RCOphth/UKISCRS ISBCS advice 2020/PROF/420, rec. 4(i), p.3](https://web.archive.org/web/2024id_/https://www.rcophth.ac.uk/wp-content/uploads/2020/09/Immediate-Sequential-Bilateral-Cataract-Surgery-Guidance.pdf) says: "if there is a suggestion that there is a significant complication in the first eye (including but not limited to capsule rupture, vitreous loss …) … second eye surgery must be deferred". Rec. 4(f)(i) requires treating each eye "as a completely separate procedure". The live rcophth.ac.uk URL now returns 404, so I read an archived copy. The document is labelled COVID-era "rapid advice".

**Comorbidities.** Under [DGCS.3, p.36](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=37), Appendix 1 conditions "must always be coded". Diabetes (E10-E14) is listed on [p.263](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=264). Glaucoma is not listed, so it needs documented relevance. DCS.IV.1 (p.81) keeps E11.9 unless a condition is stated to be due to diabetes. I found no standard that changes either code when a procedural complication occurs.

## Implications for the demo (inference; needs coder sign-off)

- Complicated unilateral left eye:
  - Diagnoses: **H25.1 (or H26.9), T81.2, Y60.0, E11.9, H40.1** (glaucoma only if documented as relevant). Y60.0 goes directly after T81.2. The cataract stays primary because PCR is managed within the planned operation.
  - Procedures: **C75.1 C71.2 C79.1 Z94.3**. C79.1 follows the pair because C75.1+C71.2 is the main intervention and the pair should stay adjacent. The single Z94 code comes last under PCSZ2.
  - Confidence: high for C75.1/C71.2/C79.1/Z94.3 as codes, medium for C79.1's position, and medium-high for T81.2+Y60.0. Do not propose H59.8, Y83.x or T81.8. The preset note says "rupture", which avoids the T81.8 "vitreous loss only" branch. Whether to add H43.0 for the vitreous prolapse is unresolved.
- Sulcus IOL without sutures: C75.1 by NEC/"without sutures" inclusion (high confidence).
- ISBCS with a complication: a coherent note has the **second** eye complicated. If the first eye were complicated, surgery on the second eye would be deferred.
- Coding ISBCS with one complicated eye: I could not settle the grouping. It could be one bilateral group (C75.1 C71.2 Z94.1, then C79.1 Z94.3) or two per-eye groups (C75.1 C71.2 Z94.2; C75.1 C71.2 C79.1 Z94.3). Both readings fit PCSZ2. Keep the "Both + PCR" combination blocked, or send it to review, until a coder confirms which.

## Unverified

- Any NHS England Coding Clinic or Query Resolution Database ruling on PCR, on PCR in a bilateral operation, or on grouping for ISBCS. These are on Delen and require a login.
- Whether H43.0 (vitreous prolapse) should be coded alongside T81.2.
- Whether the 2018 UKOA advice still reflects current NCCS practice.
- The exact position of C79.1 relative to the C75.1/C71.2 pair. No primary text states it.
- Whether a later RCOphth ISBCS document has replaced 2020/PROF/420.
