# Epic: PolyFiles CE + App Graph Integration

| Field | Value |
|-------|-------|
| **Status** | Planned |
| **Priority** | P0 |
| **Milestone** | PolyFiles v0.1.0 |
| **Spec** | `specs/POLYFILES_CE_APP_GRAPH_SPEC.md` |
| **Lex Namespace** | `polyqlabs/qfiles` |

---

## Summary

Implement the PolyFiles App Graph (15 modules) and CE meaning layer (3 domains, noise filter, 2 SME panels) as the structural and intelligence foundation for scatter-distributed encrypted storage.

---

## Task Checklist

### App Graph

- [ ] Implement `qfiles_app_graph.fl` — 15 ModuleNode definitions (12 core + 3 graphs)
- [ ] Register intra-graph REQUIRES edges (15 dependency edges)
- [ ] Implement `qfiles_register_bridge_edges` — 4 cross-graph bridges (PolyDocs, QKit, eStream scatter-CAS x2)
- [ ] Golden tests: module count, edge count, bridge count assertions
- [ ] Verify bridge bilateral confirmation with PolyDocs and QKit graphs

### CE Meaning Layer

- [ ] Implement `qfiles_meaning.fl` — 3 meaning domains
- [ ] Configure noise filter: 4 suppression rules + 4 signal rules
- [ ] Implement 2 SME panels: storage tiering optimization, classification model calibration
- [ ] Implement `qfiles_register_ce` orchestrator
- [ ] Golden tests: domain validation, noise filter counts, panel configuration

### Integration

- [ ] Register PolyFiles in QKit product registry
- [ ] Validate strategic grant config (eStream + Paragon)
- [ ] End-to-end test: graph registration -> CE registration -> bridge confirmation
- [ ] Update Platform Graph inventory with PolyFiles module count

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `module_stratum.fl` | Available | eStream core deployment primitives |
| `ce_meaning.fl` | Available | CE meaning domain registration |
| QKit collaboration | In Progress | Bridge target for share module |
| PolyDocs editor | In Progress | Bridge target for document_edit module |
| eStream scatter-CAS | Available | Platform substrate for chunk + storage_router |

---

## Acceptance Criteria

1. `qfiles_app_graph_register` produces a CsrStorage with exactly 15 nodes and 15 edges
2. `qfiles_register_bridge_edges` adds exactly 4 bridge edges
3. `qfiles_register_ce` returns `true` with all 3 domains, noise filter, and 2 panels registered
4. All golden tests pass
5. No lex namespace leakage across product boundaries
