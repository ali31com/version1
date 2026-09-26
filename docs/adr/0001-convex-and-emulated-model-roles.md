# Convex and Gemini Flash for the live demo

## Status

Accepted: explicitly requested by the owner on 26 September 2026.

## Context

The audience submits Episodes while a presenter demonstrates clinical coding. Both views need to reflect ongoing changes. The draft PRD recommends Python, PostgreSQL, separate workers and SSE, but identifies its architecture as a recommendation rather than a mandate.

## Decision

Use Convex as the demo backend and source of live state. Use Gemini Flash to perform both the MedCAT annotation role and the MedGemma interpretation/coding role, preserving distinct stage contracts. The exact model ID and orchestration mechanism require implementation research and remain undecided.

## Consequences

The implementation plan must translate the PRD's data and workflow concepts to Convex rather than introduce its suggested parallel backend. Stage results must be stored as live state that the audience and presenter interfaces can observe.

The demo does not exercise real MedCAT or MedGemma. Replacing an adapter may preserve the application contract, but integration with a real model runtime will still require work and verification. UI labels must distinguish the emulated role from the actual model provider.

