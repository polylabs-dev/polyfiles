# Q Files

Scatter-distributed encrypted storage built on eStream v0.22.0. 100% FastLang. No hand-written Rust.

## Overview

Q Files is a scatter-distributed encrypted storage platform where every file is PQ-encrypted on-device, erasure-coded, and distributed across multiple providers and jurisdictions. Classification tags control scatter policy, offline access, and retention.

> **Note**: Git/version-control functionality has been split into a separate product: **Q Git** (`qgit/`). Q Files focuses on file storage, collaboration, and enterprise document management.

## Architecture

```
Client (Tauri/Mobile)
    |
    +-- SPARK Auth (ML-DSA-87 biometric)
    |
    +-- File Manager (browse, upload, download, share)
    |
    v
eStream Wire Protocol (QUIC/UDP)
    |
    v
FLIR Storage Router Circuit
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
| Storage Router | circuits/ | FLIR circuit for file routing, classification, scatter |
| Desktop App | apps/desktop/ | Tauri-based file manager |
| Mobile App | apps/mobile/ | React Native with Rust FFI |

> **Note**: `crates/` is legacy scaffolding superseded by FLIR codegen. All logic lives in FastLang circuits.

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

- eStream v0.22.0
- FLIR SmartCircuits (FastLang → FLIR → Rust/WASM)
- ML-KEM-1024, ML-DSA-87, SHA3-256
- 8-Dimension metering
- L2 multi-token payments

## Commit Convention

Commit to the GitHub issue or epic the work was done under.
