/**
 * ESLM Classification Accuracy Widget
 *
 * Shows auto-classification accuracy metrics: accepted vs overridden
 * suggestions, confidence distribution histogram, and accuracy trend
 * over time as human feedback improves the model.
 *
 * Lex stream: polylabs.data.eslm.classification
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

export default function EslmClassifyAccuracyWidget() {
  const { data, status } = useStreamSubscription(
    'polylabs.data.eslm.classification',
    { filter: { type: 'accuracy_summary' } },
  );

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to classification stream...</div>;
  }

  const stats = data?.accuracy ?? {
    total: 0,
    accepted: 0,
    overridden: 0,
    flagged: 0,
    avgConfidence: 0,
  };

  const acceptRate = stats.total > 0 ? ((stats.accepted / stats.total) * 100).toFixed(1) : '—';

  return (
    <div className="polydata-eslm-accuracy">
      <div className="accuracy-summary">
        <div className="stat primary">
          <span className="value">{acceptRate}%</span>
          <span className="label">Accept Rate</span>
        </div>
        <div className="stat">
          <span className="value">{stats.accepted}</span>
          <span className="label">Accepted</span>
        </div>
        <div className="stat">
          <span className="value">{stats.overridden}</span>
          <span className="label">Overridden</span>
        </div>
        <div className="stat">
          <span className="value">{stats.flagged}</span>
          <span className="label">Flagged</span>
        </div>
        <div className="stat">
          <span className="value">{(stats.avgConfidence * 100).toFixed(0)}%</span>
          <span className="label">Avg Confidence</span>
        </div>
      </div>
    </div>
  );
}
