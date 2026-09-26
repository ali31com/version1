# Codegem: project overview
This is Data from another project.
we will be using the same name for our project " CodeGem".

use the data below to show nice ui and good visuals and the structure of the data and jsons.

make your own choices when it comes to tech stack decisions and dont take it from below.

for example this says it will use local modals, we will use gemini flash in reality to pretend to be other models.


Codegem is a local, **shadow-mode** clinical coding prototype for NHS England routine cataract surgery. It reads a patient episode (operative note, pre-operative assessment and similar documents), extracts cataract-related facts with character-level evidence, retrieves candidate codes from a versioned reference pack, obtains a coding proposal from a local model, validates that proposal against the evidence and the pack, and writes two JSON files. Every output is a proposal for a human coder to review. Nothing is submitted to any coding or payment system.

All bundled data is synthetic. Codes beginning `DEMO-` are invented. Codes in the generated case datasets are recalled from memory, are marked `unverified_requires_coder_review`, and must not be used for real coding.

## 1. Purpose and scope

| Item | Current state |
| --- | --- |
| Specialty | Cataract (module `CataractModule`) |
| Target cases | Routine, uncomplicated phacoemulsification with intraocular lens implantation (the simple, high-volume cases) |
| Care settings | `day_case`, `admitted_patient` |
| Classifications | ICD-10 (diagnoses) and OPCS-4 (procedures), loaded from a reference pack |
| Output | Two JSON files per episode, always requiring review; automatic acceptance is disabled |
| Not in scope | Outpatient contacts, complicated surgery (routed to `out_of_scope`), bilateral or staged episodes, full national coding standards |

## 2. End-to-end flow

```
episode bundle (JSON, txt/docx/pdf documents)
        |
        v
 1. Ingest        load_bundle: read documents, hash them, normalise whitespace with an offset map
        |
        v
 2. Extract       optional MedCAT mentions + cataract rule adapter -> mentions, facts, relationships,
                  contradictions, missing information, scope (routine / complex / unknown)
        |
        v
 3. Gate          reference pack must exist and apply (date, jurisdiction, care setting);
                  scope must be "routine"; a local model provider must be available
        |
        v
 4. Retrieve      candidate reference entries whose index terms match extracted fact labels
        |
        v
 5. Propose       local model provider returns JSON decisions (code, role, evidence IDs, rule IDs, justification)
        |
        v
 6. Validate      every decision checked against the reference pack, the evidence and the episode facts
        |
        v
 7. Decide        principal diagnosis, additional diagnoses, procedures, supplementary codes,
                  candidate comorbidity decisions, review reasons
        |
        v
 8. Persist       episode_extraction.json, coding_result.json, commit.json (integrity hashes), audit.jsonl
```

Status values: `accepted`, `needs_review`, `out_of_scope`, `blocked_missing_reference`, `processing_failed`. With automatic acceptance off (the current configuration) a successful run ends as `needs_review` with the reason "shadow mode: proposal requires review".

### Stage details

**1. Ingest** (`src/codegem/ingest.py`). Documents may hold inline UTF-8 text or a relative path to `.txt`, `.docx` or a text PDF. Scanned PDF pages are read only with `--allow-local-ocr` (local Tesseract). Each document gets a SHA-256 hash. Text is preserved exactly; a normalised copy (collapsed whitespace) is kept with an offset map back to the original. Character offsets everywhere are zero-based Python Unicode positions, start inclusive, end exclusive, into the preserved `text`.

**2. Extract** (`src/codegem/extract.py`, `specialties.py`).
- An optional `MedCATAdapter` loads a MedCAT 2.x model pack, runs `get_entities` on each document and turns each entity into a `Mention` (CUI, preferred name, offsets, meta-annotations).
- The rule adapter scans for the cataract module's patterns: cataract (with subtype prefix such as age-related, senile, diabetic, nuclear sclerotic, posterior subcapsular, cortical), phacoemulsification, lens implantation, diabetes, hypertension, chronic kidney disease, COPD, atrial fibrillation, glaucoma, dementia, anticoagulant use, vitrectomy, posterior capsule rupture, endophthalmitis.
- Each match gets local context cues: negated, family, uncertain, planned, cancelled, historical, medication-context, and laterality (left, right, bilateral) from the same sentence.
- Mentions become `Fact`s with a status (`documented`, `planned`, `performed`, `cancelled`, `historical`, `uncertain`) and an episode relevance (`supported`, `unsupported`, `unresolved`).
- A performed procedure is linked to a same-document, laterality-compatible cataract diagnosis (`procedure_for_diagnosis`). Conflicts become contradictions.
- Scope is `complex` if vitrectomy, posterior capsule rupture or endophthalmitis is supported (or there are contradictions), `routine` if there are no limitations or missing information, otherwise `unknown`.
- Missing information can be `operative_note_missing`, `operated_eye_unknown`, `procedure_date_unknown`, `lens_implantation_unresolved`.

**3-4. Gate and retrieve** (`pipeline.py`, `references.py`). The pipeline stops early with an explanatory review reason if there is no pack, the pack does not apply, synthetic and production modes mismatch, MedCAT is missing in production mode, or no provider exists. Non-routine scope stops as `out_of_scope` (complex) or `needs_review` (unknown). Otherwise candidate entries are those whose `index_terms` match extracted fact labels.

**5. Propose** (`model.py`). Providers implement `propose(extraction, pack)`:
- `MedGemmaProvider` loads a local Transformers model directory and prompts it with the untrusted episode JSON, excerpts, candidate entries and rules. Output must be JSON matching `CodingProposal`.
- `SyntheticProvider` (demo only) proposes every candidate entry for supported, affirmed, certain, patient-owned facts.

**6. Validate** (`pipeline.validate`). A decision is rejected if any of these hold:
- The code is not in the pack, or is duplicated or incomplete.
- Its role is not allowed for the entry, or the classification does not match the role (ICD-10 codes take diagnosis roles; OPCS-4 codes take procedure or supplementary roles).
- The evidence IDs are missing or do not resolve, or the offsets do not match the text.
- The evidence mention is negated, uncertain or not the patient's.
- The supporting fact is planned, cancelled or uncertain (or historical for a procedure).
- An OPCS-4 code lacks a performed procedure fact.
- The fact label is not one of the entry's index terms.
- The evidence laterality conflicts.
- Rule IDs are missing, unknown, or do not include the entry's required rules.
- A comorbidity ICD-10 code lacks its reportability rule.
- Required supplementary codes are absent, or excluded codes are present.

**7-8. Decide and persist** (`storage.py`, `audit.py`). Outputs are written atomically with a lock. A repeated episode ID with a different document manifest is refused. `commit.json` binds the SHA-256 of both result files. `audit.jsonl` is a hash-linked, append-only local log.

## 3. Input format: episode bundle

One JSON file per episode (`EpisodeInput`). The CLI also accepts a directory of bundle files.

```json
{
  "patient_id": "SYNTH-P015",
  "episode_id": "SYNTH-E015",
  "episode_date": "2025-12-02",
  "jurisdiction": "NHS_ENGLAND",
  "care_setting": "day_case",
  "documents": [
    {
      "document_id": "op-note",
      "document_type": "operative_note",
      "timestamp": "2025-12-02T09:20:00Z",
      "author": "Synthetic specialty doctor",
      "text": "Right cataract.\nOperation date: 2 December 2025. Operated eye: right.\n..."
    },
    {
      "document_id": "history",
      "document_type": "preoperative_assessment",
      "timestamp": "2025-11-24T09:00:00Z",
      "author": "Synthetic preoperative nurse",
      "text": "Preoperative assessment: ASA grade 2. Comorbidities: type 2 diabetes mellitus (diagnosed 2018), on metformin; HbA1c 49 mmol/mol. hypertension. Allergies: none recorded."
    }
  ]
}
```

| Field | Rules |
| --- | --- |
| `patient_id`, `episode_id` | Opaque, filesystem-safe IDs matching `[A-Za-z0-9][A-Za-z0-9_-]{0,127}` |
| `episode_date` | ISO date; must fall inside the reference pack's effective interval |
| `jurisdiction` | `NHS_ENGLAND` |
| `care_setting` | `day_case` or `admitted_patient` |
| `documents[]` | At least one; unique `document_id`; `document_type`; `text` or a relative file path; optional `timestamp`, `author` |
| Operative note | Needed to establish a performed procedure. Without it the episode is not routine and goes to review |

The supplied 50-row worklist CSV can also be imported by `codegem.worklist`. Its five cataract day case surgery rows become `worklist_summary` episodes, flagged `operative_note_missing`; its prefilled codes are not used as answers.

## 4. Reference pack (input)

`ReferencePack` is a JSON import interface for classification content:

| Field | Meaning |
| --- | --- |
| `pack_id`, `jurisdiction`, `care_settings` | Identity and applicability |
| `effective_from`, `effective_to` | Date interval the pack applies to |
| `classification_releases` | Release IDs for `ICD-10` and `OPCS-4` |
| `standards_release`, `source_provenance`, `licence_acknowledged`, `synthetic` | Provenance and licensing flags |
| `rules[]` | `rule_id`, `text`, `source` |
| `entries[]` | `code`, `description`, `classification`, `allowed_roles`, `index_terms`, `tabular_notes`, `rule_ids`, optional `reportability_rule_ids`, `requires`, `excludes`, `complete`, and importer attestations `index_verified`, `tabular_verified`, `standards_verified` |

Production packs require every entry to carry all three verification attestations and explicit roles. The attestations are importer statements, not independent verification. The bundled `fixtures/synthetic_references.json` holds three invented entries: `DEMO-CAT`, `DEMO-PHACO`, `DEMO-IOL`. No NHS ICD-10, OPCS-4 or standards content is included.

## 5. Output formats

### `episode_extraction.json` (`EpisodeExtraction`)

| Field | Content |
| --- | --- |
| `specialty`, `primary_diagnosis_label` | `cataract` |
| `episode` | The ingested episode with document hashes and normalisation maps |
| `mentions[]` | `mention_id`, `document_id`, `start`, `end`, `text`, optional `concept_id`, `terminology`, `preferred_label`, `negation`, `certainty`, `temporality`, `experiencer`, `laterality`, `section`, `context`, `component`, `meta_annotations` |
| `facts[]` | `fact_id`, `kind` (diagnosis, procedure, medication, finding), `label`, `mention_ids`, `status`, `laterality`, `event_date`, `episode_relevance`, `attributes` (for example `cataract_type`) |
| `relationships[]` | Links such as `procedure_for_diagnosis` |
| `comorbidity_candidate_ids` | Non-cataract diagnosis and medication facts awaiting a reportability decision |
| `contradictions`, `missing_information`, `limitations`, `review_reasons` | Reasons an episode is not routine or needs attention |
| `scope` | `routine`, `complex` or `unknown` |
| `model_versions`, `pipeline_version` | Provenance |

### `coding_result.json` (`CodingResult`)

```json
{
  "schema_version": "1.0.0",
  "patient_id": "SYNTH-P003",
  "episode_id": "SYNTH-E003",
  "status": "needs_review",
  "principal_diagnosis": {"code": "DEMO-CAT", "classification": "ICD-10", "role": "principal_diagnosis",
                          "release": "SYNTHETIC", "evidence_ids": ["op-note:rule:0", "op-note:rule:1"],
                          "rule_refs": ["DEMO-DX"], "justification": "Synthetic fixture proposal"},
  "additional_diagnoses": [],
  "procedures": [{"code": "DEMO-PHACO", "classification": "OPCS-4", "role": "procedure", "...": "..."},
                 {"code": "DEMO-IOL", "classification": "OPCS-4", "role": "procedure", "...": "..."}],
  "supplementary_codes": [],
  "candidate_decisions": [],
  "rejected_candidates": [],
  "unresolved_candidates": [],
  "validation_failures": [],
  "review_reasons": ["shadow mode: proposal requires review"],
  "model_hash": "...", "prompt_hash": "...", "reference_hash": "...", "configuration_hash": "...",
  "acceptance_mode": "shadow",
  "total_latency_ms": 0, "model_latency_ms": 0, "process_peak_rss_mb": 0
}
```

Each code decision (`CodeDecision`) carries `code`, `description`, `classification`, `role`, `release`, `evidence_ids`, `rule_refs`, `justification` and `correctness_probability` (null). `candidate_decisions[]` records `included`, `excluded` or `unresolved` for each comorbidity fact. JSON Schemas are generated into `schemas/` by `scripts/export_schemas.py`.

### Storage files (per episode folder `<store>/<patient_id>/<episode_id>/`)

| File | Purpose |
| --- | --- |
| `episode_extraction.json`, `coding_result.json` | The two outputs |
| `commit.json` | SHA-256 of both files, checked on read |
| `audit.jsonl` | Hash-linked events (`proposal_created`, `review_edit`) |

## 6. Interfaces

**CLI** (`codegem`):

```bash
codegem <bundle.json | bundle-dir> --reference-pack <pack.json> [--demo] \
        [--medcat-pack <zip|dir> --terminology-release <id>] [--medgemma-model <dir>] \
        [--allow-local-ocr] [--auto-accept-policy <file> --evaluation-report <file>] \
        --output <dir>
```

`--demo` uses only synthetic assets. Production runs omit it and require a reference pack, a MedCAT pack and a MedGemma model. For a directory input the results go under `<output>/<patient_id>/<episode_id>/`. `CODEGEM_KILL_SWITCH=1` disables processing.

**API** (FastAPI, local, bearer token in `CODEGEM_API_TOKEN`):

| Route | Purpose |
| --- | --- |
| `POST /episodes` | Submit an episode JSON; returns the coding result |
| `GET /review/{patient_id}/{episode_id}` | HTML review page showing each proposed code with its evidence and rule text |
| `POST /review/{patient_id}/{episode_id}/edits` | Append a reviewer edit (`reviewer`, `reason`, `edits`) to the audit log |

Configuration comes from `CODEGEM_STORE`, `CODEGEM_REFERENCE_PACK`, `CODEGEM_MEDCAT_PACK`, `CODEGEM_TERMINOLOGY_RELEASE`, `CODEGEM_MEDGEMMA_MODEL`, and the acceptance variables below. Local inference is serialised, and a busy worker returns 503. A repeated episode ID with different documents returns 409. A `Dockerfile` runs the API as a non-root user.

**Automatic acceptance.** The built-in `prototype_partial` validator profile keeps automatic acceptance disabled. The gate (`acceptance.py`) accepts an episode only with a signed, date-limited policy bound to exact reference, model and prompt hashes, a hashed evaluation report, an approved specialty and care setting, complete critical attributes, resolved comorbidity decisions and passing validation. Any failed gate leaves the episode as `needs_review` with reasons. No episode can currently be auto-accepted.

## 7. MedCAT assets

| Asset | Location | State |
| --- | --- | --- |
| SNOMED International CDB input | `local-results/snomed-international-20260901/snomed_cdb_input.csv` | 672,837 name rows across 384,050 active concepts, built from the 20260901 RF2 release (columns `cui,name,ontologies,name_status,type_ids`) |
| SNOMED cataract-scope pack | `local-results/snomed-cataract-mock-pack/` | 519 concepts, 958 names, 630-word vocabulary with 64-dimension deterministic hash vectors, no unsupervised training, no MetaCAT |
| Synthetic three-stage pack | `examples/medcat_three_stage/` | Invented concepts; create, unsupervised train and run stages completed |
| Smoke-test pack and outputs | `examples/medcat_smoke_test/`, `examples/medcat_*_output*.json` | Technical demonstration only |

Related scripts: `build_snomed_medcat_pack.py`, `build_mock_snomed_cataract_pack.py`, `build_synthetic_medcat_pack.py`, `build_synthetic_medcat_stage1.py`, `train_medcat_unsupervised.py`, `run_medcat_csv.py`, `download_trud_snomed.py`. `run_medcat_csv.py` reads an `id,text` CSV and writes raw MedCAT 2.x annotations. `docs/medcat_workflow.md` describes the MedCAT 2.x differences from the upstream `working_with_cogstack` notebooks. The UK Clinical Edition and MetaCAT models are not present.

## 8. Datasets

### 8.1 Ophthalmology narrative corpus (`examples/synthetic_ophthalmology/`)

| File | Content |
| --- | --- |
| `synthetic_documents.csv` | 500 free-text documents: `document_guid,text`. Types: cataract pre-op, operative, post-op, glaucoma, medical retina, eye casualty, referral, general clinic, oculoplastic and ocular surface |
| `simulated_medcat_output.csv` | 7,061 template-derived entities linked by `document_guid` |
| `claude_medcat_annotations.json` | 24 documents annotated by hand (327 entities) |
| `claude_annotations_spec.txt` | Source list for the hand annotations |
| `coding_dataset.json` | Coding outcomes for those 24 documents (2 simple cases coded, 1 out of scope, 21 not coded) |

`simulated_medcat_output.csv` columns: `entity_id, document_guid, cui, pretty_name, semantic_tag, source_value, start, end, subject, time, presence`.

Annotation JSON shape (`claude_medcat_annotations.json`), keyed by `document_guid`:

```json
{
  "<document_guid>": {
    "document_guid": "...", "text": "...",
    "entities": {
      "0": {"id": 0, "document_guid": "...", "cui": "225581002", "pretty_name": "Sight deteriorating",
            "semantic_tag": "finding", "source_value": "reduced vision", "start": 75, "end": 89,
            "meta_anns": {"Subject": {"value": "Patient"}, "Time": {"value": "Present"}, "Presence": {"value": "True"}}}
    }
  }
}
```

Meta-annotation value sets: Subject = Patient, Family, Other. Time = Past, Present, Future. Presence = True, False, Hypothetical. CUIs, preferred names and semantic tags come from the SNOMED International release. Generators: `scripts/generate_synthetic_ophthalmology.py` (template labels) and `scripts/build_annotation_json.py` (hand annotations to JSON).

### 8.2 Routine cataract surgery cases (`examples/cataract_cases_100/`)

100 synthetic episodes for pipeline testing, generated by `scripts/generate_cataract_cases.py` (fixed seed).

| File | Content |
| --- | --- |
| `bundles/SYNTH-E001.json` to `SYNTH-E100.json` | Pipeline-ready episode bundles (operative note plus pre-operative assessment) |
| `expected_coding.json` | Expected coding per case |
| `simulated_annotations.json` | MedCAT-style annotations per document, with span-checked offsets |

Every case is uncomplicated day case phacoemulsification with a posterior chamber lens in the capsular bag. Indications: cataract (unspecified), age-related, nuclear sclerotic, posterior subcapsular, cortical. Eye: right or left.

Expected coding conventions (all marked `unverified_requires_coder_review`):

| Element | Codes |
| --- | --- |
| Procedures | OPCS-4 `C71.2` (phacoemulsification), `C75.1` (lens insertion), `Z94.1` right or `Z94.2` left |
| Principal diagnosis | `H26.9` cataract unspecified; `H25.9` age-related; `H25.1` nuclear; `H25.0` posterior subcapsular or cortical |
| Comorbidities | Confirmed diagnoses only: `E11.9` type 2 diabetes, `E10.9` type 1 diabetes, `Z79.4` insulin, `I10`, `J44.9`, `J45.9`, `I48.9`, `I25.2`, `F03`, `G20`, `E66.9`, `E03.9`, `N40` |

Comorbidity handling in the cases:
- **Confirmed diabetes:** 17 cases. Each expects an additional diagnosis code. Diabetes is flagged `stated_by_user_affects_tariff_verify_against_hrg_grouper`; other comorbidities are flagged `unknown_verify_against_hrg_grouper_cc_list`.
- **Traps (16 cases):** the assessment mentions diabetes in a way that must not be coded as the patient's diagnosis. These are metformin listed with no confirmed diagnosis, diabetes explicitly negated, a family history of diabetes, and diabetes only "possible" and awaiting confirmation. The `must_not_code` field lists the excluded codes and the reason, and `review_expectation` is `needs_review` for these.

Expected-coding record shape:

```json
{
  "patient_id": "SYNTH-P015", "episode_id": "SYNTH-E015", "scope": "routine_uncomplicated", "side": "right",
  "principal_diagnosis": {"code": "H26.9", "description": "Cataract, unspecified", "role": "principal_diagnosis"},
  "procedures": [{"code": "C71.2", "role": "primary_procedure"}, {"code": "C75.1", "role": "secondary_procedure"},
                 {"code": "Z94.1", "role": "site_laterality"}],
  "additional_diagnoses": [{"code": "E11.9", "comorbidity_key": "t2dm", "role": "additional_diagnosis",
                            "tariff_relevance": "stated_by_user_affects_tariff_verify_against_hrg_grouper"}],
  "diabetes_documented": true, "must_not_code": [],
  "review_expectation": "proposal_ok_pending_coder_review"
}
```

Fixtures in `fixtures/` (`demo_episode.json`, `left_routine_episode.json`, `complicated_episode.json`, `cancelled_episode.json`) are four original synthetic episodes covering routine right and left surgery, posterior capsule rupture with anterior vitrectomy, and a cancelled case. `V3 synthetic-ophthalmology-worklist-50.csv` is the supplied 50-row worklist.

## 9. Expected results

| Situation | Expected outcome |
| --- | --- |
| Routine episode, demo pack, demo provider | `needs_review`; `DEMO-CAT`, `DEMO-PHACO`, `DEMO-IOL` proposed; reason "shadow mode: proposal requires review" |
| Complicated episode (posterior capsule rupture, vitrectomy, endophthalmitis) | `out_of_scope` with the review reasons |
| Cancelled surgery, or planned only | No performed procedure; not routine; goes to review |
| Missing operative note (for example worklist summaries) | Zero procedures coded; `operative_note_missing`; `needs_review` |
| No reference pack, or pack does not apply | `blocked_missing_reference` style outcome with an explanatory reason; no codes |
| Negated, family, uncertain or medication-only comorbidity | Not included in coding; `excluded` or `unresolved` in `candidate_decisions` |
| Comorbidity codes with no verified reportability rule | Rejected with `comorbidity_reportability_unverified`; the episode records `comorbidity_reportability_unresolved` |
| Repeated `episode_id` with changed documents | Refused (`EpisodeConflict`, HTTP 409) |
| Any run | Two outputs plus `commit.json` and `audit.jsonl`; results always remain proposals |

Run on the 100-case dataset with the demo pack, all 100 episodes finish as `needs_review`. Each gets `DEMO-CAT`, `DEMO-PHACO` and `DEMO-IOL`; no additional diagnoses are proposed, because the demo pack contains no comorbidity entries; and 55 episodes record `comorbidity_reportability_unresolved`. The extractor records a diabetes fact for both the 17 confirmed cases and the 16 trap cases, so distinguishing them is a validation and reference-pack task, not something the extraction alone resolves.

## 10. Evaluation and audit tooling

| Script | Purpose |
| --- | --- |
| `scripts/evaluate.py` | Compares adjudicated gold JSONL against predictions keyed by patient and episode: principal and ordered-episode accuracy, precision and recall per field, Wilson intervals, patient-overlap checks, trust and year stratification |
| `scripts/drift.py` | Descriptive drift report |
| `scripts/sample_audit.py` | Deterministic sample of accepted cases for audit |
| `scripts/export_schemas.py` | Regenerates the JSON Schemas |

There is no adjudicated gold set yet, so `evaluate.py` has nothing clinical to score.

## 11. Setup and testing

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[test]'               # add '.[medcat,medgemma]' for the optional components
.venv/bin/python scripts/export_schemas.py
.venv/bin/codegem fixtures/demo_episode.json --reference-pack fixtures/synthetic_references.json --demo --output /tmp/codegem-demo
.venv/bin/pytest -q                                # 45 tests
.venv/bin/codegem examples/cataract_cases_100/bundles --reference-pack fixtures/synthetic_references.json --demo --output /tmp/cataract100-run
```

Regenerate datasets:

```bash
python3 scripts/generate_synthetic_ophthalmology.py    # 500 narratives + template-derived entities
python3 scripts/build_annotation_json.py               # hand annotations to JSON
python3 scripts/build_coding_dataset.py                # coding outcomes for the annotated documents
python3 scripts/generate_cataract_cases.py             # 100 routine cataract episodes
```

Python 3.11 or later; pinned dependencies are in `pyproject.toml` (pydantic, FastAPI, uvicorn, python-docx, pypdf; optional medcat 2.4.0, transformers, torch, accelerate).

## 12. Current boundaries

- No licensed NHS ICD-10, OPCS-4 or coding-standards content is bundled. A production run needs a verified reference pack from an authorised source.
- The MedGemma adapter has not been run against real weights, and no genuine MedCAT model pack or MetaCAT model is present.
- The validator does not implement the full NHS national coding standards, sequencing or supplementary-code rules.
- Which comorbidities affect the trust's payment (HRG) is not modelled. Only diabetes is flagged, from the requirement stated for this project.
- Automatic acceptance is disabled; there is no clinically adjudicated evaluation.
- The API uses one local bearer token and stores original text in local JSON. NHS deployment would need information governance review, a DPIA, DSPT assessment and clinical safety management (DCB0129/DCB0160).