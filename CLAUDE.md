# Poly Data

Post-quantum encrypted, scatter-distributed file storage and version control built on eStream v0.8.1.

## Overview

Poly Data is a secure document store where every file is PQ-encrypted on-device, erasure-coded, and scatter-distributed across multiple providers and jurisdictions. Classification tags control scatter policy, offline access, and retention. Includes `poly-git` for scatter-distributed version control.

## Architecture

```
Client (Tauri/Mobile)
    |
    +-- SPARK Auth (ML-DSA-87 biometric)
    |
    +-- File Manager (browse, upload, download, share)
    |
    +-- poly-git (git remote helper)
    |
    v
eStream Wire Protocol (QUIC/UDP)
    |
    v
ESCIR Storage Router Circuit
    |
    +-- Classification Engine (tag assignment, policy enforcement)
    +-- Scatter Store (erasure coding, multi-provider distribution)
    +-- Sharing Circuit (link-based, ACL-based, time-limited)
    +-- Version Circuit (history, diff, rollback)
    |
    v
Scatter Storage (k-of-n across providers/jurisdictions)
```

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Storage Router | circuits/ | ESCIR circuit for file routing, classification, scatter |
| poly-git | crates/poly-git/ | Git remote helper for scatter-distributed repos |
| Core SDK | crates/poly-data-core/ | Rust core for encrypt/decrypt, chunking, classification |
| Desktop App | apps/desktop/ | Tauri-based file manager |
| Mobile App | apps/mobile/ | React Native with Rust FFI |

## Classification Tiers

| Classification | Scatter | Offline | Jurisdictions |
|---------------|---------|---------|---------------|
| PUBLIC | 2-of-3 | Yes | Any |
| INTERNAL | 3-of-5 | Yes | 2+ |
| CONFIDENTIAL | 5-of-7 | Selective | 3+ |
| RESTRICTED | 7-of-9 | No | 3+ |
| SOVEREIGN | 9-of-13 (HSM) | No | 5+ |

## No REST API

All communication uses the eStream Wire Protocol. No REST/HTTP endpoints.

## Platform

- eStream v0.8.1
- ESCIR SmartCircuits
- ML-KEM-1024, ML-DSA-87, SHA3-256
- 8-Dimension metering
- L2 multi-token payments
