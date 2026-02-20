# Poly Data Architecture

**Version**: 3.0
**Date**: February 2026
**Platform**: eStream v0.8.3
**Upstream**: PolyKit v0.3.0, eStream scatter-cas, es-git, graph/DAG constructs
**Build Pipeline**: FastLang (.fl) → ESCIR → Rust/WASM codegen → .escd

---

## Overview

Poly Data is a post-quantum encrypted, scatter-distributed file storage and version control system. Every file is encrypted client-side with ML-KEM-1024, erasure-coded, and distributed across multiple independent storage providers and jurisdictions. Classification tags drive scatter policy, offline access, and retention.

### What Changed in v3.0

| Area | v2.0 | v3.0 |
|------|------|------|
| CAS | Custom implementation planned | eStream `scatter-cas` runtime |
| Version control | Custom `poly-data-version` circuit | `dag version_history` (mirrors `commit_history` from GRAPH_SPEC) |
| File metadata | Flat streams | `graph file_registry` with typed overlays |
| Sharing | Flat ACL stream | `graph share_network` with typed edges |
| poly-git | Custom git remote helper | Thin wrapper over `es-git` |
| Circuit format | ESCIR YAML (`circuit.escir.yaml`) | FastLang `.fl` with PolyKit profiles |
| RBAC | Per-circuit annotations | eStream `rbac.fl` composed via PolyKit |
| Platform | eStream v0.8.1 | eStream v0.8.3 |

---

## Zero-Linkage Privacy

Poly Data operates under the Poly Labs zero-linkage privacy architecture:

- **HKDF context**: `poly-data-v1` — produces `user_id`, signing key, and encryption key that cannot be correlated with any other Poly product
- **Lex namespace**: `esn/global/org/polylabs/data` — completely isolated from other product namespaces
- **StreamSight**: Telemetry stays within `polylabs.data.*` lex paths
- **Metering**: Own `metering_graph` instance under `polylabs.data.metering` lex
- **Billing**: Tier checked via blinded token status, not cross-product identity

---

## Identity & Authentication

### SPARK Derivation Context

```
SPARK biometric → Secure Enclave/TEE → master_seed (in WASM, never exposed to JS)
                                            │
                                            ▼
                                   HKDF-SHA3-256(master_seed, "poly-data-v1")
                                            │
                                            ├── ML-DSA-87 signing key pair
                                            │   (file manifests, commits, ACL changes)
                                            │
                                            └── ML-KEM-1024 encryption key pair
                                                (file key wrapping, share key exchange)
```

### User Identity

```
user_id = SHA3-256(spark_ml_dsa_87_public_key)[0..16]   # 16-byte truncated hash
```

All stream topics, file ownership, and ACLs reference this SPARK-derived `user_id`. There are no usernames, emails, or phone numbers. This `user_id` is unique to Poly Data and cannot be linked to identities in other Poly products.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Poly Data Client                              │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ File Manager │  │ Share       │  │ Search   │  │ poly-git CLI │  │
│  │ (UI)        │  │ Manager(UI) │  │ (UI)     │  │ (wraps es-git)│ │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  └──────┬───────┘  │
│         │                │              │               │           │
│  ┌──────┴────────────────┴──────────────┴───────────────┴────────┐  │
│  │              FastLang Circuits (WASM via .escd)                  │  │
│  │                                                                 │  │
│  │  polydata_encrypt.fl │ polydata_chunk.fl │ polydata_classify.fl │  │
│  │  polydata_manifest.fl │ polydata_eslm_classify.fl               │  │
│  │  (all ML-DSA-87 signed .escd packages, StreamSight-annotated)  │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                              │                                        │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │  Graph/DAG Layer (WASM, backed by scatter-cas)                    │  │
│  │                                                                   │  │
│  │  graph file_registry    — file system as a graph                  │  │
│  │  dag version_history    — commit-like version DAG                 │  │
│  │  graph share_network    — ACL + ephemeral link sharing            │  │
│  │  graph metering_graph   — per-app 8D usage (from PolyKit)        │  │
│  │  graph user_graph       — per-product identity (from PolyKit)     │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                              │                                        │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │  ESLite (Client-Side State)                                       │  │
│  │  /polydata/files/* — file metadata + manifest cache              │  │
│  │  /polydata/index/* — encrypted search index                      │  │
│  │  /polydata/offline/* — offline manifest + encrypted cache        │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                              │                                        │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │  eStream SDK (@estream/sdk-browser or react-native)              │  │
│  │  Wire protocol only: UDP :5000 / WebTransport :4433             │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
                        eStream Wire Protocol (QUIC/UDP)
                               │
┌──────────────────────────────┼────────────────────────────────────────┐
│                         eStream Network                                │
│                               │                                        │
│  ┌────────────────────────────┴─────────────────────────────────────┐ │
│  │  Lattice-Hosted Circuits                                           │ │
│  │                                                                    │ │
│  │  polydata_storage_router.fl │ polydata_share.fl                   │ │
│  │  polydata_metering.fl       │ scatter-cas runtime                 │ │
│  └────┬───────────┬──────────────┬──────────────────────────────────┘ │
│       │           │              │                                     │
│  ┌────┴──────────────────────────────────────────────────────────┐   │
│  │              Scatter Storage Layer (via scatter-cas)              │   │
│  │  AWS │ GCP │ Azure │ Cloudflare │ Hetzner │ Self-host           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Graph/DAG Constructs

### File Registry Graph (`polydata_file_graph.fl`)

The file system is modeled as a typed graph. Files, folders, and users are nodes; containment, ownership, and sharing are edges. Overlays provide real-time state (classification, scatter health, version count) without mutating the base graph.

```fastlang
type FileNode = struct {
    file_id: bytes(16),
    name: string,
    size_bytes: u64,
    content_hash: bytes(32),
    classification: u8,
    created_at: u64,
    updated_at: u64,
}

type FolderNode = struct {
    folder_id: bytes(16),
    name: string,
    classification: u8,
    created_at: u64,
}

type ContainsEdge = struct {
    added_at: u64,
}

type OwnedByEdge = struct {
    owner_since: u64,
}

graph file_registry {
    node FileNode
    node FolderNode
    edge ContainsEdge
    edge OwnedByEdge

    overlay classification: u8 curate delta_curate
    overlay scatter_health: u8 curate delta_curate
    overlay offline_cached: bool curate
    overlay version_count: u32 bitmask delta_curate
    overlay size_bytes: u64 bitmask delta_curate
    overlay shard_count: u16 bitmask

    storage csr {
        hot @bram,
        warm @ddr,
        cold @nvme,
    }

    ai_feed classification_suggestion

    observe file_registry: [classification, scatter_health, size_bytes] threshold: {
        anomaly_score 0.85
        baseline_window 120
    }
}

series file_series: file_registry
    merkle_chain true
    lattice_imprint true
    witness_attest true
```

Key circuits: `create_file`, `create_folder`, `move_file`, `delete_file`, `reclassify`, `list_folder`.

### Version History DAG (`polydata_version_dag.fl`)

File versioning is modeled as a DAG, mirroring the `commit_history` pattern from the GRAPH_SPEC. Each version is a node; parent relationships are edges. This is backed by `scatter-cas` for content-addressable storage.

```fastlang
type VersionNode = struct {
    version_id: bytes(32),
    file_id: bytes(16),
    manifest_hash: bytes(32),
    signer_pubkey: bytes(2592),
    message: string,
    created_at: u64,
}

type ParentEdge = struct {
    parent_version: bytes(32),
}

dag version_history {
    node VersionNode
    edge ParentEdge

    enforce acyclic
    sign ml_dsa_87

    storage merkle_csr {
        hash ml_dsa_87
        tier bram  { capacity: 10_000 }
        tier nvme  { overflow: true }
    }

    overlay shard_health: u8 curate delta_curate
    overlay download_count: u64 bitmask delta_curate

    traverse ancestors(version: VersionNode) -> [VersionNode]
    traverse common_ancestor(a: VersionNode, b: VersionNode) -> VersionNode
    prove inclusion(version: VersionNode, root: VersionNode) -> MerkleProof

    match {
        (base: VersionNode) <-[parent]- (a: VersionNode),
        (base: VersionNode) <-[parent]- (b: VersionNode)
        where a != b
    } -> MergeCandidate
}

series version_series: version_history
    merkle_chain true
    lattice_imprint true
    witness_attest true
```

Key circuits: `create_version`, `list_versions`, `diff_versions`, `merge_versions`, `rollback`.

### Share Network Graph (`polydata_share_graph.fl`)

Sharing relationships are a graph. Users, files, and ephemeral links are nodes; share permissions are edges with typed access levels.

```fastlang
type ShareUserNode = struct {
    user_id: bytes(16),
    signing_pubkey: bytes(2592),
}

type SharedFileNode = struct {
    file_id: bytes(16),
    wrapped_key: bytes(1568),
}

type EphemeralLinkNode = struct {
    link_id: bytes(8),
    onetime_pubkey: bytes(1568),
    created_at: u64,
    expires_at: u64,
    max_uses: u32,
}

type SharedWithEdge = struct {
    permission: u8,
    granted_at: u64,
    granted_by: bytes(16),
    expires_at: u64,
}

type EphemeralAccessEdge = struct {
    classification: u8,
    permission: u8,
}

state_machine share_lifecycle {
    initial PENDING
    persistence wal
    terminal [REVOKED, EXPIRED]
    li_anomaly_detection true

    PENDING -> ACTIVE when signature_verified guard acl_signed
    ACTIVE -> REVOKED when owner_revoked
    ACTIVE -> EXPIRED when ttl_expired
}

graph share_network {
    node ShareUserNode
    node SharedFileNode
    node EphemeralLinkNode
    edge SharedWithEdge
    edge EphemeralAccessEdge

    overlay permission_level: u8 curate delta_curate
    overlay access_count: u32 bitmask delta_curate
    overlay expires_at: u64 curate

    storage csr {
        hot @bram,
        warm @ddr,
        cold @nvme,
    }

    observe share_network: [permission_level, access_count] threshold: {
        anomaly_score 0.9
        baseline_window 300
    }
}

series share_series: share_network
    merkle_chain true
    lattice_imprint true
    witness_attest true
```

Key circuits: `grant_access`, `revoke_access`, `create_ephemeral_link`, `consume_link`, `list_shared_with`.

---

## scatter-cas Integration

Poly Data builds on eStream's `scatter-cas` runtime (`estream/runtime/scatter-cas/`) for all content-addressable storage. This replaces the custom CAS that was originally planned.

### Object Model

| scatter-cas Object | Poly Data Usage |
|---------------------|-----------------|
| `Blob` | Encrypted file chunks (AES-256-GCM) |
| `Tree` | Folder structure (file name → blob hash mappings) |
| `Commit` | Version snapshots (links to tree, parent commits, ML-DSA-87 signature) |
| `Tag` | Named releases / classification markers |
| `ObjectId` | SHA3-256 content address (quantum-safe, replaces SHA-1) |

### Storage Layers

```
scatter-cas ObjectStore
  ├── PackStore      (local ESLite, offline cache)
  └── ScatterStore   (distributed k-of-n erasure coded)
        ├── k-of-n scatter per classification:
        │   PUBLIC:       2-of-3, any jurisdiction
        │   INTERNAL:     3-of-5, 2+ jurisdictions
        │   CONFIDENTIAL: 5-of-7, 3+ jurisdictions
        │   RESTRICTED:   7-of-9, 3+ jurisdictions, no offline
        │   SOVEREIGN:    9-of-13, 5+ jurisdictions, HSM-backed
        └── Providers: AWS, GCP, Azure, Cloudflare, Hetzner, self-host

scatter-cas RefStore
  ├── HEAD         → refs/heads/main
  ├── refs/heads/* → branch tips (version DAG nodes)
  └── refs/tags/*  → named version markers
```

### poly-git (wraps es-git)

`poly-git` is now a thin wrapper over eStream's `es-git` CLI (`estream/tools/es-git/`). It adds classification-driven scatter policy as an overlay on the commit DAG.

```bash
git remote add poly poly-git://org.polydata/my-repo
git push poly main      # → es-git push with classification overlay
git clone poly-git://org.polydata/my-repo
git pull poly main
```

es-git provides: `init`, `add`, `commit`, `log`, `status`, `branch`, `checkout`, `diff`, plus the SHA-1→SHA3-256 migration engine. poly-git adds: classification-per-path (`.polyclassification`), scatter policy enforcement, PQ-signed commits (SPARK ML-DSA-87).

---

## FastLang Circuits

All circuits are written in FastLang `.fl` using PolyKit profiles. The build pipeline is:

```bash
estream-dev build-wasm-client --from-fl circuits/fl/ --sign key.pem --enforce-budget
```

### Client-Side Circuits (compiled to `.escd` WASM)

| Circuit | File | Purpose | Size Budget |
|---------|------|---------|-------------|
| `polydata_encrypt` | `polydata_encrypt.fl` | ML-KEM-1024 key gen, AES-256-GCM chunk encryption | ≤128 KB |
| `polydata_chunk` | `polydata_chunk.fl` | 4 MB chunking, erasure coding, reassembly | ≤128 KB |
| `polydata_classify` | `polydata_classify.fl` | Classification assignment, policy lookup | ≤128 KB |
| `polydata_manifest` | `polydata_manifest.fl` | Manifest build, ML-DSA-87 signing, verification | ≤128 KB |
| `polydata_eslm_classify` | `polydata_eslm_classify.fl` | ESLM content auto-classification | ≤128 KB |

All circuits compose PolyKit:
```fastlang
circuit polydata_encrypt(user_id: bytes(16), file_key: bytes(32), chunk: bytes) -> bytes
    profile poly_framework_sensitive
    composes: [polykit_identity, polykit_metering, polykit_sanitize]
    lex esn/global/org/polylabs/data/encrypt
    constant_time true
    observe metrics: [encrypt_ops, chunk_size, latency_ns]
{
    aes_gcm_encrypt(file_key, chunk)
}
```

### Server-Side Circuits (lattice-hosted)

| Circuit | File | Purpose |
|---------|------|---------|
| `polydata_storage_router` | `polydata_storage_router.fl` | Scatter policy enforcement, VRF shard distribution |
| `polydata_share` | `polydata_share.fl` | ACL enforcement, ephemeral link validation |
| `polydata_metering` | `polydata_metering.fl` | Per-product 8D metering (isolated) |

---

## File Upload Flow

1. User selects file(s) in Poly Data client
2. **`polydata_classify` circuit** (WASM):
   - Checks `.polyclassification`, folder inheritance, enterprise policy
   - Falls through to `polydata_eslm_classify` for AI suggestion if no explicit tag
3. **`polydata_encrypt` circuit** (WASM):
   - Generates random AES-256-GCM per-file key
   - Wraps per-file key with user's SPARK ML-KEM-1024 public key
4. **`polydata_chunk` circuit** (WASM):
   - Chunks large files (4 MB chunks)
   - Encrypts each chunk with per-file AES-256-GCM key
   - Erasure-codes chunks (k-of-n based on classification)
5. **`polydata_manifest` circuit** (WASM):
   - Constructs scatter-cas `Commit` object: chunk hashes, shard map, classification
   - Signs with user's SPARK ML-DSA-87 signing key
6. Client emits to `polylabs.data.{user_id}.upload` via eStream wire protocol
7. **`polydata_storage_router` circuit** (lattice):
   - Validates ML-DSA-87 signature
   - Enforces scatter policy per classification
   - Distributes shards via VRF across providers
   - Records version in `version_history` DAG
   - Updates `file_registry` graph overlays
8. Confirmation published to `polylabs.data.{user_id}.upload.confirm`
9. Client ESLite updates local cache

---

## Classification System

```
PUBLIC      → 2-of-3 scatter, full offline, any jurisdiction
INTERNAL    → 3-of-5 scatter, offline, 2+ jurisdictions
CONFIDENTIAL → 5-of-7 scatter, selective offline, 3+ jurisdictions
RESTRICTED  → 7-of-9 scatter, NO offline, 3+ jurisdictions, auto-expire viewer
SOVEREIGN   → 9-of-13 scatter, NO offline, 5+ jurisdictions, HSM-backed
```

Classification is an overlay on the `file_registry` graph. Changes are tracked in `file_series` with `observe` anomaly detection flagging unusual reclassification patterns.

---

## Sharing

### ACL-Based Sharing

Folder/file ACLs are edges in the `share_network` graph. ACL changes are ML-DSA-87 signed and follow the `share_lifecycle` state machine.

```
Owner signs ACL change with SPARK ML-DSA-87
  → share_lifecycle: PENDING → ACTIVE (guard: acl_signed)
  → SharedWithEdge created in share_network graph
  → Per-file key re-wrapped with recipient's SPARK ML-KEM-1024 public key
  → Recipient subscribes to polylabs.data.{recipient_id}.share.incoming
```

### Ephemeral Link Sharing

Ephemeral links are `EphemeralLinkNode` in the `share_network` graph with time-bounded and use-bounded access.

- Default TTL: 5 minutes (configurable, max 1 hour for RESTRICTED+)
- One-time or multi-use (configurable)
- Zero-knowledge: edge nodes see only encrypted payload
- URL format: `https://link.estream.dev/e/{lookup_key}` (base58, 8 bytes)

---

## StreamSight Observability

Per-product isolated telemetry within the `polylabs.data.*` lex namespace.

### Telemetry Stream Paths

```
lex://estream/apps/polylabs.data/telemetry
lex://estream/apps/polylabs.data/telemetry/sli
lex://estream/apps/polylabs.data/metrics/baseline
lex://estream/apps/polylabs.data/metrics/deviations
lex://estream/apps/polylabs.data/incidents
lex://estream/apps/polylabs.data/eslm/classification
lex://estream/apps/polylabs.data/eslm/recommendation
```

No telemetry path references any other Poly product. StreamSight baseline gate learns per-classification latency distributions and flags deviations.

---

## Console Widgets

| Widget ID | Category | Description |
|-----------|----------|-------------|
| `polydata-upload-latency` | observability | Upload latency gauge (encrypt + chunk + scatter) |
| `polydata-scatter-health` | observability | Per-provider shard retrieval latency |
| `polydata-classification-dist` | observability | Classification tag distribution |
| `polydata-deviation-feed` | observability | StreamSight baseline deviation feed |
| `polydata-shard-failures` | observability | Shard retrieval failure rate |
| `polydata-capacity-forecast` | observability | Storage capacity forecast per tier |
| `polydata-eslm-accuracy` | governance | Auto-classification accuracy |
| `polydata-eslm-review` | governance | Human-in-the-loop review queue |
| `polydata-eslm-feedback` | governance | Training feedback trends |
| `polydata-esn-ai-recs` | governance | ESCIR optimization recommendations |
| `polydata-sanitization-log` | governance | PII/PCI/HIPAA/GDPR sanitization audit |

---

## Offline Access

| Classification | Offline Policy |
|---------------|---------------|
| PUBLIC | Full offline copy, auto-sync |
| INTERNAL | Full offline copy, auto-sync |
| CONFIDENTIAL | Selective (user chooses per file/folder) |
| RESTRICTED | NO offline — streaming view only |
| SOVEREIGN | NO offline — HSM-gated streaming view |

Offline copies stored in ESLite (`/polydata/offline/*`), encrypted with device-bound SPARK key.

---

## Directory Structure

```
polydata/
├── circuits/fl/
│   ├── polydata_encrypt.fl
│   ├── polydata_chunk.fl
│   ├── polydata_classify.fl
│   ├── polydata_manifest.fl
│   ├── polydata_eslm_classify.fl
│   ├── polydata_storage_router.fl
│   ├── polydata_share.fl
│   ├── polydata_metering.fl
│   └── graphs/
│       ├── polydata_file_graph.fl
│       ├── polydata_version_dag.fl
│       └── polydata_share_graph.fl
├── apps/console/
│   └── src/widgets/
├── packages/sdk/
├── docs/
│   └── ARCHITECTURE.md
└── package.json
```

---

## Roadmap

### Phase 1: Core Storage (Q2 2026)
- FastLang circuits (replacing ESCIR YAML)
- `file_registry` graph + `version_history` DAG
- scatter-cas integration for content-addressable storage
- SPARK biometric auth (`poly-data-v1`)
- Classification system with graph overlays
- StreamSight L0 metrics

### Phase 2: Collaboration (Q3 2026)
- `share_network` graph with `share_lifecycle` state machine
- Ephemeral link sharing
- Selective offline sync
- ESLM auto-classification
- Console widgets (11 widgets)

### Phase 3: poly-git (Q4 2026)
- es-git wrapper with classification overlay
- PQ-signed commits (SPARK ML-DSA-87)
- `.polyclassification` per-path
- LFS scatter integration

### Phase 4: Enterprise (Q1 2027)
- Enterprise admin via lex bridge (opt-in)
- Compliance/retention policies
- SOVEREIGN classification (HSM via Poly Vault)
- Migration tools (Google Drive, Dropbox, OneDrive)
- ESN-AI optimization recommendations
