# Poly Data Architecture

**Version**: 2.0
**Last Updated**: February 2026
**Platform**: eStream v0.8.1
**Upstream Dependency**: [ESCIR WASM Client Spec](https://github.com/polyquantum/estream-io/blob/main/specs/architecture/ESCIR_WASM_CLIENT_SPEC.md) (Issue [#550](https://github.com/polyquantum/estream-io/issues/550))
**SDK Baseline**: Wire-protocol-only per [#551](https://github.com/polyquantum/estream-io/issues/551)

---

## Overview

Poly Data is a post-quantum encrypted, scatter-distributed file storage and version control system. Every file is encrypted client-side with ML-KEM-1024, erasure-coded, and distributed across multiple independent storage providers and jurisdictions. Classification tags drive scatter policy, offline access, and retention.

All client-side cryptographic operations run in WASM compiled from ESCIR circuit definitions via the eStream ESCIR pipeline. All client-server communication flows over native eStream streams using the wire protocol (UDP/QUIC/WebTransport) — no HTTP REST endpoints.

---

## Identity & Authentication

### SPARK Derivation Context

Poly Data uses SPARK identity with the HKDF derivation context `"poly-data-v1"`. This produces isolated cryptographic keys that cannot be used to access other Poly products or eStream contexts.

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

All stream topics, file ownership, and ACLs reference this SPARK-derived `user_id`. There are no usernames, emails, or phone numbers.

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Poly Data Client                                                │
│                                                                  │
│  1. User authenticates with SPARK biometric                      │
│     SPARK → WASM → HKDF("poly-data-v1") → signing + encryption  │
│                                                                  │
│  2. Client connects to eStream via wire protocol                 │
│     SparkChallengeRequest (0x50) ──────────────────► Edge Node   │
│     SparkChallenge (0x51) ◄────────────────────────              │
│     SparkAuthRequest (0x52) + ML-DSA-87 sig ──────►              │
│     SparkSessionGrant (0x53) ◄─────────────────────              │
│                                                                  │
│  3. Session token used for all subsequent stream operations       │
│     Subscribe, Emit, Request/Reply — all over wire datagrams     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Hierarchy

```
SPARK master_seed
  └── HKDF("poly-data-v1")
        ├── user_signing_key (ML-DSA-87)      — signs manifests, ACL changes, commits
        ├── user_encryption_key (ML-KEM-1024)  — wraps per-file keys
        └── per-file keys (random, wrapped)
              ├── file_key_0 (AES-256-GCM)     — encrypts chunks of file 0
              ├── file_key_1 (AES-256-GCM)     — encrypts chunks of file 1
              └── ...
```

Each file gets a random AES-256-GCM key. That key is wrapped (encapsulated) with the user's SPARK-derived ML-KEM-1024 public key. To share a file, the per-file key is re-wrapped with the recipient's SPARK ML-KEM-1024 public key.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Poly Data Client                              │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ File Manager │  │ Share       │  │ Search   │  │ poly-git CLI │  │
│  │ (UI)        │  │ Manager(UI) │  │ (UI)     │  │              │  │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  └──────┬───────┘  │
│         │                │              │               │           │
│  ┌──────┴────────────────┴──────────────┴───────────────┴────────┐  │
│  │              ESCIR Client Circuits (WASM via .escd)             │  │
│  │                                                                 │  │
│  │  poly-data-encrypt │ poly-data-chunk │ poly-data-classify      │  │
│  │  poly-data-manifest │ poly-data-eslm-classify                  │  │
│  │  (all ML-DSA-87 signed .escd packages, StreamSight-annotated)  │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                              │                                        │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │              ESLite (Client-Side State)                           │  │
│  │  /polydata/files/* — file metadata + manifest cache              │  │
│  │  /polydata/index/* — encrypted search index                      │  │
│  │  /polydata/offline/* — offline manifest + encrypted cache        │  │
│  │  /polydata/classify/* — classification policy cache               │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
│                              │                                        │
│  ┌──────────────────────────┴──────────────────────────────────────┐  │
│  │              eStream SDK (@estream/sdk-browser or react-native)  │  │
│  │              Wire protocol only: UDP :5000 / WebTransport :4433 │  │
│  └──────────────────────────┬──────────────────────────────────────┘  │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
                        eStream Wire Protocol (QUIC/UDP)
                               │
┌──────────────────────────────┼────────────────────────────────────────┐
│                         eStream Network                                │
│                               │                                        │
│  ┌────────────────────────────┴─────────────────────────────────────┐ │
│  │              ESCIR Server Circuits (lattice-hosted)                │ │
│  │                                                                    │ │
│  │  poly-data-storage-router │ poly-data-version                     │ │
│  │  poly-data-share          │ poly-data-metering                    │ │
│  └────┬───────────┬──────────────┬───────────┬──────────────────────┘ │
│       │           │              │           │                        │
│  ┌────┴───┐  ┌────┴───┐  ┌──────┴──┐  ┌─────┴───┐                   │
│  │Scatter │  │Version │  │ Share   │  │Metering │                   │
│  │Store   │  │Circuit │  │ Circuit │  │Circuit  │                   │
│  └────┬───┘  └────────┘  └─────────┘  └─────────┘                   │
│       │                                                               │
│  ┌────┴──────────────────────────────────────────────────────────┐   │
│  │              Scatter Storage Layer                               │   │
│  │  AWS │ GCP │ Azure │ Cloudflare │ Hetzner │ Self-host           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Circuit Architecture

### Client-Side Circuits (compiled to `.escd` WASM)

All client-side crypto and protocol logic runs in WASM generated from ESCIR circuit definitions. Each circuit is individually compiled, ML-DSA-87 signed, and packaged as an `.escd` archive per the [ESCIR WASM Client Spec](https://github.com/polyquantum/estream-io/blob/main/specs/architecture/ESCIR_WASM_CLIENT_SPEC.md).

| Circuit | Lex Namespace | Purpose | Size Budget |
|---------|--------------|---------|-------------|
| `poly-data-encrypt` | `polylabs.data.encrypt` | ML-KEM-1024 per-file key generation, key wrapping with SPARK user key, AES-256-GCM chunk encryption | ≤ 128 KB |
| `poly-data-chunk` | `polylabs.data.chunk` | 4 MB chunking, erasure coding (k-of-n per classification), chunk reassembly | ≤ 128 KB |
| `poly-data-classify` | `polylabs.data.classify` | Classification tag assignment, policy lookup, inheritance, `.polyclassification` parsing | ≤ 128 KB |
| `poly-data-manifest` | `polylabs.data.manifest` | Manifest construction (chunk hashes, shard map), ML-DSA-87 signing, manifest verification | ≤ 128 KB |
| `poly-data-eslm-classify` | `polylabs.data.eslm.classify` | ESLM content analysis for auto-classification suggestions (runs client-side, content never leaves device) | ≤ 128 KB |

**Total client bundle: ≤ 512 KB** (5 circuits)
**Instantiation time: ≤ 50 ms per circuit**
**WASM linear memory: ≤ 4 MB per circuit**

### Server-Side Circuits (lattice-hosted, not `.escd`)

| Circuit | Lex Namespace | Purpose | Precision |
|---------|--------------|---------|-----------|
| `poly-data-storage-router` | `polylabs.data.router` | Scatter policy enforcement, VRF-directed shard distribution, jurisdiction routing | Class C |
| `poly-data-version` | `polylabs.data.version` | Version history, hash chain, manifest storage | Class C |
| `poly-data-share` | `polylabs.data.share` | ACL enforcement, share stream management, ephemeral link payload validation | Class B |
| `poly-data-metering` | `polylabs.data.metering` | 8-dimension usage tracking, billing dimensions | Class C |

### `.escd` Package Format

Each client circuit is packaged as:

```
poly-data-encrypt.escd (ZIP archive)
├── manifest.json           # Circuit metadata, version, lex namespace, WASM hash, signature ref
├── poly-data-encrypt.wasm  # WASM binary from ESCIR pipeline
├── poly-data-encrypt.wasm.sig  # ML-DSA-87 detached signature
└── poly-data-encrypt.wat   # (optional) WAT for debug builds
```

Build commands:

```bash
estream-dev build-wasm-client \
  --circuit circuits/poly-data-encrypt/circuit.escir.yaml \
  --output dist/ \
  --sign estream-signing.sk.pem \
  --enforce-budget

estream-dev package-escd \
  dist/poly-data-encrypt.wasm \
  --sign estream-signing.sk.pem \
  --version 1.0.0 \
  --lex polylabs.data.encrypt
```

Clients verify the ML-DSA-87 signature on every `.wasm` artifact before `WebAssembly.instantiate`. Unsigned or tampered modules are rejected with a hard error.

---

## SDK Integration

### Transport Priority (per issue [#551](https://github.com/polyquantum/estream-io/issues/551))

| Platform | SDK | Transport | Spark Auth |
|----------|-----|-----------|------------|
| Desktop (Tauri) | `@estream/sdk-browser` | WebTransport :4433 | Wire datagrams (0x50-0x54) |
| Browser | `@estream/sdk-browser` | WebTransport :4433 | Wire datagrams (0x50-0x54) |
| Mobile | `@estream/react-native` | QUIC/UDP :5000 | Wire datagrams (0x50-0x54) |

No HTTP REST fallbacks. All stream operations (subscribe, emit, request/reply) flow over wire protocol datagrams.

### Client Initialization

```typescript
import { SparkAuth } from '@estream/spark-auth';
import { EstreamClient } from '@estream/sdk-browser';

const spark = await SparkAuth.authenticate({ image: sparkImage, challenge });
const polyDataIdentity = spark.deriveIdentity('poly-data-v1');

const client = new EstreamClient({
  transport: 'webtransport',
  identity: polyDataIdentity,
});

await client.connect();

await client.subscribe('polylabs.data.{user_id}.upload.confirm');
await client.subscribe('polylabs.data.{user_id}.download');
```

---

## File Upload Flow

1. User selects file(s) in Poly Data client
2. **`poly-data-classify` circuit** (WASM):
   - Assigns/inherits classification tag from `.polyclassification` or parent folder
   - If no explicit tag: **`poly-data-eslm-classify` circuit** analyzes content sample (client-side, never leaves device) and suggests tag with confidence score
   - Looks up scatter policy for classification level
3. **`poly-data-encrypt` circuit** (WASM):
   - Generates random AES-256-GCM per-file key
   - Wraps per-file key with user's SPARK-derived ML-KEM-1024 public key
4. **`poly-data-chunk` circuit** (WASM):
   - Chunks large files (4 MB chunks)
   - Encrypts each chunk with per-file AES-256-GCM key
   - Erasure-codes chunks (k-of-n based on classification)
5. **`poly-data-manifest` circuit** (WASM):
   - Constructs manifest: chunk hashes, shard map, classification, wrapped key
   - Signs manifest with user's SPARK-derived ML-DSA-87 signing key
6. Client emits to `polylabs.data.{user_id}.upload` stream topic via eStream SDK
7. **`poly-data-storage-router` circuit** (lattice):
   - Validates ML-DSA-87 manifest signature against user's SPARK public key
   - Enforces classification policy (scatter breadth, jurisdictions)
   - Distributes shards via VRF-directed scatter
   - Records manifest (encrypted) to version circuit
   - Updates user's file index
8. Confirmation published to `polylabs.data.{user_id}.upload.confirm`
9. Client ESLite updates: `/polydata/files/{file_id}` metadata cached locally

---

## File Download Flow

1. User requests file in client
2. Client retrieves manifest from ESLite cache (`/polydata/files/{file_id}`) or requests from `polylabs.data.{user_id}.download` stream (request/reply pattern)
3. **`poly-data-storage-router` circuit** (lattice) collects k-of-n shards from scatter providers
4. **`poly-data-chunk` circuit** (WASM) reassembles erasure-coded chunks
5. **`poly-data-encrypt` circuit** (WASM):
   - Unwraps per-file key using user's SPARK-derived ML-KEM-1024 private key
   - Decrypts chunks with per-file AES-256-GCM key
6. **`poly-data-manifest` circuit** (WASM) verifies manifest signature
7. Client renders file
8. If classification allows offline: encrypted copy cached in ESLite (`/polydata/offline/{file_id}`)
9. If RESTRICTED/SOVEREIGN: streaming view only, no local cache

---

## Classification System

### Tags

```
PUBLIC      -> Minimal scatter, full offline, any jurisdiction
INTERNAL    -> 3-of-5 scatter, offline, 2+ jurisdictions
CONFIDENTIAL -> 5-of-7 scatter, selective offline, 3+ jurisdictions
RESTRICTED  -> 7-of-9 scatter, NO offline, 3+ jurisdictions, auto-expire viewer
SOVEREIGN   -> 9-of-13 scatter, NO offline, 5+ jurisdictions, HSM-backed
```

### Assignment

- Manual: User tags files/folders
- Inherited: Files inherit parent folder's classification
- Auto: ESLM content analysis suggests classification
- Policy: Enterprise admin sets minimum classification per path

### .polyclassification

```yaml
# Repository-level classification (like .gitattributes)
/contacts/**     classification: SOVEREIGN
/meetings/**     classification: RESTRICTED
/studies/**      classification: CONFIDENTIAL
/public/**       classification: PUBLIC
*.pdf            classification: CONFIDENTIAL
```

---

## Sharing

### ACL-Based Sharing (Folders)

Folder ACLs reference SPARK identities directly. ACL changes are signed with the owner's SPARK-derived ML-DSA-87 key and published to the share stream.

```yaml
folder: /projects/alpha
acl:
  - user: spark:did:alice    # SPARK identity
    role: editor
    expires: 2026-06-01
  - user: spark:did:bob
    role: viewer
  - group: spark:org:engineering
    role: editor
```

ACL operations flow over streams:

```
Owner signs ACL change with SPARK ML-DSA-87
  → Emits to polylabs.data.{user_id}.share.acl
  → poly-data-share circuit validates signature
  → Per-file key re-wrapped with recipient's SPARK ML-KEM-1024 public key
  → Recipient subscribes to polylabs.data.{recipient_id}.share.incoming
  → Recipient receives wrapped file key + manifest reference
```

### Link-Based Sharing (Ephemeral Links)

Link sharing uses the eStream **Ephemeral Links** pattern (same as Poly Messenger friend invites). The link payload is ML-KEM-1024 encrypted and stored in ESLite on edge nodes with TTL-based expiry. Edge nodes never see decrypted content.

```
Owner creates share link:
  1. poly-data-encrypt circuit generates one-time ML-KEM-1024 key pair
  2. Per-file access key wrapped with one-time public key
  3. EphemeralLink.create_file_share({
       file_manifest_ref,
       access_key_encrypted,    # per-file key wrapped with one-time key
       classification,
       permissions: "view" | "download",
       expires_at,
     })
  4. Encrypted payload stored in ESLite on edge node
  5. Returns URL: https://link.estream.dev/e/{lookup_key}

Recipient opens link:
  1. Client fetches encrypted payload from edge ESLite
  2. Decrypts client-side with one-time private key (embedded in URL fragment)
  3. Retrieves file manifest from scatter network
  4. Classification governs: view-only vs download, expiry, access count
  5. No account needed for PUBLIC classification
  6. SPARK auth required for CONFIDENTIAL and above
```

Ephemeral link properties:
- Default TTL: 5 minutes (configurable, max 1 hour for RESTRICTED+)
- One-time use (consumed on first access) or multi-use (configurable)
- Zero-knowledge: edge nodes see only encrypted payload
- URL format: `https://link.estream.dev/e/{lookup_key}` (base58, 8 bytes)

---

## poly-git: Scatter-Distributed Version Control

### Overview

`poly-git` is a Git remote helper that stores Git objects in Poly Data's scatter storage:

```bash
git remote add poly poly-git://org.polydata/my-repo
git push poly main
git clone poly-git://org.polydata/my-repo
git pull poly main
```

### How It Works

```
git push poly main
    │
    ▼
poly-git remote helper
    │
    ├── Enumerate objects to push
    ├── For each object:
    │   ├── poly-data-encrypt circuit: PQ-encrypt with repo key
    │   ├── poly-data-chunk circuit: erasure-code (k-of-n per classification)
    │   ├── Emit to polylabs.data.{user_id}.upload stream
    │   └── Record object hash → shard manifest
    ├── Update refs (scatter-stored, SPARK ML-DSA-87 signed)
    │
    ▼
git push complete
```

### PQ-Signed Commits

```bash
# Sign commits with ML-DSA-87 via SPARK identity
git config user.signingkey spark:did:alice
git commit -S -m "Add feature"
# → Commit signed with SPARK-derived ML-DSA-87 key (context: poly-data-v1)
```

### Classification per Path

```yaml
# .polyclassification in repo root
/src/**              classification: INTERNAL
/docs/public/**      classification: PUBLIC
/secrets/**          classification: SOVEREIGN
*.env                classification: RESTRICTED
```

### LFS Integration

Large files automatically route through scatter storage:

```bash
git lfs track "*.bin"
git add large-model.bin
git push poly main
# → LFS objects scatter-stored with classification policy
```

---

## ESCIR Circuit Definitions

### Client Circuit: poly-data-encrypt

```yaml
escir: "0.8.1"
name: poly-data-encrypt
version: "1.0.0"
lex: polylabs.data.encrypt
target: wasm-client

emissions:
  - name: encrypt_telemetry
    path: "lex://estream/apps/polylabs.data/telemetry"
    annotations:
      - "@streamsight_filter: baseline"
      - "@streamsight_sensitivity: 2.0"
      - "@streamsight_warmup: 1000"
      - "@streamsight_sample_normal: 0.001"

exports:
  - fn: generate_file_key
    desc: "Generate random AES-256-GCM per-file key"
  - fn: wrap_file_key
    desc: "Wrap per-file key with SPARK ML-KEM-1024 public key"
  - fn: unwrap_file_key
    desc: "Unwrap per-file key with SPARK ML-KEM-1024 private key"
  - fn: encrypt_chunk
    desc: "Encrypt chunk with per-file AES-256-GCM key"
    telemetry:
      - "ctx.streamsight.gauge('polydata.encrypt.chunk_ns', elapsed)"
  - fn: decrypt_chunk
    desc: "Decrypt chunk with per-file AES-256-GCM key"
  - fn: rewrap_file_key
    desc: "Re-wrap per-file key for share recipient's SPARK ML-KEM-1024 key"
```

### Client Circuit: poly-data-chunk

```yaml
escir: "0.8.1"
name: poly-data-chunk
version: "1.0.0"
lex: polylabs.data.chunk
target: wasm-client

emissions:
  - name: chunk_telemetry
    path: "lex://estream/apps/polylabs.data/telemetry"
    annotations:
      - "@streamsight_filter: baseline"
      - "@streamsight_sensitivity: 2.0"
      - "@streamsight_warmup: 1000"

exports:
  - fn: chunk_file
    desc: "Split file into 4 MB chunks"
  - fn: erasure_encode
    desc: "Erasure-code chunks (k-of-n per classification)"
    telemetry:
      - "ctx.streamsight.gauge('polydata.erasure.encode_ns', elapsed)"
  - fn: erasure_decode
    desc: "Reassemble k-of-n shards into original chunks"
  - fn: reassemble_file
    desc: "Reassemble chunks into original file"
```

### Client Circuit: poly-data-classify

```yaml
escir: "0.8.1"
name: poly-data-classify
version: "1.0.0"
lex: polylabs.data.classify
target: wasm-client

emissions:
  - name: classify_telemetry
    path: "lex://estream/apps/polylabs.data/telemetry"
    annotations:
      - "@streamsight_filter: baseline"
      - "@streamsight_sensitivity: 2.5"
      - "@streamsight_warmup: 500"

exports:
  - fn: classify_file
    desc: "Assign classification tag (manual, inherited, auto, policy)"
    telemetry:
      - "ctx.streamsight.counter('polydata.classify.changes_total', 1)"
      - "ctx.streamsight.event(ClassifyEvent { file_id, old_tag, new_tag, source })"
  - fn: parse_polyclassification
    desc: "Parse .polyclassification file for path-based classification"
  - fn: lookup_scatter_policy
    desc: "Return k-of-n and jurisdiction count for classification level"
  - fn: validate_classification
    desc: "Validate classification meets minimum policy requirements"
```

### Client Circuit: poly-data-manifest

```yaml
escir: "0.8.1"
name: poly-data-manifest
version: "1.0.0"
lex: polylabs.data.manifest
target: wasm-client

exports:
  - fn: build_manifest
    desc: "Construct manifest: chunk hashes, shard map, classification, wrapped key"
  - fn: sign_manifest
    desc: "Sign manifest with SPARK-derived ML-DSA-87 key"
  - fn: verify_manifest
    desc: "Verify manifest ML-DSA-87 signature"
  - fn: build_version_entry
    desc: "Construct version history entry for manifest"
```

### Server Circuit: poly-data-storage-router

```yaml
escir: "0.8.1"
name: poly-data-storage-router
version: "1.0.0"
lex: polylabs.data.router

emissions:
  - name: router_telemetry
    path: "lex://estream/apps/polylabs.data/telemetry"
    annotations:
      - "@streamsight_filter: baseline"
      - "@streamsight_sensitivity: 2.0"
      - "@streamsight_warmup: 1000"
      - "@streamsight_sample_normal: 0.001"

stream:
  - topic: "polylabs.data.{user_id}.upload"
    pattern: scatter
    retention: permanent
    hash_chain: true
    signature_required: true

  - topic: "polylabs.data.{user_id}.download"
    pattern: request_reply
    retention: none
    signature_required: true

  - topic: "polylabs.data.{user_id}.upload.confirm"
    pattern: scatter
    retention: ephemeral
    signature_required: false

fsm:
  initial_state: uploading
  states:
    uploading:
      transitions:
        - event: chunks_encrypted
          target: scattering
    scattering:
      transitions:
        - event: scatter_complete
          target: stored
        - event: scatter_failed
          target: retry
    stored:
      transitions:
        - event: share_created
          target: shared
        - event: version_created
          target: versioned
        - event: deleted
          target: purging
    purging:
      transitions:
        - event: all_shards_deleted
          target: purged
```

### Server Circuit: poly-data-share

```yaml
escir: "0.8.1"
name: poly-data-share
version: "1.0.0"
lex: polylabs.data.share

stream:
  - topic: "polylabs.data.{user_id}.share.acl"
    pattern: scatter
    retention: permanent
    hash_chain: true
    signature_required: true

  - topic: "polylabs.data.{recipient_id}.share.incoming"
    pattern: scatter
    retention: policy_based
    signature_required: true

  - topic: "polylabs.data.{user_id}.share.ephemeral"
    pattern: request_reply
    retention: ephemeral
    signature_required: true

fsm:
  initial_state: pending
  states:
    pending:
      transitions:
        - event: acl_signed
          target: validating
    validating:
      transitions:
        - event: signature_valid
          target: active
        - event: signature_invalid
          target: rejected
    active:
      transitions:
        - event: expired
          target: revoked
        - event: owner_revoked
          target: revoked
    revoked:
      transitions: []
```

### Server Circuit: poly-data-version

```yaml
escir: "0.8.1"
name: poly-data-version
version: "1.0.0"
lex: polylabs.data.version

stream:
  - topic: "polylabs.data.{user_id}.version.{file_id}"
    pattern: scatter
    retention: policy_based
    hash_chain: true
    signature_required: true
```

### Server Circuit: poly-data-metering

```yaml
escir: "0.8.1"
name: poly-data-metering
version: "1.0.0"
lex: polylabs.data.metering

stream:
  - topic: "polylabs.data.metering.{user_id}"
    pattern: scatter
    retention: permanent
    hash_chain: true
```

---

## Stream Architecture Alignment

| Feature | Stream Pattern | Topology | Governance |
|---------|---------------|----------|------------|
| File upload | event | scatter | SOC2 |
| File download | request_reply | scatter | SOC2 |
| Upload confirmation | event | scatter | — |
| ACL sharing | event | scatter | SOC2 |
| Share incoming | event | scatter | SOC2 |
| Ephemeral links | request_reply | ephemeral | — |
| Version history | event | scatter | SOC2 |
| Metering | event | growing_context | SOC2 |
| poly-git push | event | scatter | SOC2 |
| poly-git clone | request_reply | scatter | SOC2 |
| StreamSight telemetry | curated | — | SOC2 |
| StreamSight deviations | event | — | SOC2 |
| ESLM classification | event | — | SOC2 |
| ESN-AI recommendations | event | — | SOC2 |

### Audience Filters

```
Poly Data Audience Hierarchy:
- owner: Full file content + metadata + classification
- recipient: Decrypted file content (via shared per-file key)
- node_operator: Shard routing metadata only (file_id, shard_index, size)
- admin: Aggregate metrics, storage usage
- public: Nothing (all fields hidden)

Scatter Privacy:
- Every file scattered across multiple providers (information-theoretic security)
- Fewer than k shards reveals zero information about file content
- Edge nodes never see decrypted file keys or content
```

---

## StreamSight Observability

Poly Data integrates the native eStream StreamSight framework for FPGA-accelerated observability. StreamSight uses a "Discard Normal" architecture — the baseline gate learns normal behavior for every metric and only persists deviations, anomalies, and statistical summaries (~180x storage reduction vs raw telemetry).

### Telemetry Stream Paths

```
lex://estream/apps/polylabs.data/telemetry          — Raw telemetry (5-min ring buffer)
lex://estream/apps/polylabs.data/telemetry/sli       — Aggregated SLI metrics (DDSketch)
lex://estream/apps/polylabs.data/metrics/baseline    — Baseline snapshots (every 5 min)
lex://estream/apps/polylabs.data/metrics/deviations  — Deviation records (z > 2.0)
lex://estream/apps/polylabs.data/incidents           — Anomaly incidents (z > 3.0)
lex://estream/apps/polylabs.data/metrics/trends      — Trend reports (hourly)
lex://estream/apps/polylabs.data/sla                 — SLA compliance
lex://estream/apps/polylabs.data/capacity            — Capacity forecasts
```

### Observation Levels

| Level | What is Emitted | When Active |
|-------|----------------|-------------|
| L0 (metrics) | Counters + gauges: upload latency, scatter time, chunk encrypt time, download reassembly, share ops | Always |
| L1 (events) | Classification changes, ACL modifications, share creation/revocation, ephemeral link creation | Always (baseline-gated) |
| L2 (detailed) | Per-chunk timing, per-shard placement, erasure codec performance, ESLite query times | ESN-AI escalation |
| L3 (debug) | Full manifest snapshots, shard routing decisions, key wrapping traces | Manual or ESN-AI escalation |

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `polydata.upload.latency_ns` | gauge | End-to-end upload latency (encrypt + chunk + scatter) |
| `polydata.download.latency_ns` | gauge | End-to-end download latency (collect + reassemble + decrypt) |
| `polydata.scatter.duration_ns` | gauge | Time to distribute shards across providers |
| `polydata.encrypt.chunk_ns` | gauge | Per-chunk AES-256-GCM encryption time |
| `polydata.erasure.encode_ns` | gauge | Erasure coding time per file |
| `polydata.uploads_total` | counter | Total uploads |
| `polydata.downloads_total` | counter | Total downloads |
| `polydata.shares_total` | counter | Total share operations (ACL + ephemeral) |
| `polydata.classify.changes_total` | counter | Classification tag changes |
| `polydata.offline.sync_total` | counter | Offline sync operations |
| `polydata.ephemeral.created_total` | counter | Ephemeral share links created |
| `polydata.shard.failure_total` | counter | Shard retrieval failures |

### Circuit StreamSight Annotations

All ESCIR circuits include StreamSight annotations on their emission streams:

```yaml
emissions:
  - name: upload_telemetry
    path: "lex://estream/apps/polylabs.data/telemetry"
    annotations:
      - "@streamsight_filter: baseline"
      - "@streamsight_sensitivity: 2.0"
      - "@streamsight_warmup: 1000"
      - "@streamsight_sample_normal: 0.001"
```

### Baseline Gate Integration

The StreamSight baseline gate runs at wire speed on FPGA (50M events/sec @ 200 MHz). For Poly Data:
- Learns normal upload/download latency distributions per classification level
- Detects scatter storage provider degradation (shard retrieval latency deviations)
- Flags unusual classification change patterns (possible policy misconfiguration)
- Monitors erasure coding performance regressions across circuit updates
- Seasonal awareness (168 baseline banks: 24h x 7d) prevents false positives from diurnal usage patterns

Deviations feed directly into ESN-AI for correlation and proactive recommendations.

---

## ESLM Integration

Poly Data integrates ESLM (eStream Language Model) for two purposes: content-aware auto-classification and proactive operational intelligence via ESN-AI.

### Auto-Classification Circuit

The `poly-data-eslm-classify` circuit uses ESLM inference to analyze file content and suggest classification tags. This supplements manual, inherited, and policy-based classification.

```yaml
escir: "0.8.1"
name: poly-data-eslm-classify
version: "1.0.0"
lex: polylabs.data.eslm.classify

inputs:
  - id: file_content_sample
    desc: "First 4KB of file content (never leaves client WASM)"

outputs:
  - id: suggested_classification
    desc: "Suggested classification tag with confidence score"
    path: "lex://estream/apps/polylabs.data/eslm/classification"

emissions:
  - name: eslm_classify_telemetry
    path: "lex://estream/apps/polylabs.data/telemetry"
    annotations:
      - "@streamsight_filter: baseline"
      - "@streamsight_sensitivity: 2.5"

exports:
  - fn: classify_content
    desc: "Analyze content sample, return suggested classification + confidence"
  - fn: classify_filename
    desc: "Classify based on filename patterns and path context"
```

Classification flow:

```
File selected for upload
  │
  ├── poly-data-classify circuit: check .polyclassification, inheritance, policy
  │     → If explicit classification exists, use it (skip ESLM)
  │
  └── poly-data-eslm-classify circuit: analyze content sample
        → Returns: { tag: CONFIDENTIAL, confidence: 0.92 }
        → If confidence ≥ 0.8: auto-apply (user can override)
        → If confidence < 0.8: suggest to user, require manual confirm
        → All ESLM suggestions logged to StreamSight (L1 events)
```

Content analysis runs entirely in client-side WASM. The file content sample never leaves the device — only the suggested classification tag is emitted to the stream.

### ESN-AI Proactive Insights

StreamSight deviations from Poly Data circuits feed into ESN-AI, which provides proactive insights and ESCIR optimization recommendations.

#### Insight Categories for Poly Data

**Circuit Optimization**:
- "poly-data-chunk erasure encoding latency increased 35% since v1.0.2 — k-of-n parameters for CONFIDENTIAL classification may be suboptimal. Consider 4-of-6 instead of 5-of-7 for files under 10 MB."
- "poly-data-encrypt key wrapping spends 40% of total upload time — batch key operations could reduce overhead."
- "poly-data-manifest signing accounts for 18% of upload latency — consider deferred signing for INTERNAL classification."

**Capacity Planning**:
- "At current growth rate, user X scatter storage will exceed tier limit in 14 days."
- "Scatter provider us-west-2 consistently 2x slower than eu-central-1 for SOVEREIGN shards — recommend rebalancing scatter policy."
- "Offline sync for CONFIDENTIAL files consuming 72% of ESLite budget — suggest more aggressive cache eviction."

**Anomaly Correlation**:
- "Upload failures correlate with scatter provider Azure-EU degradation starting 2026-02-15T14:00Z — 3 users affected."
- "Classification change rate 5x above baseline for org:engineering — possible bulk reclassification or policy misconfiguration."
- "Download latency P99 degraded 40% since poly-data-chunk v1.0.3 deployment — erasure decode path regression likely."

**Security**:
- "Unusual ephemeral link creation pattern: 50 links in 1 hour from single user (baseline: 2/day) — possible data exfiltration."
- "ACL modifications from new device not yet verified via SPARK — flag for user review."

#### ESN-AI Stream Paths

```
lex://estream/apps/polylabs.data/eslm/recommendation     — ESCIR optimization recommendations
lex://estream/apps/polylabs.data/eslm/capacity            — Capacity planning insights
lex://estream/apps/polylabs.data/eslm/anomaly             — Anomaly correlation results
lex://estream/apps/polylabs.data/eslm/security            — Security-related insights
lex://estream/apps/polylabs.data/eslm/classification      — Auto-classification results
```

#### Feedback Loop

ESN-AI recommendations feed back into circuit development:

```
StreamSight deviations
  → ESN-AI analyzes across Poly Data circuit fleet
  → Publishes optimization recommendation
  → Engineer reviews recommendation
  → Updates ESCIR circuit definition
  → New .escd built and signed (issue #550 pipeline)
  → SmartCircuit update delivered to clients
  → StreamSight monitors post-update baselines
  → ESN-AI compares predicted vs actual improvement
```

---

## Console Widgets

Poly Data registers console widgets following the eStream Console `registerWidget()` pattern (React + `@estream/sdk-browser` widget system). Widgets subscribe to Poly Data lex streams via the `WidgetDataGateway` with RBAC enforcement.

### StreamSight Dashboard Widgets

| Widget ID | Category | Description | Data Source |
|-----------|----------|-------------|-------------|
| `polydata-upload-latency` | observability | Real-time upload latency gauge (encrypt + chunk + scatter breakdown) | `polylabs.data.telemetry` |
| `polydata-scatter-health` | observability | Scatter provider status, per-provider shard retrieval latency | `polylabs.data.telemetry` |
| `polydata-classification-dist` | observability | Classification tag distribution across user files (pie/bar chart) | `polylabs.data.telemetry` |
| `polydata-deviation-feed` | observability | Live feed of StreamSight baseline deviations and anomalies | `polylabs.data.metrics.deviations` |
| `polydata-shard-failures` | observability | Shard retrieval failure rate, affected providers, impacted files | `polylabs.data.telemetry` |
| `polydata-capacity-forecast` | observability | Storage capacity forecast per classification tier, growth rate | `polylabs.data.capacity` |

### ESLM Management Widgets

| Widget ID | Category | Description | Data Source |
|-----------|----------|-------------|-------------|
| `polydata-eslm-classify-accuracy` | governance | Auto-classification accuracy: accepted vs overridden, confidence histogram | `polylabs.data.eslm.classification` |
| `polydata-eslm-review-queue` | governance | Human-in-the-loop review queue for low-confidence classifications | `polylabs.data.eslm.classification` |
| `polydata-eslm-feedback` | governance | Training feedback: human ratings, corrections, weight impact over time | `polylabs.data.eslm.classification` |
| `polydata-esn-ai-recommendations` | governance | ESN-AI proactive ESCIR optimization recommendations (accept/dismiss/snooze) | `polylabs.data.eslm.recommendation` |
| `polydata-eslm-sanitization-log` | governance | PII/PCI/HIPAA/GDPR sanitization audit trail — what was redacted and why | `polylabs.data.eslm.sanitization` |

### Widget Registration Example

```typescript
registerWidget({
  id: 'polydata-eslm-review-queue',
  title: 'Poly Data: Classification Review Queue',
  category: 'governance',
  icon: ReviewQueueIcon,
  component: lazy(() => import('./widgets/EslmReviewQueueWidget')),
  defaultSize: { cols: 12, rows: 4 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-operator'],
  lexStreams: ['polylabs.data.eslm.classification/**'],
});
```

### Human-in-the-Loop Review Workflow

The `polydata-eslm-review-queue` widget provides a review interface for ESLM classifications that fall below the confidence threshold:

```
ESLM auto-classifies file → confidence < 0.8
  → Appears in review queue widget
  → Reviewer sees:
      • File name + path
      • Suggested classification tag + confidence score
      • Content preview (sanitized — see Compliance Sanitization below)
      • Alternative tag suggestions with confidence scores
  → Reviewer actions:
      • Accept: confirms ESLM suggestion (rating: 5)
      • Override: selects correct tag (rating: 1-3, correction provided)
      • Flag: escalates to policy review (unusual content or edge case)
  → HumanFeedback submitted:
      { sample_hash, rating: 1-5, correction, reviewer_hash (pseudonymous) }
  → ESLM training loop applies 2x-3x weight to human-reviewed samples
  → polydata-eslm-feedback widget shows accuracy trend over time
```

### ESN-AI Recommendation Actions

The `polydata-esn-ai-recommendations` widget presents ESN-AI insights with actionable controls:

```
ESN-AI recommendation arrives:
  "poly-data-chunk erasure coding latency increased 35% since v1.0.2 —
   consider 4-of-6 instead of 5-of-7 for CONFIDENTIAL files under 10 MB"

  → Reviewer actions:
      • Accept: create task to update circuit parameters
      • Dismiss: mark as not actionable (feeds back to ESN-AI)
      • Snooze: revisit in N days
      • Investigate: opens StreamSight L2/L3 drill-down for this metric
```

### Compliance Sanitization

All data surfaced in console widgets passes through the ESLM 3-stage sanitization pipeline before display. No raw file content, user PII, or regulated data appears in the console.

**Sanitization Pipeline:**

```
Raw telemetry/metadata
  │
  ├─ Stage 1: PII Detection (slm-sanitize-pii)
  │    Names, SSNs, emails, phones, addresses
  │    → Typed placeholders: [NAME_1], [SSN_1], [EMAIL_1]
  │
  ├─ Stage 2: Value Transform (slm-sanitize-transform)
  │    Currency, dates, amounts, identifiers
  │    → Abstract patterns: [CURRENCY:USD:4DIGIT], [DATE:RECENT]
  │
  └─ Stage 3: Audit Record (slm-sanitize-audit)
       ESF field-level record of every transformation
       Reversibility proof (authorized de-anonymization only)
       PoVC witness for sanitization integrity
```

**Regulatory Enforcement:**

| Regulation | Enforcement | Console Impact |
|-----------|------------|----------------|
| HIPAA | PHI fields audience-filtered per lex governance | Patient data never visible in widgets; only aggregate metrics |
| PCI-DSS | Payment card data field-level redaction | Card numbers, CVVs replaced with `[PCI:CARD_1]` |
| GDPR | EU user data retained per lex TTL (e.g. 30-day) | Right-to-erasure removes data from all widget views |
| SOC2 | All widget data access logged, RBAC enforced | Audit trail via `WidgetDataGateway` |

**RBAC Roles:**

| Role | Access |
|------|--------|
| `polydata-operator` | Full access to all widgets, review queue, ESN-AI actions |
| `polydata-viewer` | Read-only access to StreamSight dashboards (no ESLM review or ESN-AI actions) |
| `polydata-compliance` | Sanitization log access, audit trail, compliance reporting |

### Sanitization Stream Path

```
lex://estream/apps/polylabs.data/eslm/sanitization  — All sanitization audit records
```

Every sanitization action is:
- Logged with ESF field-level detail (what was redacted, original type, placeholder used)
- PoVC-witnessed for integrity
- Queryable by `polydata-compliance` role for audit reports

---

## Offline Access

| Classification | Offline Policy |
|---------------|---------------|
| PUBLIC | Full offline copy, auto-sync |
| INTERNAL | Full offline copy, auto-sync |
| CONFIDENTIAL | Selective (user chooses per file/folder) |
| RESTRICTED | NO offline — streaming view only |
| SOVEREIGN | NO offline — HSM-gated streaming view |

Offline copies are stored in ESLite (`/polydata/offline/*`), encrypted with a device-bound key derived from SPARK biometric. If device is compromised:
- SPARK emergency wipe clears ESLite offline cache
- Scatter-stored originals unaffected
- Re-sync on new device via SPARK recovery

---

## Persistence Use Case

The "pastor in China" scenario from the investor brief:

```
Contact lists     -> SOVEREIGN: scatter 9-of-13, 5+ jurisdictions, HSM, no offline
Meeting locations -> RESTRICTED: scatter 7-of-9, no offline, auto-expire view
Bible studies     -> CONFIDENTIAL: scatter 5-of-7, 24hr offline cache
Published work    -> PUBLIC: scatter 2-of-3, full offline
```

Device seized → Authorities find only encrypted ESLite cache of non-sensitive published material.

---

## Metering

| Operation | Primary Dimensions |
|-----------|-------------------|
| Upload | Bandwidth, Storage, Operations |
| Download | Bandwidth, Operations |
| Scatter store | Storage (×n shards), Bandwidth |
| Ephemeral link | Operations |
| Search | Operations, Memory |
| poly-git push | Bandwidth, Storage, Operations |
| poly-git clone | Bandwidth, Operations |

---

## Circuit Directory Structure

```
polydata/
├── circuits/
│   ├── poly-data-encrypt/
│   │   ├── circuit.escir.yaml
│   │   └── tests/
│   ├── poly-data-chunk/
│   │   ├── circuit.escir.yaml
│   │   └── tests/
│   ├── poly-data-classify/
│   │   ├── circuit.escir.yaml
│   │   └── tests/
│   ├── poly-data-manifest/
│   │   ├── circuit.escir.yaml
│   │   └── tests/
│   ├── poly-data-eslm-classify/
│   │   ├── circuit.escir.yaml
│   │   └── tests/
│   ├── poly-data-storage-router/
│   │   ├── circuit.escir.yaml
│   │   └── tests/
│   ├── poly-data-share/
│   │   ├── circuit.escir.yaml
│   │   └── tests/
│   ├── poly-data-version/
│   │   ├── circuit.escir.yaml
│   │   └── tests/
│   └── poly-data-metering/
│       ├── circuit.escir.yaml
│       └── tests/
├── dist/
│   ├── poly-data-encrypt.escd
│   ├── poly-data-chunk.escd
│   ├── poly-data-classify.escd
│   ├── poly-data-manifest.escd
│   └── poly-data-eslm-classify.escd
├── docs/
│   └── ARCHITECTURE.md
└── package.json
```

---

## Roadmap

### Phase 1: Core Storage (Q2 2026)
- File upload/download with PQ encryption (ESCIR client circuits)
- Classification tags (manual + inherited)
- Scatter storage (3-of-5)
- SPARK biometric auth (context: `poly-data-v1`) over wire protocol
- ESLite client-side state
- Basic web client (Tauri) using `@estream/sdk-browser`
- `.escd` WASM packaging for client circuits
- StreamSight L0 metrics on all circuits (upload latency, scatter time, encrypt time)
- StreamSight baseline gate integration for core circuit fleet

### Phase 2: Collaboration (Q3 2026)
- ACL-based sharing via SPARK DIDs on streams
- Ephemeral link sharing (eStream Ephemeral Links pattern)
- Version history (poly-data-version circuit)
- Selective offline sync (ESLite-backed)
- Mobile app using `@estream/react-native`
- Search (ESLite client-side encrypted index)
- StreamSight L1 events for share operations, classification changes
- ESLM auto-classification circuit (`poly-data-eslm-classify`)
- Console widgets: StreamSight dashboard (6 widgets) + ESLM management (5 widgets)
- Human-in-the-loop ESLM review queue with compliance-sanitized content preview
- 3-stage sanitization pipeline (PII detect → value transform → audit) for all console views

### Phase 3: poly-git (Q4 2026)
- Git remote helper
- PQ-signed commits (SPARK ML-DSA-87)
- Classification per path (`.polyclassification`)
- LFS scatter integration
- StreamSight L2/L3 detailed traces for debugging

### Phase 4: Enterprise (Q1 2027)
- Admin console
- Compliance/retention policies
- SOVEREIGN classification (HSM)
- Migration tools (Google Drive, Dropbox, OneDrive)
- Enterprise SLA
- ESN-AI proactive ESCIR optimization recommendations
- ESN-AI capacity planning and anomaly correlation
- ESLM-powered content search (semantic search over encrypted index)

---

## Related Documents

- [ESCIR WASM Client Spec](https://github.com/polyquantum/estream-io/blob/main/specs/architecture/ESCIR_WASM_CLIENT_SPEC.md) — `.escd` pipeline and signing (estream-io [#550](https://github.com/polyquantum/estream-io/issues/550))
- [EphemeralPayload::FileShare](https://github.com/polyquantum/estream-io/issues/552) — Upstream ephemeral link variant (estream-io [#552](https://github.com/polyquantum/estream-io/issues/552))
- [Wire Protocol SDK Reconciliation](https://github.com/polyquantum/estream-io/issues/551) — SDK wire-protocol-only patterns
- [SPARK Poly Identity](https://github.com/polyquantum/estream-io/blob/main/specs/wallet/SPARK_POLY_IDENTITY.md) — SPARK derivation contexts
- [SPARK Derivation](https://github.com/polyquantum/estream-io/blob/main/specs/wallet/SPARK_DERIVATION.md) — HKDF-SHA3-256 key derivation
- [Ephemeral Links](https://github.com/polyquantum/estream-io/blob/main/packages/mobile-sdk/src/ephemeral_link.rs) — Link sharing pattern
- [Poly Messenger Architecture](https://github.com/polyquantum/polymessenger/blob/main/docs/ARCHITECTURE.md) — Reference for ESCIR circuit decomposition
- [StreamSight Intelligence](https://github.com/polyquantum/estream-io/blob/main/specs/architecture/STREAMSIGHT_INTELLIGENCE.md) — Baseline gate, discard-normal, observation levels
- [ESLM Architecture](https://github.com/polyquantum/estream-io/blob/main/docs/ESLM_ARCHITECTURE.md) — ESLM platform architecture
- [ESN-AI Spec](https://github.com/polyquantum/estream-io/blob/main/specs/intelligence/ESN_AI_SPEC.md) — Network intelligence and proactive recommendations
- [ESCIR ML Extensions](https://github.com/polyquantum/estream-io/blob/main/specs/protocol/ESCIR_ML_EXTENSIONS.md) — ESLM circuit primitives
- [ESLM Feedback Loop](https://github.com/polyquantum/estream-io/blob/main/specs/eslm/ESLM_FEEDBACK_LOOP_SPEC.md) — Human-in-the-loop, sanitization pipeline
- [ESLM Classification Inference](https://github.com/polyquantum/estream-io/blob/main/specs/eslm/ESLM_CLASSIFICATION_INFERENCE_SPEC.md) — Compliance mapping (HIPAA, PCI-DSS, GDPR)
- [Console Data Architecture](https://github.com/polyquantum/estream-io/blob/main/specs/console/CONSOLE_DATA_ARCHITECTURE.md) — SmartCircuit aggregator pattern for console widgets
- [Widget System](https://github.com/polyquantum/estream-io/blob/main/packages/sdk-browser/src/widgets/types.ts) — `registerWidget()` interface
- [polylabs/business/PRODUCT_FAMILY.md] — Product specifications
- [polyquantum/polymessenger/docs/specs/POLY_DATA_CONCEPT.md] — Original concept
