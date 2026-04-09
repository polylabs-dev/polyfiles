# PolyFiles CE + App Graph Specification

| Field | Value |
|-------|-------|
| **Version** | v0.1.0 |
| **Status** | Draft |
| **Lex Namespace** | `polyqlabs/qfiles` |
| **App Graph** | `circuits/fl/qfiles_app_graph.fl` |
| **CE Meaning** | `circuits/fl/qfiles_meaning.fl` |
| **Upstream Dependency** | QKit v0.1.0+, eStream v0.22.0+ |

---

## 1. App Graph

### 1.1 Module Inventory (15 modules)

| # | Module | Partition | SLA | Description |
|---|--------|-----------|-----|-------------|
| 1 | `qfiles_chunk` | Backend | Premium | Erasure-coded chunking over scatter-CAS |
| 2 | `qfiles_classify` | Backend | Standard | Rule-based file type classification |
| 3 | `qfiles_dedup` | Backend | Standard | Content-defined chunking + dedup |
| 4 | `qfiles_document_edit` | Head | Premium | CRDT document editing via PolyDocs bridge |
| 5 | `qfiles_encrypt` | Backend | Premium | ML-KEM-1024 envelope encryption |
| 6 | `qfiles_eslm_classify` | Backend | Standard | ESLM-powered semantic classification |
| 7 | `qfiles_manifest` | Backend | Premium | File manifest + metadata index |
| 8 | `qfiles_metering` | Backend | Standard | Per-user storage metering + quota |
| 9 | `qfiles_platform_health` | Backend | Standard | Health probes, latency histograms |
| 10 | `qfiles_rbac` | Shared | Premium | Field-level access control + sharing policies |
| 11 | `qfiles_share` | Backend | Premium | PQ-encrypted share links + ACL propagation |
| 12 | `qfiles_storage_router` | Backend | Premium | Hot/warm/cold tiering + scatter routing |
| 13 | `file_graph` | Backend | Premium | Stratum property graph: files, folders, tags |
| 14 | `share_graph` | Backend | Standard | Share relationship graph (users, groups, links) |
| 15 | `version_dag` | Backend | Standard | Version history DAG per file |

### 1.2 Intra-Graph Dependencies

```
qfiles_chunk          -> qfiles_encrypt
qfiles_dedup          -> qfiles_chunk
qfiles_classify       -> qfiles_manifest
qfiles_eslm_classify  -> qfiles_classify
qfiles_document_edit  -> qfiles_manifest, qfiles_encrypt
qfiles_manifest       -> file_graph
qfiles_metering       -> qfiles_manifest
qfiles_platform_health-> qfiles_metering
qfiles_rbac           -> file_graph
qfiles_share          -> qfiles_rbac, share_graph
qfiles_storage_router -> qfiles_chunk, qfiles_dedup
version_dag              -> qfiles_manifest
```

---

## 2. CE Meaning Domains

### 2.1 `storage/access_patterns`

Tracks hot/warm/cold tiering decisions and access frequency distributions. CE learns per-user temporal patterns to predict tier migrations before manual intervention.

**Signals**: tier migration events, access frequency shifts, cost-per-GB trends, latency percentile changes.

### 2.2 `storage/dedup_efficiency`

Monitors deduplication ratio trends across the scatter-CAS namespace. CE detects declining dedup ratios (indicating content drift) and recommends re-chunking strategies.

**Signals**: dedup ratio per-namespace, chunk size distribution changes, storage savings rate.

### 2.3 `storage/classification`

Tracks ESLM classification accuracy against ground truth labels. CE calibrates confidence thresholds and detects classification model drift.

**Signals**: classification accuracy delta, confidence distribution skew, novel file type encounters, misclassification clusters.

---

## 3. Noise Filter

### Suppressed Events

| Pattern | Reason |
|---------|--------|
| Thumbnail generation | High-frequency, no storage semantic value |
| Cache invalidation churn | TTL-driven, not user-initiated |
| Heartbeat probes | Periodic health checks carry no meaning |
| Pre-fetch warming | Background optimization, not behavioral signal |

### Signal Events

| Pattern | CE Action |
|---------|-----------|
| Storage anomaly (sudden capacity spike) | Alert + root cause panel |
| Classification mismatch (ESLM vs rule-based disagree) | Calibration SME panel |
| Dedup ratio degradation (>5% decline over 7d window) | Re-chunking recommendation |
| Access pattern shift (hot->cold for active user) | Tiering review panel |

---

## 4. SME Panels

### 4.1 Storage Tiering Optimization

**Trigger**: Access pattern shift detected or cost-per-GB exceeds threshold.
**Panel Composition**: FOR (migrate to colder tier — cost savings) vs AGAINST (latency risk, user disruption).
**Output**: Tiering recommendation with confidence score and projected cost delta.

### 4.2 Classification Model Calibration

**Trigger**: ESLM accuracy drops below 95% threshold or novel file type cluster detected.
**Panel Composition**: FOR (retrain with new corpus) vs AGAINST (current model sufficient, outlier noise).
**Output**: Retrain decision with minimum sample size requirement and confidence interval.

---

## 5. Bridge Edges

| Source Module | Target | Edge Type | Shared Fields |
|---------------|--------|-----------|---------------|
| `qfiles_document_edit` | PolyDocs `qdocs_editor` | `EDGE_BRIDGE_TO` | `document_ops`, `crdt_state`, `version_id` |
| `qfiles_share` | QKit `qkit_collaboration` | `EDGE_BRIDGE_TO` | `share_token`, `acl_policy`, `invite_state` |
| `qfiles_chunk` | eStream `scatter_cas_core` | `EDGE_BRIDGE_TO` | `chunk_id`, `erasure_params`, `shard_map` |
| `qfiles_storage_router` | eStream `scatter_cas_core` | `EDGE_BRIDGE_TO` | `tier_policy`, `routing_table`, `replica_set` |

---

## 6. Strategic Grant Config

| Grant Source | Purpose | Scope |
|-------------|---------|-------|
| eStream | scatter-CAS primitives, FLIR codegen, ML-KEM-1024 | Platform substrate |
| Paragon | Entity-level storage policies, compliance retention rules | Enterprise FO integration |

---

## 7. Inventory Summary

| Category | Count |
|----------|-------|
| App Graph modules | 15 |
| CE meaning domains | 3 |
| Noise filter suppression rules | 4 |
| Noise filter signal rules | 4 |
| SME panels | 2 |
| Bridge edges | 4 |
| Strategic grants | 2 |
