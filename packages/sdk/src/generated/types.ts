/**
 * AUTO-GENERATED — Do not edit manually.
 *
 * Generated from ESCIR circuit type definitions via:
 *   estream generate typescript --circuits circuits/ --output packages/sdk/src/generated/
 *
 * Source circuits:
 *   - poly-data-encrypt (polylabs.data.encrypt)
 *   - poly-data-chunk (polylabs.data.chunk)
 *   - poly-data-classify (polylabs.data.classify)
 *   - poly-data-manifest (polylabs.data.manifest)
 *   - poly-data-eslm-classify (polylabs.data.eslm.classify)
 *   - poly-data-storage-router (polylabs.data.router)
 *   - poly-data-share (polylabs.data.share)
 *   - poly-data-version (polylabs.data.version)
 *   - poly-data-metering (polylabs.data.metering)
 */

// ─── Lex Topic Constants ─────────────────────────────────────────────────────

export const LEX_TOPICS = {
  UPLOAD: 'polylabs.data.{user_id}.upload',
  DOWNLOAD: 'polylabs.data.{user_id}.download',
  UPLOAD_CONFIRM: 'polylabs.data.{user_id}.upload.confirm',
  SHARE_ACL: 'polylabs.data.{user_id}.share.acl',
  SHARE_INCOMING: 'polylabs.data.{recipient_id}.share.incoming',
  SHARE_EPHEMERAL: 'polylabs.data.{user_id}.share.ephemeral',
  VERSION: 'polylabs.data.{user_id}.version.{file_id}',
  METERING: 'polylabs.data.metering.{user_id}',
  TELEMETRY: 'lex://estream/apps/polylabs.data/telemetry',
  TELEMETRY_SLI: 'lex://estream/apps/polylabs.data/telemetry/sli',
  BASELINE: 'lex://estream/apps/polylabs.data/metrics/baseline',
  DEVIATIONS: 'lex://estream/apps/polylabs.data/metrics/deviations',
  INCIDENTS: 'lex://estream/apps/polylabs.data/incidents',
  TRENDS: 'lex://estream/apps/polylabs.data/metrics/trends',
  SLA: 'lex://estream/apps/polylabs.data/sla',
  CAPACITY: 'lex://estream/apps/polylabs.data/capacity',
  ESLM_CLASSIFICATION: 'lex://estream/apps/polylabs.data/eslm/classification',
  ESLM_RECOMMENDATION: 'lex://estream/apps/polylabs.data/eslm/recommendation',
  ESLM_SANITIZATION: 'lex://estream/apps/polylabs.data/eslm/sanitization',
  ESLM_CAPACITY: 'lex://estream/apps/polylabs.data/eslm/capacity',
  ESLM_ANOMALY: 'lex://estream/apps/polylabs.data/eslm/anomaly',
  ESLM_SECURITY: 'lex://estream/apps/polylabs.data/eslm/security',
} as const;

// ─── ESLite Table Names ──────────────────────────────────────────────────────

export const ESLITE_TABLES = {
  FILES: '/polydata/files',
  INDEX: '/polydata/index',
  OFFLINE: '/polydata/offline',
  CLASSIFY: '/polydata/classify',
} as const;

// ─── poly-data-classify types ────────────────────────────────────────────────

export type Classification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED'
  | 'SOVEREIGN';

export interface ScatterPolicy {
  k: number;
  n: number;
  jurisdictions: number;
}

export const SCATTER_POLICIES: Record<Classification, ScatterPolicy> = {
  PUBLIC: { k: 2, n: 3, jurisdictions: 1 },
  INTERNAL: { k: 3, n: 5, jurisdictions: 2 },
  CONFIDENTIAL: { k: 5, n: 7, jurisdictions: 3 },
  RESTRICTED: { k: 7, n: 9, jurisdictions: 3 },
  SOVEREIGN: { k: 9, n: 13, jurisdictions: 5 },
};

export interface ClassificationRule {
  pattern: string;
  classification: Classification;
}

export interface ClassificationPolicy {
  rules: ClassificationRule[];
  minimumClassification?: Classification;
}

// ─── poly-data-encrypt types ─────────────────────────────────────────────────

export interface FileKey {
  bytes: Uint8Array; // 32 bytes AES-256-GCM
}

export interface WrappedFileKey {
  ciphertext: Uint8Array;
  encapsulatedKey: Uint8Array;
}

export interface EncryptedChunk {
  data: Uint8Array;
  nonce: Uint8Array; // 12 bytes
  chunkIndex: number;
}

// ─── poly-data-chunk types ───────────────────────────────────────────────────

export interface Chunk {
  index: number;
  data: Uint8Array;
  hash: Uint8Array; // SHA3-256
}

export interface Shard {
  index: number;
  data: Uint8Array;
  hash: Uint8Array;
  isOriginal: boolean;
}

// ─── poly-data-manifest types ────────────────────────────────────────────────

export interface FileId {
  bytes: Uint8Array; // 16 bytes
}

export interface ShardMap {
  shards: Array<{
    index: number;
    provider: string;
    region: string;
    hash: Uint8Array;
  }>;
}

export interface Manifest {
  fileId: FileId;
  chunkHashes: Uint8Array[];
  shardMap: ShardMap;
  classification: Classification;
  wrappedFileKey: WrappedFileKey;
  createdAt: number;
  size: number;
}

export interface SignedManifest {
  manifest: Manifest;
  signature: Uint8Array; // ML-DSA-87
  signerPublicKey: Uint8Array;
}

export interface VersionEntry {
  signedManifest: SignedManifest;
  parentVersion: Uint8Array | null; // SHA3-256 hash of parent
  versionHash: Uint8Array;
  timestamp: number;
}

// ─── poly-data-eslm-classify types ───────────────────────────────────────────

export interface ClassificationSuggestion {
  tag: Classification;
  confidence: number;
  alternatives: Array<{ tag: Classification; confidence: number }>;
}

export interface HumanFeedback {
  sampleHash: Uint8Array; // 32 bytes
  rating: number; // 1-5
  correction: Classification | null;
  reviewerHash: Uint8Array; // 32 bytes, pseudonymous
  timestamp: number;
}

// ─── poly-data-share types ───────────────────────────────────────────────────

export type FileSharePermissions = 'ViewOnly' | 'Download';

export interface AclEntry {
  user: string; // spark:did:*
  role: 'viewer' | 'editor';
  expires?: string; // ISO 8601
}

export interface FolderAcl {
  folder: string;
  acl: AclEntry[];
}

export interface EphemeralFileShare {
  fileManifestRef: Uint8Array;
  accessKeyEncrypted: Uint8Array;
  classification: Classification;
  permissions: FileSharePermissions;
  ownerSparkDid: string;
  createdAt: number;
  expiresAt: number;
}

// ─── poly-data-metering types ────────────────────────────────────────────────

export type MeteringDimension = 'E' | 'H' | 'B' | 'S' | 'O' | 'P' | 'C' | 'M';

export interface MeteringRecord {
  userId: Uint8Array;
  operation: string;
  dimensions: Partial<Record<MeteringDimension, number>>;
  timestamp: number;
}

// ─── poly-data-storage-router FSM states ─────────────────────────────────────

export type StorageRouterState =
  | 'uploading'
  | 'scattering'
  | 'retry'
  | 'stored'
  | 'shared'
  | 'versioned'
  | 'purging'
  | 'purged'
  | 'failed';

export type ShareState =
  | 'pending'
  | 'validating'
  | 'active'
  | 'revoked'
  | 'rejected';

// ─── StreamSight telemetry types ─────────────────────────────────────────────

export interface PolydataTelemetryMetrics {
  'polydata.upload.latency_ns': number;
  'polydata.download.latency_ns': number;
  'polydata.scatter.duration_ns': number;
  'polydata.encrypt.chunk_ns': number;
  'polydata.erasure.encode_ns': number;
  'polydata.uploads_total': number;
  'polydata.downloads_total': number;
  'polydata.shares_total': number;
  'polydata.classify.changes_total': number;
  'polydata.offline.sync_total': number;
  'polydata.ephemeral.created_total': number;
  'polydata.shard.failure_total': number;
}

export interface Deviation {
  timestamp: number;
  metric: keyof PolydataTelemetryMetrics;
  circuit: string;
  zScore: number;
  observed: number;
  baseline: number;
  severity: 'deviation' | 'anomaly';
}

// ─── ESN-AI recommendation types ─────────────────────────────────────────────

export type RecommendationCategory =
  | 'circuit_optimization'
  | 'capacity_planning'
  | 'anomaly_correlation'
  | 'security';

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  circuit?: string;
  metric?: string;
  impact: 'low' | 'medium' | 'high';
  timestamp: number;
}

// ─── Sanitization types ──────────────────────────────────────────────────────

export type SanitizationStage = 'pii_detect' | 'value_transform' | 'audit_record';

export interface SanitizationEntry {
  timestamp: number;
  stage: SanitizationStage;
  fieldPath: string;
  originalType: string;
  placeholder: string;
  regulation: string[];
  witnessHash: string;
}

// ─── Console widget RBAC roles ───────────────────────────────────────────────

export type PolydataRole = 'polydata-operator' | 'polydata-viewer' | 'polydata-compliance';
