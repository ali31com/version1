# Cataract demo preset references

Researched 26 September 2026. Scope: the accepted cataract starting set, not unrestricted clinical coding. Classification facts below are distinct from proposed demo constraints. No application code or deployment changed.

## Verified classification facts

**Diagnosis standards.** NCCS ICD-10 2026 V12.0, DCS.VII.1 (printed p.100), assigns documented age-related cataract to H25.- and mature/advanced/white cataract to H26.9. The standard does not itself require a human confirmation step. DGCS.3 (p.36) requires Appendix 1 comorbidities when documented; diabetes and hypertension appear in that appendix (p.263). Other conditions need documented clinical relevance. DCS.XIX.7 (pp.201–203) requires documented procedural causation and an external-cause code; DCS.XX.8 (p.224) distinguishes misadventure, device malfunction and abnormal reaction. These distinctions prevent choosing a complication code solely from a “yes” answer. [Official NCCS ICD-10 PDF](https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf#page=101).

**Cataract specificity.** H25.1 denotes senile nuclear cataract; generic age-related cataract does not establish the nuclear subtype. H25.9 is unspecified senile cataract. H28.0* is diabetic cataract, a distinct classification from cataract coexisting with diabetes. [NHS ICD-10 lens tabular, H25.1/H25.9/H28.0](https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol1/block-h25-h28.htm).

**Glaucoma specificity.** H40.1 denotes primary open-angle glaucoma; unspecified glaucoma is H40.9. A generic audience answer must not silently imply open-angle disease. [NHS ICD-10 glaucoma tabular, H40.1/H40.9](https://classbrowser.nhs.uk/ICD-10-5TH-Edition/vol1/block-h40-h42.htm).

**Procedure catalogue.** C71.2 is phacoemulsification. C75.1 covers prosthetic lens replacement NEC, including without sutures; C75.4 identifies suture fixation NEC and C75.5 scleral fixation. C79.1 identifies anterior-approach vitrectomy; C79.2 is pars-plana vitrectomy and includes unspecified vitrectomy. C64.7 and C77.6 have supplementary-use instructions. C75 requires a supplementary extraction-method code, and C71 has additional-code instructions when lens insertion is concurrent. [OPCS-4.11 Chapter C, C64/C71/C75/C77/C79](https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-1.html).

**Sequencing and side.** PConvention 2 (p.31) defines the sequence implied by paired-code notes. PCSZ2 (p.204) requires documented laterality where not already implicit and permits one side code after all procedures at the same site. Z94.1/2/3 represent bilateral/right/left operations. These sources do not provide a cataract-specific recipe for bilateral surgery with a complication on only one eye. [NCCS OPCS-4 2026 V13.1, pp.31/204](https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf#page=205), [OPCS Chapter Z, Z94](https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-9.html).

**Treatment plausibility, not a coding rule.** The Royal College’s course teaches anterior vitrectomy and posterior capsule rupture management with sulcus IOL insertion. This supports a curated scenario involving those procedures; it does not establish that every capsule rupture has vitreous loss or needs that treatment. [Royal College CATS course, description and 13:40 session](https://ihub.rcophth.ac.uk/RCO/RCO/Events/Event_Display.aspx?EventKey=CATS201125).

## Recommended implementation constraints

- Keep age/name cosmetic; generate explicit diagnoses rather than inferring them from age. To retain the PRD’s H25.1 fixture, label the option “Age-related nuclear cataract”; otherwise extend the seed with H25.9.
- Define positive comorbidity answers through explicit preset descriptions: type 2 diabetes without documented diabetic complications; diagnosed essential hypertension; primary open-angle glaucoma with documented relevance to the current Episode. Do not equate diabetes with diabetic cataract or glaucoma with iris-hook insertion.
- The uncomplicated note explicitly records phacoemulsification, unsutured lens placement, documented side and absence of complications. Iris hooks appear only in a distinct curated operative-feature fragment that explicitly says they were inserted.
- The unilateral complication fragment explicitly records posterior capsule rupture during phacoemulsification, vitreous prolapse, anterior-approach vitrectomy, adequate remaining support and an unsutured sulcus IOL. This is a proposed synthetic scenario for clinical review, not a universal treatment instruction. Do not leave an incompatible “uncomplicated in-the-bag implant” fragment in the same document.
- Initially bound “Both” to uncomplicated same-session surgery. Reject or hide the capsule-rupture branch when “Both” is selected, with a concise explanation. This avoids inventing laterality and sequencing for asymmetric treatment. Allowing bilateral complicated surgery needs a separate approved fixture.
- Mature/white confirmation is the owner’s accepted teaching/review policy. Store that reason separately from missing evidence or failed classification checks.

## Seed and validation work required before enabling complicated auto-coding

The PRD seed lacks C79.1. Add its tabular reference and an anterior-approach fact/passage requirement. The seed also lacks the complication diagnosis and external-cause entries required to represent the full complicated Episode. **Exact ICD-10 posterior capsule rupture mapping and full combined procedure sequence remain unverified in this research:** verify through the official Alphabetical Index, tabular notes and a coder-approved fixture; do not fill the gap with guessed H59/T81/Y60/Y83 values. The uncomplicated C75.1 → C71.2 pair is supported by paired-code notes, but adding C79.1 is a separate performed procedure whose final order needs verification.

Until that fixture is verified, the complication scenario may still demonstrate extraction and the supported procedure candidates, but must end **Sent to review** with an explicit question about the incomplete code set. It must not claim complete auto-coding or silently omit the complication diagnosis/external cause. Keep expected fixture codes out of model inputs.

Validation should check diagnosis specificity, laterality agreement, actual procedures and implant fixation, documented comorbidities, evidence support and completeness. A catalogue-membership check alone cannot catch omitted complications or unsupported subtypes. See [PRD §5.4/§7.8](../PRD.md) and [design review](../design/live-demo-review.md).
