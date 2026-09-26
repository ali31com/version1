# PRD: Autonomous Cataract Coding — Web App

| | |
|---|---|
| **Status** | Draft v1, ready for build planning |
| **Date** | 26 September 2026 |
| **Owner** | Ali (ali.raed31@gmail.com) |
| **Origin** | The "Cataract Coding Deck" demo (prepared, coder-approved results for 5 Episodes). This PRD turns what the Deck *showed* into a working product. |
| **Primary user** | Clinical coders |
| **Model strategy** | **Gemini Flash** plays both the **MedCAT** role (concept annotation) and the **MedGemma** role (fact extraction and code proposal) behind swappable adapters. The real MedCAT and MedGemma 1.5 can replace it later without contract changes. |

---

## 1. Summary

Hospitals must clinically code every admitted-care **Episode** with ICD-10 diagnoses and OPCS-4 procedures. Cataract operations are high-volume, highly repetitive and rule-driven, which makes them the ideal first specialty for autonomous coding.

The app takes a completed cataract **Episode**, reads its **Source document** (the operation note), and runs a seven-stage pipeline. The output is a complete, sequenced code set in which **every code cites the Clinical facts it rests on, the Source passages behind those facts, and the Coding reference that justifies it**.

The pipeline then decides one of two things:

- **Auto-coded**: every code is supported, all checks pass and nothing is unresolved.
- **Sent to review**: one or more **Open questions** remain. A coder sees exactly what is unclear, which passages were re-read, and what the question blocks.

**The product goal is autonomy.** Coders stop touching routine operations and spend their time only on Episodes that genuinely need judgement.

### 1.1 What the demo proved (and what it did not)

| Demonstrated with 5 prepared Episodes | Not yet demonstrated |
|---|---|
| Evidence chain: passage → annotation → fact → code → coding reference | Live model runs (the demo used prepared JSON) |
| Multi-diagnosis Episodes with comorbidities (OPH-0012) | Accuracy at scale; calibration of any confidence signal |
| Supplementary procedure codes, e.g. iris hooks C64.7 (OPH-0012) | Throughput and latency |
| Bilateral same-session surgery coded once with Z94.1 (OPH-0032) | EPR write-back |
| Contradictory laterality detected and routed to review (OPH-0022) | Coder workflow for answering Open questions |
| A national standard overriding the "obvious" category, H26.9 vs H25.- (OPH-0042) | Coding specialties other than cataract |
| Lightweight checks: output format, catalogue membership, evidence validity | |

---

## 2. Goals, non-goals, success measures

### 2.1 Goals (MVP)
1. **Ingest** Worklist items and their Source documents, and split each document into citable **Source passages**.
2. **Run the pipeline live** for every Cataract operation Episode, with Gemini Flash as both the MedCAT and MedGemma stand-in.
3. **Produce a complete-episode proposal**: multiple diagnoses and one or more procedure groups, correctly **sequenced**, with evidence and a coding reference on every code.
4. **Auto-code or send to review**, with a human-readable reason, based on deterministic rules (§7.8).
5. **Give coders a review workspace** to inspect evidence, answer Open questions, edit or accept codes, and complete the Episode.
6. **Keep a full audit trail**: model, prompt version, reference-library version, every stage output and every coder decision.

### 2.2 Non-goals (MVP)
- EPR / PAS write-back (export only, §8.7).
- Coding **Attendances** (outpatient or emergency). They are shown on the Worklist but not coded.
- Specialties other than ophthalmology cataract operations.
- Confidence percentages. **Do not display any numeric confidence** until it has been calibrated (§11).
- HRG grouping and tariff.

### 2.3 Success measures
| Measure | MVP target | How measured |
|---|---|---|
| Exact code-set match against coder-approved **Reference codes** (golden set) | 5/5 prepared Episodes reproduce the expected Coding result; auto-coded ones match 100% | Golden-set regression suite (§10) |
| Sequencing correct (primary diagnosis, primary procedure, Z code last) | 100% on golden set | Same suite |
| **False auto-code rate** (auto-coded but differs from Reference codes) | 0 on golden set; tracked on every pilot batch | Coder audit sample |
| Share of Cataract Episodes auto-coded (pilot) | Reported, no target yet | Dashboard |
| Median time for a coder to finish a Sent-to-review Episode | Reported; baseline vs manual | Audit timestamps |
| Every displayed code has ≥1 Clinical fact, ≥1 Source passage and ≥1 Coding reference | 100%, enforced by checks | Check C3 (§7.7) |

---

## 3. Users and roles

| Role | Needs | Permissions |
|---|---|---|
| **Clinical coder** (primary) | Work the review queue fast. Understand *why* an Episode was sent to review. Verify evidence in one click. Correct or accept codes and complete the Episode. Spot-check auto-coded Episodes. | View all; answer Open questions; edit codes; complete Episodes; re-run the pipeline |
| **Coding lead / manager** | See throughput, auto-code rate and review reasons. Audit decisions. Manage the reference-library version. | Coder permissions + audit views + settings |
| **Decision maker / observer** | Read-only view of results and evidence, for evaluation. | Read-only |
| **System admin** | Configure model adapters, keys, reference library, users. | Admin |

---

## 4. Domain language (use these words exactly)

This glossary comes from the Deck's `CONTEXT.md`. Use the same terms in the UI, code, API and docs. The "Avoid" words are banned in UI copy.

| Term | Definition | Avoid |
|---|---|---|
| **Worklist** | The full list of completed ophthalmology activity awaiting clinical coding. | Queue, patient list |
| **Worklist item** | One row on the Worklist, identified by its Worklist ID (e.g. `OPH-0002`). It is either an Episode or an Attendance. | Case, record, encounter, visit, patient |
| **Episode** | A Worklist item for admitted care (including a day case). This is the unit that clinical coding standards require to be coded, and every cataract operation is one Episode. | FCE, admission, spell, case |
| **Attendance** | A Worklist item for outpatient or emergency activity. It is shown on the Worklist but not coded in the MVP. | Episode, visit, appointment |
| **Cataract operation** | An Episode in which a cataract is removed and a lens implant inserted. It is the only kind of Worklist item the MVP codes. | Cataract case |
| **Outcome** | The clinical result recorded by the clinician, e.g. "Discharged with post-op drops". | Coding result, status |
| **Source document** | The clinical document behind a Worklist item (operation note, clinic letter, procedure note or casualty note). It is the input to the pipeline. | Record, EPR entry, JSON |
| **Source passage** | A span of text in a Source document, with a stable ID (`OPH-0002.p07`). **It is the only thing that counts as evidence.** | Snippet, excerpt |
| **Annotation** | A clinical concept tagged on a Source passage by the MedCAT role. It is a hint only and **never decides a code on its own**. | Tag, entity, finding |
| **Clinical fact** | A structured statement extracted from the document, citing one or more Source passages. | Finding, extraction |
| **Coding reference** | An entry from the ICD-10/OPCS-4 classification or a National Clinical Coding Standard that justifies a code choice. | Rule, guideline |
| **Proposed code** | A code the pipeline suggests, justified by Clinical facts and a Coding reference, never directly by an Annotation. | Prediction, suggested code |
| **Procedure group** | The set of OPCS-4 codes describing one operative event, in sequence (e.g. C75.1, C71.2, Z94.3). | |
| **Open question** | A specific fact or code choice the pipeline could not settle from the Source passages. **Any Open question sends an Episode to review.** | Uncertainty, flag, issue |
| **Coding result** | What the pipeline decided: **Auto-coded** or **Sent to review**. | Outcome, readiness label, status |
| **Reference codes** | Coder-approved codes for a Worklist item, used for evaluation. They are never shown as part of the Source document. | Ground truth, answer key |
| **Primary diagnosis / primary procedure** | The first-position diagnosis (DGCS.1) and procedure (PRule 2). | Main condition (in UI) |
| **Laterality code** | Z94.1 bilateral, Z94.2 right, Z94.3 left. | Side flag |

---

## 5. Coding knowledge the pipeline must apply

These rules come from primary sources: NCCS 2026, OPCS-4.11 Tabular and the NHS Data Dictionary (§15). They must be implemented as **Coding references in the reference library** and cited by the model. Deterministic checks (§7.7) should enforce them where possible.

### 5.1 Unit of coding
- **Code each Episode, not the spell.** Day cases are admitted care and are coded exactly like inpatient Episodes (OPCS-NCCS p.7; ICD-NCCS p.7).
- A cataract day case is normally **one spell = one Episode = one operation**.
- **Both eyes in the same session** = one Episode. Each procedure is coded once, followed by **Z94.1 Bilateral operation**.
- **Eyes operated on separate admissions** = two spells and two Episodes, each coded separately with Z94.2 or Z94.3.

### 5.2 Procedure sequencing (OPCS-4.11)
| Rule | Content | Cataract effect |
|---|---|---|
| **PConvention 2** (p.30–31) | A code carrying "Use a supplementary code" goes in **primary** position. A code carrying "Use as a supplementary/additional code" goes in **secondary** position. | **C75.1** (lens implant) takes the primary position; **C71.2** (phaco) follows |
| **Tabular C75** | "Use a supplementary code to identify method of concurrent extraction of lens (C71–C74)" | C75.x needs a C71–C74 code after it |
| **Tabular C71** | "Use as an additional code when associated with concurrent insertion of prosthetic replacement for lens (C75.1)" | C71.x is secondary |
| **Tabular C64.7** | Iris hooks. "Use as a supplementary code when associated with concurrent extraction of lens (C71–C74)" | Secondary, after the extraction |
| **C77.6** | Capsule tension ring, supplementary | Secondary |
| **PRule 7** (p.25) | Chapter Y and Z codes are **only ever secondary** | Z94.x never primary |
| **PCSZ2** (p.204) | Documented laterality **must** be coded, **once**, after all procedures on the same site. The same procedure on both sides is coded once with Z94.1. | Z94.x last in the procedure group |
| **PCSC1** (p.68) | C90 local anaesthetic codes are secondary only and not mandatory | Do not require C90 |

**Canonical sequence for standard phaco + IOL:** `C75.1 → C71.2 → Z94.2 | Z94.3` (or `Z94.1` if bilateral, same session). Supplementary codes such as C64.7 go after the extraction method and before Z94.

### 5.3 Diagnosis rules (ICD-10 5th Edition)
| Rule | Content |
|---|---|
| **DGCS.1** (p.34) | The primary diagnosis is the main condition treated or investigated during the Episode. |
| **DCS.VII.1** (p.100) | Age-related cataract → **H25.-**. **Mature, advanced or white** cataract → **H26.9 Cataract, unspecified**, even if the patient is elderly. |
| **DCS.VII.2** | Posterior capsule opacification → H26.4 After-cataract. |
| **DGCS.5** | Diabetic cataract uses the dagger/asterisk pair E1x.3† + H28.0*. |
| **DGCS.3** (p.36) | Conditions on the Appendix 1 comorbidities list (e.g. **diabetes, hypertension**) must **always** be coded when documented, including for day cases. Other conditions are coded when the consultant documents them as relevant to the Episode (e.g. glaucoma causing a small pupil). |
| **DCS.IV.1** (p.81) | Diabetes 4th characters .0–.8 only when the record clearly states the condition is due to diabetes; otherwise **.9**. |
| **DCS.IX.1** (p.103) | Hypertension is coded only when the patient has been diagnosed as hypertensive. |

### 5.4 Relevant code catalogue (MVP seed)
| Code | Title | System |
|---|---|---|
| H25.1 | Senile nuclear cataract | ICD-10 |
| H26.9 | Cataract, unspecified | ICD-10 |
| H40.1 | Primary open-angle glaucoma | ICD-10 |
| E11.9 | Non-insulin-dependent diabetes mellitus without complications | ICD-10 |
| I10.X | Essential (primary) hypertension | ICD-10 |
| C75.1 | Insertion of prosthetic replacement for lens NEC | OPCS-4.11 |
| C71.2 | Phacoemulsification of lens | OPCS-4.11 |
| C64.7 | Insertion of iris hooks | OPCS-4.11 |
| Z94.1 | Bilateral operation | OPCS-4.11 |
| Z94.2 | Right sided operation | OPCS-4.11 |
| Z94.3 | Left sided operation | OPCS-4.11 |

The production catalogue must be loaded from the **official TRUD release files** (full ICD-10 5th Ed and OPCS-4.11), not from this seed. The seed is for tests.

### 5.5 Known gaps (do not claim)
- No NHS England standard specifically covers bilateral cataract; the Z94.1 treatment is derived from general rules.
- HRG and tariff effects of Z94.1 are **unverified**.
- There is no national mandate to code outpatient procedures.

---

## 6. End-to-end flow

```
Worklist ──► Episode selected / batch trigger
                │
                ▼
 1. Episode packet ─► 2. MedCAT role ─► 3. Clinical facts ─► 4. Coding references
   (passages, IDs)     (Gemini Flash)     (Gemini Flash)       (retrieval, local)
                                                                   │
                ┌──────────────────────────────────────────────────┘
                ▼
 5. Complete-episode proposal ─► 6. Resolve uncertainty ─► 7. Checks + routing
    (Gemini Flash)                  (re-read passages)         │
                                                               ├─► Auto-coded ─► Export
                                                               └─► Sent to review ─► Coder workspace ─► Completed ─► Export
```

The six UI steps shown per Episode map onto these stages: **Documents → MedCAT annotations → Clinical facts → Coding references → Proposed codes → Coding result**.

---

## 7. Pipeline specification

### 7.1 General principles
1. **Evidence is always a Source passage.** Every Clinical fact cites ≥1 passage ID. Every Proposed code cites ≥1 fact ID and ≥1 reference ID. Annotations may be cited as hints but never as sole support.
2. **Separate current activity from history and plans.** Only conditions and procedures relevant to *this* Episode are coded; plans and past history are not coded as performed.
3. **Structured output only.** Each model stage returns JSON that validates against a schema (§7.9). Invalid output means a retry, and after that the Episode is Sent to review with a system Open question.
4. **Same contract, swappable model.** Stages 2, 3, 5 and 6 go through adapter interfaces (`AnnotatorAdapter`, `ExtractorAdapter`, `ProposerAdapter`). The MVP implementation for all of them is **Gemini Flash**. Replacing it with MedCAT (stage 2) or MedGemma 1.5 (stages 3, 5, 6) must need no change outside the adapter.
5. **Reproducibility.** Store model ID, prompt template version, temperature, reference-library version, input hash and raw model output for every stage run.
6. **Unresolved stays visible.** The pipeline must never silently pick between contradictory passages.

### 7.2 Stage 1: Episode packet
- **Input:** Worklist item + Source document(s).
- **Work:** normalise the document into sections and passages with stable IDs `<WorklistID>.pNN`, preserving order and headings. Keep character offsets. Tag each passage's section (Procedure Details, Operative Findings, Procedure Performed, Complications, Discharge Plan, Follow-up…). Mark `context`: `current | history | plan` where it can be derived from the section.
- **Output:** `EpisodePacket` (§8.3).
- **Rule:** passage IDs are immutable once created. Re-ingesting creates a new document version.

### 7.3 Stage 2: MedCAT role (Gemini Flash as annotator)
- **Purpose:** tag clinical concepts on passages, *as MedCAT would*: named-entity recognition + concept normalisation + meta-annotations.
- **Input:** passages.
- **Output:** `Annotation[]`. Each has `passageId`, `span` (exact substring), `start`/`end` offsets, `concept` (preferred name), `category` (`disorder | procedure | body structure | finding | substance | device`), `status` (`affirmed | negated | historical | hypothetical`), and optional `conceptCode` (SNOMED CT; `null` while Gemini stands in).
- **Constraints:** `span` must be an exact substring of the passage text (validated). Do not invent concepts absent from the text.
- **Prompt guidance:** "You are a clinical concept annotator equivalent to MedCAT. Return only concepts literally present in the passage. Mark negation ('no complications'), history and plans."

### 7.4 Stage 3: Clinical facts (Gemini Flash as MedGemma)
- **Input:** passages (original text) **plus** annotations as hints.
- **Output:** `ClinicalFact[]` with `kind` ∈ `diagnosis | comorbidity | procedure | implant | laterality | complication | other`, a plain-English `statement`, `passageIds` (≥1) and `annotationIds` (0+).
- **Must capture:** diagnoses (with type: age-related / mature / white / diabetic…), procedures performed, laterality, implant details, complications (including "none"), comorbidities and their relevance to the operation, and contradictions.
- **Contradiction rule:** if passages disagree (e.g. right vs left), emit **one** fact whose statement describes the contradiction and cites **all** conflicting passages (see OPH-0022 f04, §9.5).

### 7.5 Stage 4: Coding references (retrieval, deterministic)
- **Input:** facts.
- **Work:** retrieve candidate classification entries (codes + tabular notes such as "Use a supplementary code") and applicable NCCS standards from the **local reference library** (§8.4). MVP: keyword/category mapping + embedding search over code titles, notes and standard summaries.
- **Output:** candidate `Reference[]` with IDs (`icd:H25.1`, `opcs:C75.1`, `std:PCSZ2`).
- **Rule:** the proposal may cite **only** references returned here.

### 7.6 Stage 5: Complete-episode proposal (Gemini Flash as MedGemma)
- **Input:** facts + retrieved references.
- **Output:** `Proposal`:
  - `diagnoses[]`: `code`, `position` (`primary | secondary`), `factIds`, `referenceIds`, `explanation` (1–2 sentences citing the rule).
  - `procedureGroups[]`: `label` (plain English, e.g. "Left cataract extraction with lens implant") and ordered `codes[]` (same shape, order = sequence).
- **Must:** apply §5 sequencing, code documented comorbidities per DGCS.3, and code laterality once per site. Where a code cannot be chosen, omit it and raise an Open question naming what is blocked (e.g. "Z94.2 or Z94.3").

### 7.7 Stage 6: Resolve uncertainty
- **Trigger:** any fact of kind contradiction, any omitted-but-required code (e.g. laterality documented but unresolvable), or a code choice where a standard overrides the most likely clinical category (e.g. DCS.VII.1 → H26.9 for a mature cataract in an 84-year-old).
- **Work:** re-read the **original passages** relevant to the question (not only the facts), up to **2 iterations**. If the question is settled, update the proposal. If not, create an `OpenQuestion`:
  - `question`: the specific question a coder must answer.
  - `factIds`.
  - `revisited`: what was re-read and what was found.
  - `blocks`: which code or decision cannot be finalised.
  - `status`: `unresolved | answered`.

### 7.8 Stage 7: Checks and routing (deterministic, no model)
**Checks** (each `passed | failed` with detail):

| ID | Check | Fails when |
|---|---|---|
| C1 | `outputFormat` | Any stage output fails JSON-schema validation |
| C2 | `catalogueMembership` | Any proposed code is not in the loaded ICD-10/OPCS-4 catalogue version |
| C3 | `evidenceReferences` | Any fact cites a passage ID that doesn't exist; any code cites a missing fact or reference; any code has 0 facts or 0 references; any annotation `span` isn't a substring of its passage |
| C4 | `sequencing` *(new, beyond the demo)* | A Z/Y code is primary (PRule 7); C71–C74 is before C75 in the same group; a laterality code is not last in its group |
| C5 | `lateralityPresent` *(new)* | A laterality fact exists but there is no Z94 code and no Open question explains why |
| C6 | `primaryDiagnosis` *(new)* | Not exactly one diagnosis has `position = primary` |

**Routing rule:**
```
Auto-coded      ⇔ all checks passed AND openQuestions is empty
Sent to review  ⇔ otherwise
```
`codingResult.reason` is a plain-English sentence generated from the facts, e.g. "One condition, one operation, laterality consistent throughout, no complications. Every code is supported by a fact and a reference."

**Safety default:** any system error, timeout or model refusal → Sent to review with a system Open question ("Pipeline could not complete stage X"). **Never auto-code on failure.**

### 7.9 Model adapter contract
```ts
interface StageRunMeta {
  stage: "annotate" | "extract" | "propose" | "resolve";
  modelId: string;            // e.g. "gemini-flash" (exact version pinned in config)
  roleEmulated: "medcat" | "medgemma";
  promptVersion: string;      // e.g. "extract@1.3.0"
  temperature: number;        // 0 or near 0
  inputHash: string;
  startedAt: string; finishedAt: string;
  rawOutput: string;          // stored for audit
  attempts: number;
}

interface AnnotatorAdapter { annotate(packet: EpisodePacket): Promise<{ annotations: Annotation[]; meta: StageRunMeta }> }
interface ExtractorAdapter { extract(packet: EpisodePacket, annotations: Annotation[]): Promise<{ facts: ClinicalFact[]; meta: StageRunMeta }> }
interface ProposerAdapter {
  propose(facts: ClinicalFact[], refs: Reference[]): Promise<{ proposal: Proposal; meta: StageRunMeta }>;
  resolve(packet: EpisodePacket, facts: ClinicalFact[], proposal: Proposal, refs: Reference[]): Promise<{ proposal: Proposal; openQuestions: OpenQuestion[]; meta: StageRunMeta }>;
}
```
Use the model's **structured-output / JSON-schema response mode** where available, validate server-side regardless, and retry at most 2 times on schema failure.

---

## 8. Data model and API

### 8.1 Entities
```
WorklistItem 1─* SourceDocument 1─* Passage
WorklistItem 1─* PipelineRun 1─* StageRun
PipelineRun 1─* Annotation, ClinicalFact, OpenQuestion, Check
PipelineRun 1─1 Proposal 1─* ProposedCode (diagnoses + procedure groups)
PipelineRun 1─1 CodingResult
WorklistItem 0─1 FinalCoding (after coder completion or auto-code)
Reference (versioned library)  *─* ProposedCode
AuditEvent (append-only, any entity)
```

### 8.2 Types (TypeScript notation, mirrors the demo JSON)
```ts
type WorklistKind = "episode" | "attendance";
type CodingStatus = "Ready to code" | "In progress" | "Query required" | "Auto-coded" | "Sent to review" | "Completed";

interface WorklistItem {
  worklistId: string;          // "OPH-0002"
  kind: WorklistKind;
  codingStatus: CodingStatus;
  priority: "Routine" | "Urgent";
  activityStatus: "Completed";
  activityDate: string;        // ISO date
  dischargeDate: string | null;
  hospitalNumber: string; nhsNumber: string;
  patientName: string; dateOfBirth: string; sex: string;
  site: string; specialty: string; treatmentFunction: string; clinicCode: string;
  activity: string;            // "Cataract surgery"
  patientClass: "Day case" | "Ordinary admission" | "Outpatient" | "Emergency outpatient" | "Outpatient procedure";
  attendanceType: string; consultant: string;
  laterality: "Left" | "Right" | "Bilateral" | null;
  primaryDiagnosis: string; clinicalSummary: string; procedure: string;
  outcome: string;             // clinical Outcome, not the Coding result
  coderQuery: string | null;
  documentId: string;
  dataQualityNote?: string;
}

interface Passage { id: string; text: string; start?: number; end?: number; context?: "current" | "history" | "plan" }
interface SourceDocument {
  documentId: string; worklistId: string; version: number;
  type: "Operation Note" | "Outpatient Clinic Letter" | "Procedure Note" | "Casualty Note";
  organisation: string; clinic: string; date: string;
  header: Record<string, string>;
  sections: { heading: string | null; passages: Passage[] }[];
}

interface Annotation { id: string; passageId: string; span: string; start?: number; end?: number;
  concept: string; conceptCode?: string | null;
  category: "disorder" | "procedure" | "body structure" | "finding" | "substance" | "device";
  status: "affirmed" | "negated" | "historical" | "hypothetical" }

interface ClinicalFact { id: string;
  kind: "diagnosis" | "comorbidity" | "procedure" | "implant" | "laterality" | "complication" | "other";
  statement: string; passageIds: string[]; annotationIds: string[] }

interface ProposedCode { code: string; position?: "primary" | "secondary";
  factIds: string[]; referenceIds: string[]; explanation: string }

interface Proposal { diagnoses: ProposedCode[]; procedureGroups: { label: string; codes: ProposedCode[] }[] }

interface OpenQuestion { id: string; factIds: string[]; question: string; revisited: string; blocks: string;
  status: "unresolved" | "answered";
  answer?: { by: string; at: string; text: string; resultingChange?: string } }

type CheckStatus = "passed" | "failed";
interface PipelineRun {
  runId: string; worklistId: string; documentVersion: number;
  referenceLibraryVersion: string;       // e.g. "icd10-5ed-2026+opcs4.11+nccs2026-v1"
  prepared: false;                       // demo data used true
  stages: StageRunMeta[];
  annotations: Annotation[]; clinicalFacts: ClinicalFact[];
  proposal: Proposal; openQuestions: OpenQuestion[];
  checks: Record<"outputFormat" | "catalogueMembership" | "evidenceReferences" | "sequencing" | "lateralityPresent" | "primaryDiagnosis", CheckStatus>;
  codingResult: { value: "auto-coded" | "sent-to-review"; reason: string };
  createdAt: string;
}

interface Reference { id: string; kind: "classification" | "standard"; source: string;
  code?: string; title?: string; note?: string;              // classification
  standard?: string; summary?: string; page?: number | string; // standard
  url?: string; version: string }

interface FinalCoding { worklistId: string; runId: string;
  diagnoses: { code: string; position: "primary" | "secondary" }[];
  procedures: { code: string; sequence: number }[];
  completedBy: "system" | string; completedAt: string; editedFromProposal: boolean }
```

### 8.3 REST API (suggested)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/worklist?kind=&codingStatus=&q=&page=` | List Worklist items |
| GET | `/api/worklist/:id` | Item + latest run summary |
| GET | `/api/worklist/:id/document` | Source document with passages |
| POST | `/api/worklist/:id/runs` | Start a pipeline run (async) → `{ runId }` |
| POST | `/api/runs/batch` | Run all eligible Cataract operations |
| GET | `/api/runs/:runId` | Full `PipelineRun` |
| GET | `/api/runs/:runId/events` | SSE stream of stage progress |
| POST | `/api/runs/:runId/open-questions/:qid/answer` | Coder answers → optional re-run of stages 5–7 |
| PUT | `/api/worklist/:id/final-coding` | Coder saves edited codes (validated by checks C2, C4, C6) |
| POST | `/api/worklist/:id/complete` | Mark Completed |
| GET | `/api/references?q=&kind=` | Search the reference library |
| GET | `/api/export?from=&to=&format=csv` | Export FinalCoding (APC-style rows) |
| GET | `/api/audit?entity=&id=` | Audit trail |

### 8.4 Reference library
- Load official **TRUD** ICD-10 5th Edition and OPCS-4.11 files, with tabular notes attached to each code.
- Standards: curated entries from NCCS ICD-10 2026 (V12.0) and NCCS OPCS-4 2026 (V13.1), each with ID, title, page, summary and URL.
- The whole library is **versioned**. Each run records the version it used, and the UI always shows versions and citations.

### 8.5 Export
CSV/JSON per completed Episode: Worklist ID, hospital number, activity date, the diagnosis codes in order (primary first), the procedure codes in sequence, `completedBy`, run ID and reference-library version. No write-back in the MVP.

---

## 9. Data samples

All sample data is **synthetic** ("Synthetic training data – not for clinical use"). The development dataset is 50 Worklist items: 45 Attendances and 5 Cataract operation Episodes (OPH-0002, -0012, -0022, -0032, -0042). Coding statuses are 41 "Ready to code", 6 "In progress" and 3 "Query required". Patient classes are Outpatient 35, Day case 5, Emergency outpatient 5 and Outpatient procedure 5.

### 9.1 Worklist item: Episode
```json
{
  "worklistId": "OPH-0002",
  "kind": "episode",
  "codingStatus": "Ready to code",
  "priority": "Routine",
  "activityStatus": "Completed",
  "activityDate": "2026-08-03",
  "dischargeDate": "2026-08-03",
  "hospitalNumber": "H2700002",
  "nhsNumber": "999 202 3002",
  "patientName": "Brian Green",
  "dateOfBirth": "1937-03-03",
  "sex": "Male",
  "site": "Main Hospital",
  "specialty": "130 - Ophthalmology",
  "treatmentFunction": "130 - Ophthalmology",
  "clinicCode": "OPHTH-CAT-OP",
  "activity": "Cataract surgery",
  "patientClass": "Day case",
  "attendanceType": "First attendance",
  "consultant": "C100103 - C Morgan",
  "laterality": "Left",
  "primaryDiagnosis": "Age-related nuclear cataract, left eye",
  "clinicalSummary": "Uncomplicated left phacoemulsification with in-the-bag posterior chamber lens.",
  "procedure": "Phacoemulsification with intraocular lens",
  "outcome": "Discharged with post-op drops",
  "coderQuery": null,
  "documentId": "OPH-0002-DOC",
  "dataQualityNote": "Synthetic training data - not for clinical use"
}
```

### 9.2 Worklist item: Attendance (listed, not coded)
```json
{
  "worklistId": "OPH-0011",
  "kind": "attendance",
  "codingStatus": "Query required",
  "activity": "Cataract assessment",
  "patientClass": "Outpatient",
  "laterality": "Right",
  "primaryDiagnosis": "Age-related cataract, right eye",
  "procedure": "Biometry and surgical assessment",
  "outcome": "Listed for cataract surgery",
  "coderQuery": "Confirm final diagnosis, procedure detail and laterality from source record",
  "documentId": "OPH-0011-DOC"
}
```

### 9.3 Source document: operation note (complete)
```json
{
  "documentId": "OPH-0002-DOC",
  "worklistId": "OPH-0002",
  "type": "Operation Note",
  "organisation": "MAIN HOSPITAL — OPHTHALMOLOGY DEPARTMENT",
  "clinic": "Cataract surgery",
  "date": "3 August 2026",
  "header": {
    "Patient": "Brian Green", "DOB": "3 March 1937 (Age 89)", "Hospital No": "H2700002",
    "NHS No": "999 202 3002", "Sex": "Male", "Site": "Main Hospital",
    "Consultant": "Mr/Ms C Morgan", "Worklist ID": "OPH-0002"
  },
  "sections": [
    { "heading": "Procedure Details", "passages": [
      { "id": "OPH-0002.p01", "text": "Date of surgery: 3 August 2026" },
      { "id": "OPH-0002.p02", "text": "Patient class: Day case" },
      { "id": "OPH-0002.p03", "text": "Surgeon: Mr/Ms C Morgan" },
      { "id": "OPH-0002.p04", "text": "Procedure: Phacoemulsification with intraocular lens" },
      { "id": "OPH-0002.p05", "text": "Laterality: Left" },
      { "id": "OPH-0002.p06", "text": "Anaesthesia: Topical with intracameral lidocaine" },
      { "id": "OPH-0002.p07", "text": "Indication: Age-related nuclear cataract, left eye" } ] },
    { "heading": "Operative Findings", "passages": [
      { "id": "OPH-0002.p08", "text": "Grade 3 nuclear sclerotic cataract, left eye. Pupil dilated well to 7 mm. Anterior chamber deep and quiet." } ] },
    { "heading": "Procedure Performed", "passages": [
      { "id": "OPH-0002.p09", "text": "Temporal 2.4 mm clear corneal incision. Continuous curvilinear capsulorhexis. Phacoemulsification of the nucleus using a stop-and-chop technique, followed by irrigation/aspiration of cortex." },
      { "id": "OPH-0002.p10", "text": "Single-piece hydrophobic acrylic posterior chamber intraocular lens, +21.5 D, implanted in the capsular bag. Wounds hydrated and confirmed watertight. Intracameral cefuroxime given." } ] },
    { "heading": "Complications", "passages": [
      { "id": "OPH-0002.p11", "text": "None." } ] },
    { "heading": "Post-operative Instructions / Discharge Plan", "passages": [
      { "id": "OPH-0002.p12", "text": "Discharged with post-op drops" },
      { "id": "OPH-0002.p13", "text": "Patient given written post-operative eye-drop regimen and safety-net advice, and advised to attend eye casualty urgently if pain, reducing vision, or discharge develop." } ] },
    { "heading": "Follow-up", "passages": [
      { "id": "OPH-0002.p14", "text": "Routine post-operative review in 4 weeks with community optometrist." } ] }
  ],
  "referenceCodes": {
    "diagnoses": [ { "code": "H25.1", "title": "Senile nuclear cataract" } ],
    "procedures": [
      { "code": "C75.1", "title": "Insertion of prosthetic replacement for lens NEC" },
      { "code": "C71.2", "title": "Phacoemulsification of lens" },
      { "code": "Z94.3", "title": "Left sided operation" } ]
  }
}
```
> `referenceCodes` exists only in evaluation fixtures. In production it lives in a separate evaluation store and **must never be sent to the model or shown inside the Source document**.

### 9.4 Pipeline run: Auto-coded (OPH-0002, complete)
```json
{
  "worklistId": "OPH-0002",
  "annotations": [
    { "id": "a01", "passageId": "OPH-0002.p07", "span": "Age-related nuclear cataract, left eye", "concept": "Senile nuclear cataract", "category": "disorder", "status": "affirmed" },
    { "id": "a02", "passageId": "OPH-0002.p05", "span": "Laterality: Left", "concept": "Left eye structure", "category": "body structure", "status": "affirmed" },
    { "id": "a03", "passageId": "OPH-0002.p09", "span": "Phacoemulsification of the nucleus", "concept": "Phacoemulsification of lens", "category": "procedure", "status": "affirmed" },
    { "id": "a04", "passageId": "OPH-0002.p10", "span": "posterior chamber intraocular lens", "concept": "Insertion of posterior chamber intraocular lens", "category": "procedure", "status": "affirmed" },
    { "id": "a05", "passageId": "OPH-0002.p11", "span": "None.", "concept": "No complication", "category": "finding", "status": "affirmed" }
  ],
  "clinicalFacts": [
    { "id": "f01", "kind": "diagnosis", "statement": "Age-related nuclear cataract, left eye.", "passageIds": ["OPH-0002.p07", "OPH-0002.p08"], "annotationIds": ["a01"] },
    { "id": "f02", "kind": "procedure", "statement": "Lens removed by phacoemulsification.", "passageIds": ["OPH-0002.p09"], "annotationIds": ["a03"] },
    { "id": "f03", "kind": "implant", "statement": "Posterior chamber intraocular lens (+21.5 D) implanted in the capsular bag.", "passageIds": ["OPH-0002.p10"], "annotationIds": ["a04"] },
    { "id": "f04", "kind": "laterality", "statement": "Operation performed on the left eye.", "passageIds": ["OPH-0002.p05", "OPH-0002.p07"], "annotationIds": ["a02"] },
    { "id": "f05", "kind": "complication", "statement": "No intra-operative complication.", "passageIds": ["OPH-0002.p11"], "annotationIds": ["a05"] }
  ],
  "proposal": {
    "diagnoses": [
      { "code": "H25.1", "position": "primary", "factIds": ["f01"], "referenceIds": ["icd:H25.1", "std:DCS.VII.1", "std:DGCS.1"],
        "explanation": "Age-related nuclear cataract was the condition treated. DCS.VII.1 places age-related cataract in H25.-." }
    ],
    "procedureGroups": [
      { "label": "Left cataract extraction with lens implant",
        "codes": [
          { "code": "C75.1", "factIds": ["f03"], "referenceIds": ["opcs:C75.1", "std:PConvention2"],
            "explanation": "Lens implant inserted. C75 carries 'Use a supplementary code' for the extraction method, so it takes the primary position." },
          { "code": "C71.2", "factIds": ["f02"], "referenceIds": ["opcs:C71.2", "std:PConvention2"],
            "explanation": "Lens removed by phacoemulsification. C71 carries 'Use as an additional code', so it follows C75.1." },
          { "code": "Z94.3", "factIds": ["f04"], "referenceIds": ["opcs:Z94.3", "std:PCSZ2", "std:PRule7"],
            "explanation": "Left eye documented; laterality coded once, after the procedures on that site." }
        ] }
    ]
  },
  "openQuestions": [],
  "checks": { "outputFormat": "passed", "catalogueMembership": "passed", "evidenceReferences": "passed" },
  "codingResult": { "value": "auto-coded",
    "reason": "One condition, one operation, laterality consistent throughout, no complications. Every code is supported by a fact and a reference." }
}
```

### 9.5 Pipeline run: Sent to review, contradictory laterality (OPH-0022, excerpt)
Relevant passages:
```
OPH-0022.p05  Laterality: Right
OPH-0022.p07  Indication: Age-related nuclear cataract, right eye
OPH-0022.p10  Posterior chamber intraocular lens, +22.0 D, implanted in the capsular bag of the left eye. …
OPH-0022.p14  Clear shield to be worn over the left eye at night for one week.
```
```json
{
  "clinicalFacts": [
    { "id": "f04", "kind": "laterality",
      "statement": "Operated eye is contradictory: right in the procedure details and indication, left in the operative description and discharge plan.",
      "passageIds": ["OPH-0022.p05", "OPH-0022.p07", "OPH-0022.p10", "OPH-0022.p14"],
      "annotationIds": ["a02", "a03", "a04"] }
  ],
  "proposal": {
    "diagnoses": [ { "code": "H25.1", "position": "primary", "factIds": ["f01"], "referenceIds": ["icd:H25.1", "std:DCS.VII.1", "std:DGCS.1"], "explanation": "Age-related nuclear cataract was the condition treated." } ],
    "procedureGroups": [ { "label": "Cataract extraction with lens implant (eye unresolved)",
      "codes": [
        { "code": "C75.1", "factIds": ["f03"], "referenceIds": ["opcs:C75.1", "std:PConvention2"], "explanation": "Lens implant inserted …" },
        { "code": "C71.2", "factIds": ["f02"], "referenceIds": ["opcs:C71.2", "std:PConvention2"], "explanation": "Lens removed by phacoemulsification …" } ] } ]
  },
  "openQuestions": [
    { "id": "q01", "factIds": ["f04"], "question": "Which eye was operated on?",
      "revisited": "Re-read all four passages that mention the eye. Two say right and two say left; no passage explains the difference.",
      "blocks": "Laterality code (Z94.2 or Z94.3) cannot be assigned, and PCSZ2 requires documented laterality to be coded.",
      "status": "unresolved" }
  ],
  "codingResult": { "value": "sent-to-review",
    "reason": "The operated eye is documented as both right and left. A coder needs to query the surgeon before the laterality code can be assigned." }
}
```
The coder later resolved this as **right** (Reference codes: H25.1 | C75.1, C71.2, **Z94.2**). This is the expected post-review outcome in tests.

### 9.6 Pipeline run: Sent to review, standard override (OPH-0042, excerpt)
```
OPH-0042.p07  Indication: Mature white cataract, left eye; vision hand movements
OPH-0042.p08  Mature white cataract, left eye. No red reflex.
```
```json
{
  "clinicalFacts": [ { "id": "f01", "kind": "diagnosis",
    "statement": "Mature white cataract, left eye; the patient is 84, so the cataract is likely age-related.",
    "passageIds": ["OPH-0042.p07", "OPH-0042.p08"], "annotationIds": ["a01", "a02"] } ],
  "proposal": { "diagnoses": [ { "code": "H26.9", "position": "primary", "factIds": ["f01"],
    "referenceIds": ["icd:H26.9", "std:DCS.VII.1", "std:DGCS.1"],
    "explanation": "DCS.VII.1 requires mature or white cataract to be coded to H26.9, even though age-related cataract would otherwise go to H25.-." } ] },
  "openQuestions": [ { "id": "q01", "factIds": ["f01"],
    "question": "Confirm H26.9 rather than an H25 age-related cataract code.",
    "revisited": "Re-read the indication and findings: the cataract is described as mature and white, and not as age-related. DCS.VII.1 points to H26.9, but this overrides the most likely clinical category.",
    "blocks": "Primary diagnosis is proposed but not confirmed.", "status": "unresolved" } ],
  "codingResult": { "value": "sent-to-review",
    "reason": "The proposed primary diagnosis follows a coding standard that overrides the obvious clinical category. A coder confirms it before completion." }
}
```
Procedure group: C75.1, C71.2, Z94.3. Reference codes: H26.9 | C75.1, C71.2, Z94.3.

### 9.7 Golden set (regression fixtures)
| Worklist ID | Scenario | Expected Coding result | Expected diagnoses | Expected procedures (sequence) |
|---|---|---|---|---|
| OPH-0002 | Routine left phaco + IOL | Auto-coded | H25.1 | C75.1, C71.2, Z94.3 |
| OPH-0012 | Right eye; glaucoma (small pupil), type 2 diabetes, hypertension; iris hooks | Auto-coded | H25.1 (primary), H40.1, E11.9, I10.X | C75.1, C71.2, C64.7, Z94.2 |
| OPH-0032 | Both eyes, same session | Auto-coded | H25.1 | C75.1, C71.2, Z94.1 |
| OPH-0022 | Contradictory laterality | Sent to review (Z94 blocked) | H25.1 | C75.1, C71.2 (+ Z94.2 after coder answer) |
| OPH-0042 | Mature white cataract → DCS.VII.1 override | Sent to review (confirm primary) | H26.9 | C75.1, C71.2, Z94.3 |

Supporting facts for OPH-0012 (to test the comorbidity logic):
- f02 "Primary open-angle glaucoma, both eyes, on treatment; the surgeon links it to the poorly dilating pupil." → H40.1, DGCS.3 (relevant to the Episode).
- f03 "Type 2 diabetes, no documented diabetic eye disease; cataract is not attributed to diabetes." → E11.9 (DGCS.3, DCS.IV.1).
- f04 "Diagnosed hypertension, on amlodipine." → I10.X (DGCS.3, DCS.IX.1).
- f05 "Iris hooks inserted to expand a small pupil during lens extraction." → C64.7 (supplementary).

### 9.8 Reference library entries (sample)
```json
[
  { "id": "opcs:C75.1", "kind": "classification", "source": "OPCS-4.11", "code": "C75.1",
    "title": "Insertion of prosthetic replacement for lens NEC",
    "note": "C75 Prosthesis of lens: Use a supplementary code to identify method of concurrent extraction of lens (C71-C74)",
    "url": "https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-1.html" },
  { "id": "opcs:C71.2", "kind": "classification", "source": "OPCS-4.11", "code": "C71.2",
    "title": "Phacoemulsification of lens",
    "note": "C71 Extracapsular extraction of lens: Use as an additional code when associated with concurrent insertion of prosthetic replacement for lens (C75.1)" },
  { "id": "icd:H25.1", "kind": "classification", "source": "ICD-10 5th Edition (2026)", "code": "H25.1", "title": "Senile nuclear cataract" },
  { "id": "std:DCS.VII.1", "kind": "standard", "source": "National Clinical Coding Standards ICD-10 5th Edition 2026 [V12.0]",
    "standard": "DCS.VII.1", "page": 100, "url": "https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf",
    "summary": "Age-related cataract must be coded to H25.-. Mature, advanced or white cataract must be coded to H26.9 Cataract, unspecified." },
  { "id": "std:PCSZ2", "kind": "standard", "source": "National Clinical Coding Standards OPCS-4 2026 [V13.1]",
    "standard": "PCSZ2: Laterality of operation (Z94)", "page": 204, "url": "https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf",
    "summary": "Documented laterality must be coded, once, after all procedures on the same site. The same procedure on both sides is coded once with Z94.1." },
  { "id": "std:DGCS.3", "kind": "standard", "source": "National Clinical Coding Standards ICD-10 5th Edition 2026 [V12.0]",
    "standard": "DGCS.3: Comorbidities and Appendix 1: Comorbidities list", "page": 36,
    "summary": "Conditions on the Appendix 1 list (including diabetes mellitus and hypertension) must always be coded for any episode, including day cases, when documented. Other conditions are coded when the responsible consultant documents them as relevant to the episode." }
]
```
The full seed set has 19 entries: icd:H25.1, H26.9, H40.1, E11.9, I10.X; opcs:C75.1, C71.2, C64.7, Z94.1, Z94.2, Z94.3; std:DGCS.1, DGCS.3, DCS.IV.1, DCS.VII.1, DCS.IX.1, PConvention2, PRule7, PCSZ2.

---

## 10. Functional requirements (UI)

### 10.1 Worklist (home)
- Table of all Worklist items: Worklist ID (mono), activity, patient class, activity date, coding status, Coding result badge, and last run time.
- Filters: kind (Episodes / Attendances / all), coding status, Coding result, date range, free-text search (ID, hospital number, name).
- Attendances are visible but visually secondary, with a note: "Not coded in this version".
- Bulk action: **Run pipeline** on selected or all eligible Cataract operations. Progress is shown per row (stage name and a spinner), live via SSE.
- Default sort puts **Sent to review** first, then by date.
- **AC:** a coder can find every Episode awaiting review in ≤2 interactions, and live status updates without a page reload.

### 10.2 Episode workspace
Layout: the **Source document** on the left (paper style, passages individually addressable), the six-step stage rail across the top, and the stage content on the right.

Steps: **Documents → MedCAT annotations → Clinical facts → Coding references → Proposed codes → Coding result**.

| Interaction | Requirement |
|---|---|
| Select a Clinical fact | Highlight all of its Source passages in the document and scroll the first into view; show linked annotations |
| Select a Proposed code | Show its supporting facts, the Source passages (highlighted), each Coding reference (title, rule summary, page, link) and the explanation |
| Select a passage | Show which annotations, facts and codes cite it (reverse lookup) |
| Diagnoses vs procedures | Always shown separately. Procedure groups are shown as ordered lists with sequence numbers. Multiple codes per Episode and per group are supported. |
| Annotations | Clearly labelled "hints". Never shown as the reason for a code. |
| Coding result | Badge (Auto-coded / Sent to review), plain-English reason, check list with pass/fail, Open questions |
| Run metadata | Model, emulated role, prompt version, reference-library version, run time. Visible but secondary. |
| Versions and citations | Every Coding reference shows its source + version + page |

- **AC:** from any displayed code, a coder reaches the exact supporting passage text in one click.
- **AC:** the workspace explains *why* an Episode was auto-coded or sent to review, in words, without a numeric confidence.

### 10.3 Review workflow (Sent to review)
1. The Open question card is shown at the top, with question, revisited, blocks and the linked passages pre-highlighted.
2. The coder answers by choosing from generated options where possible (e.g. "Right eye (Z94.2)" / "Left eye (Z94.3)" / "Query surgeon") or with free text.
3. On answer, the system re-runs stages 5–7 with the answer injected as a coder-supplied fact (`kind: "other"`, source `coder`), or applies the direct code change.
4. The coder can **edit codes**: add or remove codes (search the catalogue), reorder, and set the primary. Edits are validated live by checks C2, C4 and C6. Invalid sequencing is blocked, with the rule shown (e.g. "PRule 7: Z94.2 cannot be primary").
5. **Complete** saves the FinalCoding, sets status to Completed and writes the audit events.
6. **"Query surgeon"** sets the status to "Query required" and stores the query text. The Episode leaves the active queue until it is answered.

- **AC:** OPH-0022 can be completed as H25.1 | C75.1, C71.2, Z94.2 after answering "Right eye".
- **AC:** OPH-0042 can be completed by confirming H26.9.

### 10.4 Auto-coded spot-check
- A configurable sampling rate (e.g. 10%) routes Auto-coded Episodes into a "Spot-check" queue. The coder confirms or corrects them, and each correction is logged as a **false auto-code** for metrics.

### 10.5 Dashboard (coding lead)
- Counts: Auto-coded vs Sent to review; top review reasons (grouped by Open question type: laterality, standard override, missing evidence, system error…); false auto-code count; median time-to-complete; pipeline failures.
- Everything is filterable by date. **No confidence charts.**

### 10.6 Reference library browser
- Search codes and standards. Each shows title, notes (e.g. "Use a supplementary code"), version, page and URL. The active library version is shown.

### 10.7 Audit
- Per Worklist item, an append-only timeline of: ingest, each pipeline run (with stage metadata), each Open question answer, code edits (before/after), completion and export.

---

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| **Data protection** | **Development and demo use synthetic data only.** Sending real patient data to Gemini (a cloud API) requires an approved DPIA / information-governance sign-off, a data-processing agreement, UK/EU data residency and no training on customer data. The target production deployment is **local** (MedCAT + MedGemma on-premise); the adapters make that swap possible. Strip or pseudonymise direct identifiers (name, NHS number, DOB) from model prompts. The Worklist ID and passage text are enough. |
| **Safety** | Default to Sent to review on any error. Never auto-code when checks fail or an Open question exists. |
| **Honesty in UI** | No numeric confidence until calibrated. Label demo/prepared data as such. Show "hint" on annotations. |
| **Auditability** | Store all inputs, prompts (by version), raw outputs, checks, decisions and user actions. Runs are reproducible from stored inputs. |
| **Performance** | Target ≤60 s per Episode end-to-end (pilot), with batch runs in parallel. The UI shows progress per stage. Worklist loads in ≤1 s for 5,000 items. |
| **Reliability** | Idempotent runs; retries with backoff on model or API errors; a stuck-run timeout goes to Sent to review. |
| **Security** | SSO (NHS login / Azure AD), role-based access, TLS, encryption at rest, secrets in a vault, least-privilege API keys. |
| **Accessibility** | WCAG 2.2 AA; full keyboard navigation (fact → passage → code); visible focus; colour is never the only signal (badges include icon + text). |
| **Browser support** | Current Chrome/Edge (NHS estate) and Firefox; minimum 1366×768, designed for 1920×1080. |
| **Versioning** | Reference library, prompts and model config are each versioned, with the version recorded on every run. |

---

## 12. Recommended architecture (not mandated)

**Constraint from the owner:** Gemini Flash stands in for **both MedCAT and MedGemma** in the MVP. All other choices below are recommendations.

| Layer | Recommendation | Why |
|---|---|---|
| Frontend | TypeScript + React (Vite) or Next.js; TanStack Query; a component kit on Radix primitives | Rich interactive evidence UI; typed contracts shared with the backend |
| Backend API | **Python (FastAPI)** | The real MedCAT is Python. Keeping the pipeline in Python makes the later swap trivial. |
| Pipeline workers | Background job queue (e.g. Celery / RQ / Arq) with one job per run and each stage persisted | Batch runs, retries, SSE progress |
| Model access | Google Gemini API (Flash) with JSON-schema structured output; pinned model version in config | Stand-in for MedCAT and MedGemma |
| Database | PostgreSQL (JSONB for stage outputs) | Relational core + flexible run payloads |
| Reference search | Postgres full-text + pgvector over code titles, notes and standard summaries | One datastore |
| Schemas | JSON Schema generated from Pydantic models, with TS types generated from the schema | One source of truth for contracts (§8.2) |
| Deployment | Containerised (Docker). Pilot in a cloud dev environment with synthetic data; production target on-premise. | Local deployment goal |

---

## 13. Theme and UI standards (brief)

The Deck established the visual language. The app adapts it for all-day work: **calm, dense, legible**, with motion used only for feedback.

### 13.1 Principles
1. **Evidence first**: the document and its highlighted passages are always one click away.
2. **The paper document is sacred**: Source documents render as light "paper" cards, even in dark mode, so clinical text looks like clinical text.
3. **Status by colour + icon + word**: teal = active/selection, green = Auto-coded, amber = Sent to review / Open question.
4. **Codes are monospace**, always.
5. **No decorative motion in the workspace**: transitions ≤200 ms, respecting `prefers-reduced-motion`. Motion is reserved for highlight sweeps and newly arrived results.

### 13.2 Tokens (three layers: primitive → semantic → component)
Dark theme (from the Deck; default for demos, optional for coders):

| Semantic token | Value | Use |
|---|---|---|
| `--color-bg` | `#08111F` | App background |
| `--color-surface` | `#0C1829` | Panels |
| `--color-surface-raised` | `#112037` | Cards |
| `--color-border` | `rgb(255 255 255 / .08)` | Hairlines |
| `--color-text` | `#E6EDF6` | Primary text |
| `--color-text-muted` | `#8A9BB4` | Secondary text |
| `--color-accent` | `#2DD4BF` (teal 400) | Selection, links, active step |
| `--color-success` | `#4ADE80` | Auto-coded, passed checks |
| `--color-warning` | `#FBBF24` | Sent to review, Open questions |
| `--color-paper` | `#F8F6F1` | Source document background |
| `--color-ink` | `#18202D` | Source document text |
| `--color-mark` | `rgb(20 184 166 / .24)` | Evidence highlight on paper |
| `--color-mark-warning` | `rgb(245 158 11 / .30)` | Contradiction highlight on paper |

Light theme (**recommended default for coders**; derive from the same primitives): bg `#F5F7FA`, surface `#FFFFFF`, border `#E2E8F0`, text `#0F172A`, muted `#475569`, accent `#0D9488` (teal 600, for AA on white), success `#15803D`, warning `#B45309`. The paper and mark tokens are unchanged.

**Typography:** Inter (UI; 400/500/600/700) + JetBrains Mono (codes, IDs, passage IDs, versions). Self-host the fonts (no third-party CDN in NHS environments). Scale: 12 / 14 / 16 (body) / 18 / 22 / 28 / 36. Line-height is 1.45 for document text.

**Spacing:** 4 px grid (4, 8, 12, 16, 24, 32, 48). **Radius:** 4 (chips), 8 (codes, passages), 12 (cards), 999 (badges).

### 13.3 Core components
| Component | Spec |
|---|---|
| **Code pill** | Mono code (bold) + title (muted, small) + optional note (mono, uppercase, accent). Variants: default, primary (accent border/background), warning, ghost/dashed (unresolved, e.g. `Z94.?`). |
| **Passage** | Block in the paper document with its ID in the gutter (mono, faint). States: idle, hover, highlighted (mark background), contradiction (warning mark). |
| **Annotation chip** | Concept (accent) + category (mono, uppercase). Always labelled as a hint. |
| **Fact card** | Kind label (mono, uppercase, accent) + statement + passage-count link. |
| **Reference card** | Source + version + page (mono, faint), standard ID/title, one-line summary, external link. |
| **Coding result badge** | Pill with icon + text: ✓ Auto-coded (green) / ? Sent to review (amber). Never colour alone. |
| **Open question card** | Amber-tinted panel: label, question (semibold), revisited, blocks, answer actions. |
| **Stage rail** | Six steps with dot + label. States: done, active (accent), pending. Clickable. |
| **Evidence connectors** (optional, from the Deck) | Thin curved lines from a selected code or fact to its passages, drawn on selection only. |

### 13.4 Copy standards
- Use the §4 vocabulary exactly ("Episode", "Open question", "Sent to review").
- Sentence case everywhere; UK English (e.g. "anaesthesia", "haemorrhage").
- Explanations are 1–2 short sentences that name the rule ("C75 carries 'Use a supplementary code', so it takes the primary position.").

---

## 14. Delivery plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Foundations** (1–2 wks) | Repo, schemas (§8.2), synthetic dataset import (50 items), reference-library seed, auth stub | Worklist and document viewer render the synthetic data |
| **1. Walkthrough on fixtures** (2 wks) | Episode workspace + six steps + evidence interactions, driven by the 5 prepared runs (`prepared: true`) | All flow.md acceptance criteria met on fixtures |
| **2. Live pipeline** (3–4 wks) | Gemini adapters for stages 2/3/5/6, retrieval, checks C1–C6, routing, SSE progress, run storage | Golden set (§9.7) passes from a live run; failures route to review |
| **3. Review workflow** (2 wks) | Open question answering, code editing with live validation, complete, query surgeon, audit | OPH-0022 and OPH-0042 completable with the expected Reference codes |
| **4. Pilot readiness** (2 wks) | Dashboard, spot-check sampling, export, full TRUD catalogue, accessibility pass, IG documentation | Coding lead sign-off; DPIA drafted |
| **Later** | Real MedCAT (SNOMED CT concepts) and MedGemma 1.5 local deployment; calibration; wider validation; EPR write-back; more specialties | |

---

## 15. Open questions, assumptions and risks

**Assumptions**
- One cataract Episode = one spell = one operation (true for elective day cases).
- Operation notes are available as text (no OCR in the MVP).
- "Gemini Flash" means the current Flash model; the Deck quoted **Gemini 3.8 Flash**. Pin the exact version in config.

**Open questions for the owner**
1. Pilot data source: will real (pseudonymised) notes be used, and under which IG approval?
2. Is export format fixed by the trust's PAS/coding system (e.g. a specific CSV layout or HL7)?
3. Should Attendances ever be coded (optional OPCS in outpatient CDS), or stay out of scope?
4. Spot-check sampling rate and who owns false-auto-code review.
5. Light or dark default theme for coders (recommendation: light).

**Risks**
| Risk | Mitigation |
|---|---|
| Gemini as a MedCAT stand-in produces annotations without ontology IDs; possible hallucinated spans | Substring validation (C3); annotations are hints only; swap to real MedCAT later |
| False auto-codes | Strict routing, sequencing checks, spot-check sampling, golden-set regression on every prompt/model change |
| Cloud model and patient data | Synthetic data only until IG approval; local-model target |
| Reference library drift (annual NCCS / OPCS updates) | Versioned library; runs record the version; re-validation on update |
| Over-trust in the UI | No confidence numbers; always show evidence and reason; "hint" labelling |

---

## 16. Sources

- National Clinical Coding Standards **OPCS-4 2026**, V13.1, April 2026: https://classbrowser.nhs.uk/ref_books/OPCS-4.11_NCCS-2026.pdf
- National Clinical Coding Standards **ICD-10 5th Edition 2026**, V12.0, April 2026: https://classbrowser.nhs.uk/ref_books/ICD-10_2026_5th_Ed_NCCS.pdf
- **OPCS-4.11 Tabular List**, Chapter C: https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-1.html; Chapter Z: https://classbrowser.nhs.uk/OPCS-4.11/volume1-p2-9.html (mandated from 1 April 2026)
- NHS Data Model and Dictionary: Consultant Episode (Hospital Provider); Hospital Provider Spell; Patient Classification; CDS V6-3 Type 130 (APC) and Type 020 (Outpatient); PRIMARY PROCEDURE (OPCS). Pages last published 15/07/2026.
- NHS England Digital, Hospital Admitted Patient Care Activity 2024-25 (25 Sep 2025).
- NHS England, Cataract procedures costing standard PAR1304 (v1, March 2022). Costing context only.
- Code and standard files for production: **NHS TRUD** (ICD-10 5th Edition, OPCS-4.11 releases).