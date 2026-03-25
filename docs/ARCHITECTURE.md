# Poly Data Architecture

**Version**: 3.0
**Date**: February 2026
**Platform**: eStream v0.8.3
**Upstream**: PolyKit v0.3.0, eStream scatter-cas, es-git, graph/DAG constructs
**Build Pipeline**: FastLang (.fl) → FLIR → Rust/WASM codegen → .escd

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
| Circuit format | FLIR YAML (`circuit.flir.yaml`) | FastLang `.fl` with PolyKit profiles |
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
│  │  polyfiles_encrypt.fl │ polyfiles_chunk.fl │ polyfiles_classify.fl │  │
│  │  polyfiles_manifest.fl │ polyfiles_eslm_classify.fl               │  │
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
│  │  /polyfiles/files/* — file metadata + manifest cache              │  │
│  │  /polyfiles/index/* — encrypted search index                      │  │
│  │  /polyfiles/offline/* — offline manifest + encrypted cache        │  │
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
│  │  polyfiles_storage_router.fl │ polyfiles_share.fl                   │ │
│  │  polyfiles_metering.fl       │ scatter-cas runtime                 │ │
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

### File Registry Graph (`polyfiles_file_graph.fl`)

The file system is modeled as a typed graph. Files, folders, and users are nodes; containment, ownership, and sharing are edges. Overlays provide real-time state (classification, scatter health, version count) without mutating the base graph.

```fastlang
data FileNode : app v1 {
    file_id: bytes(32),
    owner_id: bytes(16),
    name: string,
    mime_type: string,
    size_bytes: u64,
    content_hash: bytes(32),
    manifest_hash: bytes(32),
    classification: u8,
    shard_count: u16,
    version_count: u32,
    created_ms: u64,
    updated_ms: u64,
}
    store graph
    govern lex esn/global/org/polylabs/files
    cortex {
        obfuscate [owner_id]
        infer on_write
        on_anomaly alert "files-team"
    }

data FolderNode : app v1 {
    folder_id: bytes(32),
    owner_id: bytes(16),
    name: string,
    classification: u8,
    child_count: u32,
    total_size: u64,
    created_ms: u64,
    updated_ms: u64,
}
    store graph
    govern lex esn/global/org/polylabs/files
    cortex {
        obfuscate [owner_id]
        infer on_write
    }

graph file_registry {
    node FileNode { key file_id }
    node FolderNode { key folder_id }
    edge ContainsEdge { from FolderNode via parent_id, to FileNode|FolderNode via child_id }
    edge OwnedByEdge { from FileNode via node_id, to UserId via owner_id }

    overlay classification: u8 curate delta_curate
    overlay scatter_health: u8 curate delta_curate
    overlay offline_cached: bool curate delta_curate
    overlay version_count: u32 bitmask delta_curate
    overlay size_bytes: u64 bitmask delta_curate
    overlay shard_count: u16 bitmask delta_curate

    storage csr {
        hot @bram,
        warm @ddr,
        cold @nvme,
    }

    ai_feed file_anomaly_detection
    ai_feed classification_suggestion

    observe file_registry: [classification, scatter_health, size_bytes] threshold: {
        anomaly_score 0.85
        baseline_window 300
    }

    traverse children(folder: FolderNode) -> [FileNode | FolderNode]
    traverse ancestors(node: FileNode | FolderNode) -> [FolderNode]
    reduce total_size(folder: FolderNode) -> u64
    reduce deep_file_count(folder: FolderNode) -> u32
}

series file_series: file_registry
    merkle_chain true
    lattice_imprint true
    witness_attest true
```

Key circuits: `create_file`, `create_folder`, `move_file`, `delete_file`, `reclassify`, `list_folder`.

### Version History DAG (`polyfiles_version_dag.fl`)

File versioning is modeled as a DAG, mirroring the `commit_history` pattern from the GRAPH_SPEC. Each version is a node; parent relationships are edges. This is backed by `scatter-cas` for content-addressable storage.

```fastlang
data VersionNode : app v1 {
    version_id: bytes(32),
    file_id: bytes(32),
    author_id: bytes(16),
    manifest_hash: bytes(32),
    parent_ids: [bytes(32); 4],
    parent_count: u32,
    depth: u64,
    merkle_root: bytes(32),
    file_size: u64,
    message: string,
    signature: bytes(4627),
    author_pk: bytes(2592),
    created_ms: u64,
}
    store dag
    govern lex esn/global/org/polylabs/files
    cortex {
        obfuscate [author_id]
        infer on_write
        on_anomaly alert "files-team"
    }

dag version_history {
    node VersionNode { key version_id, signed_by author_pk using ML-DSA-87 }
    edge ParentEdge { from child_id, to parent_id }

    enforce acyclic
    sign ml_dsa_87

    storage merkle_csr {
        hot @bram,
        warm @ddr,
        cold @nvme,
    }

    attest povc {
        witness threshold(2, 3)
    }

    overlay shard_health: u8 curate delta_curate
    overlay download_count: u64 bitmask delta_curate
    overlay branch_depth: u64 bitmask delta_curate

    ai_feed version_anomaly_detection
    ai_feed merge_conflict_prediction

    observe version_history: [shard_health, download_count, branch_depth] threshold: {
        anomaly_score 0.85
        baseline_window 300
    }

    ancestors(version: VersionNode) -> [VersionNode]
    descendants(version: VersionNode) -> [VersionNode]
    common_ancestor(a: VersionNode, b: VersionNode) -> VersionNode

    match {
        (base: VersionNode) <-[ParentEdge]- (a: VersionNode),
        (base: VersionNode) <-[ParentEdge]- (b: VersionNode)
        where a != b
    } -> MergeCandidate
}

series version_series: version_history
    merkle_chain true
    lattice_imprint true
    witness_attest true
```

Key circuits: `create_version`, `list_versions`, `diff_versions`, `merge_versions`, `rollback`.

### Share Network Graph (`polyfiles_share_graph.fl`)

Sharing relationships are a graph. Users, files, and ephemeral links are nodes; share permissions are edges with typed access levels.

```fastlang
data ShareUserNode : app v1 {
    user_id: bytes(16),
    email: string,
    display_name_hash: bytes(32),
    public_key: bytes(2592),
    shares_owned: u64,
    shares_received: u64,
    joined_ms: u64,
}
    store graph
    govern lex esn/global/org/polylabs/files
    cortex {
        redact [email]
        obfuscate [user_id]
        infer on_write
        on_anomaly alert "files-team"
    }

data SharedFileNode : app v1 {
    file_id: bytes(32),
    owner_id: bytes(16),
    file_size: u64,
    content_hash: bytes(32),
    share_count: u32,
    ephemeral_count: u32,
    created_ms: u64,
}
    store graph
    govern lex esn/global/org/polylabs/files
    cortex {
        obfuscate [owner_id]
        infer on_write
    }

data EphemeralLinkNode : app v1 {
    link_id: bytes(32),
    file_id: bytes(32),
    creator_id: bytes(16),
    link_secret: bytes(32),
    max_downloads: u32,
    downloads_used: u32,
    created_ms: u64,
    expires_ms: u64,
    state: ShareState,
}
    store graph
    govern lex esn/global/org/polylabs/files
    cortex {
        redact [link_secret]
        infer on_write
        on_anomaly alert "files-security"
    }

state_machine share_lifecycle {
    initial Pending

    state Pending {
        on grant_accepted -> Active
        on grant_rejected -> Revoked
    }
    state Active {
        on owner_revoked -> Revoked
        on ttl_expired -> Expired
        on permission_upgraded -> Active
        on permission_downgraded -> Active
    }
    state Revoked { terminal true }
    state Expired { terminal true }

    anomaly "stale_pending" { duration_in(Pending) > 604_800_000 }
    anomaly "rapid_churn" { transitions_to(Revoked) > 10 in 3_600_000 }
    anomaly "ephemeral_overuse" { ephemeral_count > 100 per user per 86_400_000 }
    anomaly "permission_escalation" { transitions_to(Active) via permission_upgraded > 5 in 3_600_000 }
}

graph share_network {
    node ShareUserNode { key user_id }
    node SharedFileNode { key file_id }
    node EphemeralLinkNode { key link_id, ttl expires_ms }
    edge OwnsEdge { from ShareUserNode, to SharedFileNode }
    edge ShareEdge { from ShareUserNode via from_user, to ShareUserNode via to_user, through SharedFileNode }
    edge EphemeralEdge { from SharedFileNode, to EphemeralLinkNode }

    overlay permission_level: u8 curate delta_curate
    overlay access_count: u32 bitmask delta_curate
    overlay expires_at: u64 curate delta_curate
    overlay active_shares: u32 bitmask delta_curate
    overlay ephemeral_active: u32 bitmask delta_curate

    storage csr {
        hot @bram,
        warm @ddr,
        cold @nvme,
    }

    ai_feed share_anomaly_detection
    ai_feed permission_escalation_detection

    observe share_network: [permission_level, access_count, active_shares] threshold: {
        anomaly_score 0.9
        baseline_window 300
    }

    traverse shared_with(user: ShareUserNode) -> [SharedFileNode]
    traverse file_accessors(file: SharedFileNode) -> [ShareUserNode]
    traverse transitive_access(user: ShareUserNode) -> [SharedFileNode]
}

series share_series: share_network
    merkle_chain true
    lattice_imprint true
    witness_attest true
```

Key circuits: `grant_access`, `revoke_access`, `create_ephemeral_link`, `consume_link`, `list_shared_with`.

---

## Stratum & Cortex Integration

All graph and DAG data types in Poly Files use **Stratum storage bindings** (`store graph`, `store dag`) and **Cortex AI governance** (`cortex {}` blocks) to enforce field-level visibility, inference triggers, and anomaly feedback loops. This replaces the older `type X = struct` pattern with `data X : app v1` declarations that compose storage, lex governance, and AI policy at the type level.

### Stratum Storage Bindings

Each `data` declaration specifies which stratum backend stores its instances:

| Data Type | Stratum | Lex Namespace | Backing Structure |
|-----------|---------|---------------|-------------------|
| `FileNode` | `store graph` | `esn/global/org/polylabs/files` | `file_registry` graph, CSR storage (bram → ddr → nvme) |
| `FolderNode` | `store graph` | `esn/global/org/polylabs/files` | `file_registry` graph, CSR storage |
| `VersionNode` | `store dag` | `esn/global/org/polylabs/files` | `version_history` DAG, merkle_csr storage (bram → ddr → nvme) |
| `ShareUserNode` | `store graph` | `esn/global/org/polylabs/files` | `share_network` graph, CSR storage |
| `SharedFileNode` | `store graph` | `esn/global/org/polylabs/files` | `share_network` graph, CSR storage |
| `EphemeralLinkNode` | `store graph` | `esn/global/org/polylabs/files` | `share_network` graph, CSR storage (TTL-bounded) |

All graph storage uses three-tier CSR (Compressed Sparse Row):
- **`hot @bram`** — active working set in block RAM (FPGA) or L1/L2 cache
- **`warm @ddr`** — recently accessed data in DDR memory
- **`cold @nvme`** — archival data on NVMe storage

The version DAG uses `merkle_csr` which extends CSR with Merkle hash chains, `enforce acyclic` constraint, and ML-DSA-87 node signing (`sign ml_dsa_87`). It also includes `attest povc { witness threshold(2, 3) }` for proof-of-verifiable-compute attestation requiring 2-of-3 witness consensus.

### Cortex Visibility Policies

Cortex policies are declared per data type. Each field is either **exposed** (default), **obfuscated** (pseudonymized for AI processing), or **redacted** (completely hidden from Cortex inference):

| Data Type | Redacted Fields | Obfuscated Fields | Exposed Fields |
|-----------|-----------------|--------------------|-|
| `FileNode` | — | `owner_id` | `file_id`, `name`, `mime_type`, `size_bytes`, `content_hash`, `manifest_hash`, `classification`, `shard_count`, `version_count`, `created_ms`, `updated_ms` |
| `FolderNode` | — | `owner_id` | `folder_id`, `name`, `classification`, `child_count`, `total_size`, `created_ms`, `updated_ms` |
| `VersionNode` | — | `author_id` | `version_id`, `file_id`, `manifest_hash`, `parent_ids`, `parent_count`, `depth`, `merkle_root`, `file_size`, `message`, `signature`, `author_pk`, `created_ms` |
| `ShareUserNode` | `email` | `user_id` | `display_name_hash`, `public_key`, `shares_owned`, `shares_received`, `joined_ms` |
| `SharedFileNode` | — | `owner_id` | `file_id`, `file_size`, `content_hash`, `share_count`, `ephemeral_count`, `created_ms` |
| `EphemeralLinkNode` | `link_secret` | — | `link_id`, `file_id`, `creator_id`, `max_downloads`, `downloads_used`, `created_ms`, `expires_ms`, `state` |

**Obfuscation** replaces the field value with a deterministic pseudonym (HMAC-derived) so Cortex can detect patterns across records without learning the actual identity. **Redaction** replaces the field with a zero-value sentinel; Cortex never sees the original data.

### Cortex Inference Triggers & Feedback Handlers

Each `cortex {}` block specifies when inference runs and where anomaly alerts route:

| Data Type | Trigger | Feedback Handler | Alert Target |
|-----------|---------|------------------|--------------|
| `FileNode` | `infer on_write` | `on_anomaly alert "files-team"` | `files-team` |
| `FolderNode` | `infer on_write` | — | — |
| `VersionNode` | `infer on_write` | `on_anomaly alert "files-team"` | `files-team` |
| `ShareUserNode` | `infer on_write` | `on_anomaly alert "files-team"` | `files-team` |
| `SharedFileNode` | `infer on_write` | — | — |
| `EphemeralLinkNode` | `infer on_write` | `on_anomaly alert "files-security"` | `files-security` |

**Trigger modes**:
- `on_write` — inference runs synchronously on every insert/update. Used for all Poly Files data types to catch anomalies at write time (unusual file sizes, rapid reclassification, suspicious share patterns).
- `on_read` — inference runs on read (not currently used in Poly Files; suitable for lazy-evaluated classification suggestions).

**Feedback handlers**:
- `alert <team>` — routes anomaly to the named team's incident feed via StreamSight (`lex://estream/apps/polylabs.files/incidents`)
- `store` — persists the anomaly score and explanation in the series for audit (implicit via `series ... witness_attest true`)
- `auto_apply` — automatically applies the Cortex recommendation (e.g., auto-reclassify). Not yet enabled for Poly Files; requires human-in-the-loop review gate.

### Graph-Level AI Feeds & Observe Thresholds

Beyond per-type Cortex, each graph/DAG declares `ai_feed` streams and `observe` threshold blocks:

| Construct | AI Feeds | Observed Overlays | Anomaly Score | Baseline Window |
|-----------|----------|-------------------|---------------|-----------------|
| `file_registry` | `file_anomaly_detection`, `classification_suggestion` | `classification`, `scatter_health`, `size_bytes` | 0.85 | 300s |
| `version_history` | `version_anomaly_detection`, `merge_conflict_prediction` | `shard_health`, `download_count`, `branch_depth` | 0.85 | 300s |
| `share_network` | `share_anomaly_detection`, `permission_escalation_detection` | `permission_level`, `access_count`, `active_shares` | 0.9 | 300s |

The `observe` block continuously computes anomaly scores over the listed overlays. When the score exceeds the threshold, the graph-level AI feed fires and the per-type `on_anomaly` handler routes the alert.

### Quantum State Snapshots (`.q`)

Every `series` declaration (`file_series`, `version_series`, `share_series`) includes:

```fastlang
series file_series: file_registry
    merkle_chain true
    lattice_imprint true
    witness_attest true
```

This enables **`.q` quantum state snapshots** — a complete point-in-time capture of the graph/DAG state:

- **`merkle_chain true`** — each series entry is chained via Merkle hash to the previous, forming a tamper-evident log of all mutations
- **`lattice_imprint true`** — the series head hash is periodically imprinted on the eStream lattice, creating an immutable public timestamp
- **`witness_attest true`** — independent witness nodes attest to the series state, providing Byzantine-fault-tolerant proof that the snapshot is authentic

A `.q` snapshot captures: all node/edge data, all overlay values, the Cortex inference state (anomaly scores, last-inferred timestamps), and the state machine positions (e.g., `share_lifecycle` states). This is used for compliance audits, disaster recovery, and cross-datacenter replication verification.

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
git remote add poly poly-git://org.polygit/my-repo
git push poly main      # → es-git push with classification overlay
git clone poly-git://org.polygit/my-repo
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
| `polyfiles_encrypt` | `polyfiles_encrypt.fl` | ML-KEM-1024 key gen, AES-256-GCM chunk encryption | ≤128 KB |
| `polyfiles_chunk` | `polyfiles_chunk.fl` | 4 MB chunking, erasure coding, reassembly | ≤128 KB |
| `polyfiles_classify` | `polyfiles_classify.fl` | Classification assignment, policy lookup | ≤128 KB |
| `polyfiles_manifest` | `polyfiles_manifest.fl` | Manifest build, ML-DSA-87 signing, verification | ≤128 KB |
| `polyfiles_eslm_classify` | `polyfiles_eslm_classify.fl` | ESLM content auto-classification | ≤128 KB |

All circuits compose PolyKit:
```fastlang
circuit polyfiles_encrypt(user_id: bytes(16), file_key: bytes(32), chunk: bytes) -> bytes
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
| `polyfiles_storage_router` | `polyfiles_storage_router.fl` | Scatter policy enforcement, VRF shard distribution |
| `polyfiles_share` | `polyfiles_share.fl` | ACL enforcement, ephemeral link validation |
| `polyfiles_metering` | `polyfiles_metering.fl` | Per-product 8D metering (isolated) |

---

## File Upload Flow

1. User selects file(s) in Poly Data client
2. **`polyfiles_classify` circuit** (WASM):
   - Checks `.polyclassification`, folder inheritance, enterprise policy
   - Falls through to `polyfiles_eslm_classify` for AI suggestion if no explicit tag
3. **`polyfiles_encrypt` circuit** (WASM):
   - Generates random AES-256-GCM per-file key
   - Wraps per-file key with user's SPARK ML-KEM-1024 public key
4. **`polyfiles_chunk` circuit** (WASM):
   - Chunks large files (4 MB chunks)
   - Encrypts each chunk with per-file AES-256-GCM key
   - Erasure-codes chunks (k-of-n based on classification)
5. **`polyfiles_manifest` circuit** (WASM):
   - Constructs scatter-cas `Commit` object: chunk hashes, shard map, classification
   - Signs with user's SPARK ML-DSA-87 signing key
6. Client emits to `polylabs.data.{user_id}.upload` via eStream wire protocol
7. **`polyfiles_storage_router` circuit** (lattice):
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
| `polydata-esn-ai-recs` | governance | FLIR optimization recommendations |
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

Offline copies stored in ESLite (`/polyfiles/offline/*`), encrypted with device-bound SPARK key.

---

## Directory Structure

```
polydata/
├── circuits/fl/
│   ├── polyfiles_encrypt.fl
│   ├── polyfiles_chunk.fl
│   ├── polyfiles_classify.fl
│   ├── polyfiles_manifest.fl
│   ├── polyfiles_eslm_classify.fl
│   ├── polyfiles_storage_router.fl
│   ├── polyfiles_share.fl
│   ├── polyfiles_metering.fl
│   └── graphs/
│       ├── polyfiles_file_graph.fl
│       ├── polyfiles_version_dag.fl
│       └── polyfiles_share_graph.fl
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
- FastLang circuits (replacing FLIR YAML)
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
