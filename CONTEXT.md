# Live clinical coding demo

An audience builds synthetic Episodes that appear on a live clinical coding Worklist. Gemini Flash performs the MedCAT and MedGemma roles, and the presenter can inspect each Episode and its coding result.

Only terms established by the owner's request are recorded here. The draft PRD supplies further proposed terminology and requirements; those remain subject to the design interview.

## Language

**Participant**: An audience member using a personal URL obtained through the demo QR entry point.

**Participant session**: The participant's interaction with the demo through that personal URL, allowing one Episode submission followed by live progress and result viewing. The session lifetime remains undecided.

**Episode**: A synthetic cataract surgery admitted-care activity created from audience choices and submitted for clinical coding. The presenter can open it from the Worklist to inspect its details and codes.

**Episode preset**: Prepared clinical data for a supported Episode type, customised by participant choices such as age, laterality, condition, complications and comorbidities.

**Supported scenario**: A cataract Episode built from the accepted choices: age-related or mature/white cataract; left, right or both eyes; documented diabetes, hypertension or glaucoma; and no complication or posterior capsule rupture with its treatment. The exact note fragments and code catalogue must be verified before implementation.

**Worklist**: The live presenter view containing submitted Episodes and their coding progress.

**Source document**: The clinical note representing an Episode and supplied to the coding pipeline. How presets produce the note remains to be settled.

**MedCAT role**: The concept annotation stage, performed by Gemini Flash in this demo.

**MedGemma role**: The clinical interpretation and coding stage, performed by Gemini Flash in this demo.

**Presenter workspace**: The clinical coding software style interface used to inspect the Worklist and open Episodes during the demonstration.

**Open question**: An unresolved point presented for the presenter to answer before approving the Episode's coding result. The presenter can inspect its evidence and resolve it; the first demo does not include unrestricted code editing.

**Review demonstration**: A deliberately selected teaching scenario requiring presenter review: mature/white-cataract code confirmation or a presenter-only contradictory-laterality Episode.

**Processing failure**: A visible failed pipeline stage whose completed evidence remains available and whose processing can be retried. Prepared results do not replace a failed live model run.

**Participant builder**: The phone interface that collects choices for one Episode, presenting one question at a time with two or three answer buttons where appropriate.

**Processing pause**: A presenter control that pauses automatic Episode processing. Whether an already running stage continues is an implementation detail proposed in the design review.
