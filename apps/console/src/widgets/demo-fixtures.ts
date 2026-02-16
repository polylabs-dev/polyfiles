/**
 * Poly Data Console Widget Demo Fixtures
 *
 * Provides realistic mock data for all 11 widgets when running in demo mode.
 * Activated via `?demo=true` query parameter in the Console URL.
 *
 * Uses ESZ (eStream Zero-data) fixture format from estream-io #555 DX improvements.
 *
 * @see https://github.com/polyquantum/estream-io/issues/555
 */

// ─── Demo Mode Detection ─────────────────────────────────────────────────────

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === 'true';
}

// ─── Upload Latency Fixture ──────────────────────────────────────────────────

export const uploadLatencyFixture = {
  encrypt_ns: 1_240_000,
  erasure_ns: 3_870_000,
  scatter_ns: 12_450_000,
  total_ns: 17_560_000,
};

// ─── Scatter Health Fixture ──────────────────────────────────────────────────

export const scatterHealthFixture = {
  providers: [
    { name: 'AWS S3', region: 'us-east-1', status: 'healthy' as const, latencyP50Ms: 12, latencyP99Ms: 45, shardCount: 14_200, failureRate: 0.0001 },
    { name: 'AWS S3', region: 'eu-west-1', status: 'healthy' as const, latencyP50Ms: 18, latencyP99Ms: 62, shardCount: 11_800, failureRate: 0.0002 },
    { name: 'GCP Storage', region: 'us-central1', status: 'healthy' as const, latencyP50Ms: 14, latencyP99Ms: 51, shardCount: 9_400, failureRate: 0.0001 },
    { name: 'Azure Blob', region: 'westeurope', status: 'degraded' as const, latencyP50Ms: 42, latencyP99Ms: 180, shardCount: 7_600, failureRate: 0.012 },
    { name: 'Cloudflare R2', region: 'global', status: 'healthy' as const, latencyP50Ms: 8, latencyP99Ms: 28, shardCount: 16_500, failureRate: 0.00005 },
    { name: 'Hetzner', region: 'fsn1', status: 'healthy' as const, latencyP50Ms: 22, latencyP99Ms: 78, shardCount: 5_100, failureRate: 0.0003 },
  ],
};

// ─── Classification Distribution Fixture ─────────────────────────────────────

export const classificationDistFixture = {
  distribution: {
    PUBLIC: 1_247,
    INTERNAL: 3_891,
    CONFIDENTIAL: 2_156,
    RESTRICTED: 487,
    SOVEREIGN: 23,
  },
};

// ─── Deviation Feed Fixture ──────────────────────────────────────────────────

const now = Date.now();

export const deviationFeedFixture = {
  deviations: [
    { timestamp: now - 120_000, metric: 'polydata.scatter.duration_ns', circuit: 'poly-data-storage-router', zScore: 3.2, observed: 28_400_000, baseline: 12_500_000, severity: 'anomaly' as const },
    { timestamp: now - 340_000, metric: 'polydata.encrypt.chunk_ns', circuit: 'poly-data-encrypt', zScore: 2.1, observed: 2_100_000, baseline: 1_240_000, severity: 'deviation' as const },
    { timestamp: now - 560_000, metric: 'polydata.upload.latency_ns', circuit: 'poly-data-manifest', zScore: 2.8, observed: 24_000_000, baseline: 17_560_000, severity: 'deviation' as const },
    { timestamp: now - 900_000, metric: 'polydata.shard.failure_total', circuit: 'poly-data-storage-router', zScore: 4.1, observed: 12, baseline: 1, severity: 'anomaly' as const },
    { timestamp: now - 1_200_000, metric: 'polydata.downloads_total', circuit: 'poly-data-storage-router', zScore: 1.9, observed: 450, baseline: 280, severity: 'deviation' as const },
  ],
};

// ─── Shard Failures Fixture ──────────────────────────────────────────────────

export const shardFailuresFixture = {
  failures: {
    total: 17,
    byProvider: {
      'Azure Blob (westeurope)': 12,
      'Hetzner (fsn1)': 3,
      'AWS S3 (us-east-1)': 2,
    },
    affectedFiles: 4,
  },
};

// ─── Capacity Forecast Fixture ───────────────────────────────────────────────

export const capacityForecastFixture = {
  tiers: [
    { classification: 'PUBLIC', usagePercent: 34.2, daysUntilLimit: 180 },
    { classification: 'INTERNAL', usagePercent: 61.7, daysUntilLimit: 92 },
    { classification: 'CONFIDENTIAL', usagePercent: 78.3, daysUntilLimit: 41 },
    { classification: 'RESTRICTED', usagePercent: 45.1, daysUntilLimit: 156 },
    { classification: 'SOVEREIGN', usagePercent: 12.0, daysUntilLimit: 365 },
  ],
};

// ─── ESLM Classification Accuracy Fixture ────────────────────────────────────

export const eslmClassifyAccuracyFixture = {
  accuracy: {
    total: 2_847,
    accepted: 2_491,
    overridden: 298,
    flagged: 58,
    avgConfidence: 0.87,
  },
};

// ─── ESLM Review Queue Fixture ───────────────────────────────────────────────

export const eslmReviewQueueFixture = {
  items: [
    {
      sampleHash: new Uint8Array(32),
      fileName: 'quarterly-financials-2026-Q1.xlsx',
      filePath: '/finance/reports/',
      suggestedTag: 'CONFIDENTIAL',
      confidence: 0.62,
      alternatives: [
        { tag: 'RESTRICTED', confidence: 0.28 },
        { tag: 'INTERNAL', confidence: 0.10 },
      ],
      sanitizedPreview: 'Revenue: [REDACTED_CURRENCY]\nMargin: [REDACTED_PERCENT]\nProjection: [REDACTED_VALUE]',
      timestamp: now - 300_000,
    },
    {
      sampleHash: new Uint8Array(32),
      fileName: 'employee-directory.csv',
      filePath: '/hr/people/',
      suggestedTag: 'RESTRICTED',
      confidence: 0.71,
      alternatives: [
        { tag: 'CONFIDENTIAL', confidence: 0.22 },
        { tag: 'SOVEREIGN', confidence: 0.07 },
      ],
      sanitizedPreview: 'Name: [PII_NAME]\nSSN: [PII_SSN]\nEmail: [PII_EMAIL]\nSalary: [REDACTED_CURRENCY]',
      timestamp: now - 600_000,
    },
    {
      sampleHash: new Uint8Array(32),
      fileName: 'product-roadmap-2026.md',
      filePath: '/product/plans/',
      suggestedTag: 'INTERNAL',
      confidence: 0.55,
      alternatives: [
        { tag: 'CONFIDENTIAL', confidence: 0.35 },
        { tag: 'PUBLIC', confidence: 0.10 },
      ],
      sanitizedPreview: 'Q2 Launch: [REDACTED_PRODUCT]\nPartner: [REDACTED_ORG]\nTarget: [REDACTED_METRIC]',
      timestamp: now - 900_000,
    },
  ],
};

// ─── ESLM Feedback Fixture ───────────────────────────────────────────────────

export const eslmFeedbackFixture = {
  feedback: {
    totalReviews: 356,
    avgRating: 4.1,
    corrections: 58,
    trainingImpact: 8.3,
  },
};

// ─── ESN-AI Recommendations Fixture ──────────────────────────────────────────

export const esnAiRecommendationsFixture = {
  items: [
    {
      id: 'rec-001',
      category: 'circuit_optimization' as const,
      title: 'Reduce poly-data-encrypt chunk size for small files',
      description: 'Files under 64KB are using the default 256KB chunk size, causing unnecessary overhead. Recommend adaptive chunk sizing based on file size.',
      circuit: 'poly-data-encrypt',
      metric: 'polydata.encrypt.chunk_ns',
      impact: 'medium' as const,
      timestamp: now - 3_600_000,
    },
    {
      id: 'rec-002',
      category: 'capacity_planning' as const,
      title: 'CONFIDENTIAL tier approaching storage limit',
      description: 'At current growth rate, CONFIDENTIAL tier will reach 90% capacity in 28 days. Consider adding scatter providers or archiving old files.',
      impact: 'high' as const,
      timestamp: now - 7_200_000,
    },
    {
      id: 'rec-003',
      category: 'anomaly_correlation' as const,
      title: 'Azure westeurope shard failures correlate with latency spike',
      description: 'Shard failures on Azure westeurope region correlate with scatter duration anomaly detected 2 hours ago. Potential regional degradation.',
      circuit: 'poly-data-storage-router',
      metric: 'polydata.shard.failure_total',
      impact: 'high' as const,
      timestamp: now - 1_800_000,
    },
    {
      id: 'rec-004',
      category: 'security' as const,
      title: 'Unusual download pattern from RESTRICTED tier',
      description: 'A SPARK identity is downloading RESTRICTED files at 3x the normal rate. Pattern does not match known batch operations.',
      impact: 'high' as const,
      timestamp: now - 900_000,
    },
  ],
};

// ─── Sanitization Log Fixture ────────────────────────────────────────────────

export const eslmSanitizationLogFixture = {
  entries: [
    { timestamp: now - 60_000, stage: 'pii_detect' as const, fieldPath: 'content.row[2].ssn', originalType: 'SSN', placeholder: '[PII_SSN]', regulation: ['HIPAA', 'GDPR'], witnessHash: 'a3f2c891d4e5' },
    { timestamp: now - 60_000, stage: 'value_transform' as const, fieldPath: 'content.row[2].ssn', originalType: 'SSN', placeholder: '***-**-7890', regulation: ['HIPAA'], witnessHash: 'a3f2c891d4e5' },
    { timestamp: now - 60_000, stage: 'audit_record' as const, fieldPath: 'content.row[2].ssn', originalType: 'SSN', placeholder: '[AUDIT_REF:0x3f2c]', regulation: ['HIPAA', 'SOC2'], witnessHash: 'a3f2c891d4e5' },
    { timestamp: now - 120_000, stage: 'pii_detect' as const, fieldPath: 'content.cell[B4]', originalType: 'Credit Card', placeholder: '[PCI_PAN]', regulation: ['PCI-DSS'], witnessHash: 'b7e1a024f9c3' },
    { timestamp: now - 120_000, stage: 'value_transform' as const, fieldPath: 'content.cell[B4]', originalType: 'Credit Card', placeholder: '****-****-****-1234', regulation: ['PCI-DSS'], witnessHash: 'b7e1a024f9c3' },
    { timestamp: now - 120_000, stage: 'audit_record' as const, fieldPath: 'content.cell[B4]', originalType: 'Credit Card', placeholder: '[AUDIT_REF:0x7e1a]', regulation: ['PCI-DSS', 'SOC2'], witnessHash: 'b7e1a024f9c3' },
    { timestamp: now - 300_000, stage: 'pii_detect' as const, fieldPath: 'metadata.author', originalType: 'Personal Name', placeholder: '[PII_NAME]', regulation: ['GDPR'], witnessHash: 'c9d4b2e7f001' },
    { timestamp: now - 300_000, stage: 'value_transform' as const, fieldPath: 'metadata.author', originalType: 'Personal Name', placeholder: 'User_8a2f', regulation: ['GDPR'], witnessHash: 'c9d4b2e7f001' },
  ],
};

// ─── Fixture Registry ────────────────────────────────────────────────────────

export type WidgetFixtureId =
  | 'polydata-upload-latency'
  | 'polydata-scatter-health'
  | 'polydata-classification-dist'
  | 'polydata-deviation-feed'
  | 'polydata-shard-failures'
  | 'polydata-capacity-forecast'
  | 'polydata-eslm-classify-accuracy'
  | 'polydata-eslm-review-queue'
  | 'polydata-eslm-feedback'
  | 'polydata-esn-ai-recommendations'
  | 'polydata-eslm-sanitization-log';

export const FIXTURES: Record<WidgetFixtureId, unknown> = {
  'polydata-upload-latency': uploadLatencyFixture,
  'polydata-scatter-health': scatterHealthFixture,
  'polydata-classification-dist': classificationDistFixture,
  'polydata-deviation-feed': deviationFeedFixture,
  'polydata-shard-failures': shardFailuresFixture,
  'polydata-capacity-forecast': capacityForecastFixture,
  'polydata-eslm-classify-accuracy': eslmClassifyAccuracyFixture,
  'polydata-eslm-review-queue': eslmReviewQueueFixture,
  'polydata-eslm-feedback': eslmFeedbackFixture,
  'polydata-esn-ai-recommendations': esnAiRecommendationsFixture,
  'polydata-eslm-sanitization-log': eslmSanitizationLogFixture,
};

/**
 * Hook-compatible: returns fixture data for a widget ID, or null if not in demo mode.
 */
export function getFixture<T = unknown>(widgetId: WidgetFixtureId): T | null {
  if (!isDemoMode()) return null;
  return (FIXTURES[widgetId] as T) ?? null;
}
