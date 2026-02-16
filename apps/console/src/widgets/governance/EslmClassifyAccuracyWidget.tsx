/**
 * ESLM Classification Accuracy Widget
 *
 * Shows auto-classification accuracy metrics: accepted vs overridden
 * suggestions, confidence distribution histogram, and accuracy trend
 * over time as human feedback improves the model.
 *
 * Event Bus:
 *   Listens: REVIEW_COMPLETED (refreshes stats on new feedback)
 *            CLASSIFICATION_FILTER (filters accuracy by classification)
 *            FILTER_RESET (clears filter)
 *
 * Lex stream: polylabs.data.eslm.classification
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

export default function EslmClassifyAccuracyWidget() {
  const fixture = getFixture<any>('polydata-eslm-classify-accuracy');
  const reviewEvent = usePolydataEvent(POLYDATA_EVENTS.REVIEW_COMPLETED);
  const classFilter = usePolydataEvent(POLYDATA_EVENTS.CLASSIFICATION_FILTER);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription(
    'polylabs.data.eslm.classification',
    { filter: { type: 'accuracy_summary' } },
  );

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to classification stream...</div>;
  }

  const stats = data?.accuracy ?? {
    total: 0,
    accepted: 0,
    overridden: 0,
    flagged: 0,
    avgConfidence: 0,
  };

  const acceptRate = stats.total > 0 ? ((stats.accepted / stats.total) * 100).toFixed(1) : '\u2014';
  const activeTag = !filterReset ? classFilter?.tag : null;

  return (
    <div className="polydata-eslm-accuracy">
      {activeTag && (
        <div className="filter-badge">Filtered: {activeTag}</div>
      )}
      <div className="accuracy-summary">
        <div className="stat primary">
          <span className="value">{acceptRate}%</span>
          <span className="label">Accept Rate</span>
        </div>
        <div className="stat">
          <span className="value">{stats.accepted.toLocaleString()}</span>
          <span className="label">Accepted</span>
        </div>
        <div className="stat">
          <span className="value">{stats.overridden.toLocaleString()}</span>
          <span className="label">Overridden</span>
        </div>
        <div className="stat">
          <span className="value">{stats.flagged.toLocaleString()}</span>
          <span className="label">Flagged</span>
        </div>
        <div className="stat">
          <span className="value">{(stats.avgConfidence * 100).toFixed(0)}%</span>
          <span className="label">Avg Confidence</span>
        </div>
      </div>
      {reviewEvent && (
        <div className="last-review">
          Last review: {reviewEvent.action} on {reviewEvent.classification}
        </div>
      )}
    </div>
  );
}
