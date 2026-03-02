# Poly Files — GitHub Issues

> **GitHub org**: [polylabs-dev](https://github.com/polylabs-dev) | **Repo**: [polylabs-dev/polyfiles](https://github.com/polylabs-dev/polyfiles)
> **Architecture**: [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
> **Note**: poly-git issues (#023-#028) have been migrated to the [Poly Git repo](../../../polygit/.github/issues/README.md).

## Epic 01: Phase 1 — Core Storage (Q2 2026) — [#1](https://github.com/polylabs-dev/polyfiles/issues/1)

| # | Issue | Status | Priority |
|---|-------|--------|----------|
| 001 | Scaffold ESCIR client circuits (`poly-data-encrypt`, `poly-data-chunk`, `poly-data-classify`, `poly-data-manifest`) | Open | P0 |
| 002 | SPARK identity integration (`poly-data-v1` HKDF context, wire auth 0x50-0x54) | Open | P0 |
| 003 | Key hierarchy: SPARK → ML-DSA-87 signing + ML-KEM-1024 encryption → per-file AES-256-GCM | Open | P0 |
| 004 | `.escd` WASM packaging (ML-DSA-87 signed, ≤128 KB/circuit, ≤512 KB bundle) | Open | P0 |
| 005 | File upload flow (classify → encrypt → chunk → manifest → scatter) | Open | P0 |
| 006 | File download flow (collect → reassemble → decrypt → verify) | Open | P0 |
| 007 | Classification tags: PUBLIC through SOVEREIGN (manual + inherited) | Open | P0 |
| 008 | `poly-data-storage-router` server circuit (scatter 3-of-5) | Open | P0 |
| 009 | ESLite client-side state (`/polyfiles/files/*`, `/polyfiles/index/*`, `/polyfiles/offline/*`) | Open | P0 |
| 010 | Tauri desktop app using `@estream/sdk-browser` (wire-protocol-only) | Open | P0 |
| 011 | StreamSight L0 metrics on all circuits | Open | P0 |
| 012 | StreamSight baseline gate integration | Open | P0 |
| 013 | `poly-data-metering` server circuit (8-dimension) | Open | P1 |

## Epic 02: Phase 2 — Collaboration (Q3 2026) — [#2](https://github.com/polylabs-dev/polyfiles/issues/2)

| # | Issue | Status | Priority |
|---|-------|--------|----------|
| 014 | ACL-based sharing via SPARK DIDs on streams (`poly-data-share` circuit) | Open | P0 |
| 015 | Ephemeral link file sharing (upstream: [estream-io #552](https://github.com/polyquantum/estream-io/issues/552)) | Open | P0 |
| 016 | `poly-data-version` server circuit (hash chain, manifest storage) | Open | P0 |
| 017 | Selective offline sync (ESLite, classification-gated) | Open | P1 |
| 018 | Mobile app using `@estream/react-native` | Open | P1 |
| 019 | Client-side encrypted search index | Open | P1 |
| 020 | StreamSight L1 events (share ops, classification changes) | Open | P0 |
| 021 | ESLM auto-classification circuit (`poly-data-eslm-classify`) | Open | P0 |
| 022 | `.polyclassification` file support | Open | P1 |

## Epic 03: Phase 3 — Enterprise (Q1 2027) — [#4](https://github.com/polylabs-dev/polyfiles/issues/4)

> poly-git issues (#023-#028) migrated to [polygit/.github/issues/README.md](../../../polygit/.github/issues/README.md)


| # | Issue | Status | Priority |
|---|-------|--------|----------|
| 029 | Admin console | Open | P1 |
| 030 | Compliance/retention policies (GDPR, HIPAA, PCI-DSS via lex) | Open | P1 |
| 031 | SOVEREIGN classification with HSM (Poly Vault) | Open | P2 |
| 032 | Migration tools (Google Drive, Dropbox, OneDrive) | Open | P1 |
| 033 | Enterprise SLA with StreamSight tracking | Open | P1 |
| 034 | ESN-AI proactive ESCIR optimization recommendations | Open | P1 |
| 035 | ESN-AI capacity planning and anomaly correlation | Open | P1 |
| 036 | ESLM-powered semantic search | Open | P2 |

## Epic 04: Console Widgets — [#5](https://github.com/polylabs-dev/polyfiles/issues/5)

| # | Issue | Status | Priority |
|---|-------|--------|----------|
| 037 | StreamSight dashboard widgets (6 widgets: latency, scatter health, classification, deviations, failures, capacity) | Open | P0 |
| 038 | ESLM management widgets (5 widgets: accuracy, review queue, feedback, ESN-AI recommendations, sanitization log) | Open | P0 |
| 039 | Human-in-the-loop review queue (accept/override/flag low-confidence classifications) | Open | P0 |
| 040 | 3-stage sanitization pipeline integration (PII detect → value transform → audit) | Open | P0 |
| 041 | RBAC: `polyfiles-operator`, `polyfiles-viewer`, `polyfiles-compliance` roles | Open | P1 |
| 042 | Widget theming per eStream design system | Open | P1 |

## Upstream Dependencies

| Issue | Repo | Description | Status |
|-------|------|-------------|--------|
| [#550](https://github.com/polyquantum/estream-io/issues/550) | estream-io | ESCIR → WASM Client Build (`.escd` pipeline) | Closed |
| [#551](https://github.com/polyquantum/estream-io/issues/551) | estream-io | Wire Protocol SDK Reconciliation | Closed |
| [#552](https://github.com/polyquantum/estream-io/issues/552) | estream-io | EphemeralPayload::FileShare variant | Open |
