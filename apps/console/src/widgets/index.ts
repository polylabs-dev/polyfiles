/**
 * Poly Data Console Widgets
 *
 * Registers all Poly Data widgets with the eStream Console widget system.
 * Widgets subscribe to polyqlabs.data.* lex streams via WidgetDataGateway
 * with RBAC enforcement.
 *
 * Cross-Widget Communication (Widget Event Bus):
 *   All widgets use the polydata.* event bus namespace for drill-down,
 *   filter propagation, and selection sync. See ./event-bus.ts for types.
 *
 * Demo Mode:
 *   Add ?demo=true to Console URL to use ESZ demo fixtures.
 *   See ./demo-fixtures.ts for realistic mock data.
 *
 * @see https://github.com/polylabs-dev/polydata/issues/5
 * @see https://github.com/polyquantum/estream-io/issues/555 (Widget Event Bus, ESZ fixtures)
 */

import { lazy } from 'react';
import { registerWidget } from '@estream/sdk-browser/widgets';

// ─── StreamSight Dashboard Widgets (Observability) ───────────────────────────

registerWidget({
  id: 'polydata-upload-latency',
  title: 'Poly Data: Upload Latency',
  category: 'observability',
  component: lazy(() => import('./observability/UploadLatencyWidget')),
  defaultSize: { cols: 6, rows: 3 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-viewer', 'polydata-operator'],
  lexStreams: ['polyqlabs.data.telemetry/**'],
});

registerWidget({
  id: 'polydata-scatter-health',
  title: 'Poly Data: Scatter Provider Health',
  category: 'observability',
  component: lazy(() => import('./observability/ScatterHealthWidget')),
  defaultSize: { cols: 6, rows: 3 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-viewer', 'polydata-operator'],
  lexStreams: ['polyqlabs.data.telemetry/**'],
});

registerWidget({
  id: 'polydata-classification-dist',
  title: 'Poly Data: Classification Distribution',
  category: 'observability',
  component: lazy(() => import('./observability/ClassificationDistWidget')),
  defaultSize: { cols: 4, rows: 3 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-viewer', 'polydata-operator'],
  lexStreams: ['polyqlabs.data.telemetry/**'],
});

registerWidget({
  id: 'polydata-deviation-feed',
  title: 'Poly Data: Deviation Feed',
  category: 'observability',
  component: lazy(() => import('./observability/DeviationFeedWidget')),
  defaultSize: { cols: 12, rows: 4 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-operator'],
  lexStreams: ['polyqlabs.data.metrics.deviations/**'],
});

registerWidget({
  id: 'polydata-shard-failures',
  title: 'Poly Data: Shard Failures',
  category: 'observability',
  component: lazy(() => import('./observability/ShardFailuresWidget')),
  defaultSize: { cols: 6, rows: 3 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-operator'],
  lexStreams: ['polyqlabs.data.telemetry/**'],
});

registerWidget({
  id: 'polydata-capacity-forecast',
  title: 'Poly Data: Capacity Forecast',
  category: 'observability',
  component: lazy(() => import('./observability/CapacityForecastWidget')),
  defaultSize: { cols: 6, rows: 3 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-operator'],
  lexStreams: ['polyqlabs.data.capacity/**'],
});

// ─── ESLM Management Widgets (Governance) ────────────────────────────────────

registerWidget({
  id: 'polydata-eslm-classify-accuracy',
  title: 'Poly Data: Classification Accuracy',
  category: 'governance',
  component: lazy(() => import('./governance/EslmClassifyAccuracyWidget')),
  defaultSize: { cols: 6, rows: 3 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-operator'],
  lexStreams: ['polyqlabs.data.eslm.classification/**'],
});

registerWidget({
  id: 'polydata-eslm-review-queue',
  title: 'Poly Data: Classification Review Queue',
  category: 'governance',
  component: lazy(() => import('./governance/EslmReviewQueueWidget')),
  defaultSize: { cols: 12, rows: 4 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-operator'],
  lexStreams: ['polyqlabs.data.eslm.classification/**'],
});

registerWidget({
  id: 'polydata-eslm-feedback',
  title: 'Poly Data: ESLM Training Feedback',
  category: 'governance',
  component: lazy(() => import('./governance/EslmFeedbackWidget')),
  defaultSize: { cols: 6, rows: 3 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-operator'],
  lexStreams: ['polyqlabs.data.eslm.classification/**'],
});

registerWidget({
  id: 'polydata-esn-ai-recommendations',
  title: 'Poly Data: ESN-AI Recommendations',
  category: 'governance',
  component: lazy(() => import('./governance/EsnAiRecommendationsWidget')),
  defaultSize: { cols: 12, rows: 4 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-operator'],
  lexStreams: ['polyqlabs.data.eslm.recommendation/**'],
});

registerWidget({
  id: 'polydata-eslm-sanitization-log',
  title: 'Poly Data: Sanitization Audit Log',
  category: 'governance',
  component: lazy(() => import('./governance/EslmSanitizationLogWidget')),
  defaultSize: { cols: 12, rows: 3 },
  dataSource: 'subscription',
  requiredRoles: ['polydata-compliance', 'polydata-operator'],
  lexStreams: ['polyqlabs.data.eslm.sanitization/**'],
});
