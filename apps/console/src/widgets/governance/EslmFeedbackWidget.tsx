/**
 * ESLM Training Feedback Widget
 *
 * Visualizes the impact of human-in-the-loop feedback on ESLM training:
 * human ratings, corrections submitted, training weight impact, and
 * accuracy improvement trend over time.
 *
 * Human-reviewed samples receive 2-3x weight in training:
 *   weight = 2.0 + (rating - 3.0) * 0.5  (range: 1.0 to 3.0)
 *
 * Lex stream: polylabs.data.eslm.classification
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

export default function EslmFeedbackWidget() {
  const { data, status } = useStreamSubscription(
    'polylabs.data.eslm.classification',
    { filter: { type: 'feedback_summary' } },
  );

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to feedback stream...</div>;
  }

  const feedback = data?.feedback ?? {
    totalReviews: 0,
    avgRating: 0,
    corrections: 0,
    trainingImpact: 0,
  };

  return (
    <div className="polydata-eslm-feedback">
      <div className="feedback-summary">
        <div className="stat">
          <span className="value">{feedback.totalReviews}</span>
          <span className="label">Total Reviews</span>
        </div>
        <div className="stat">
          <span className="value">{feedback.avgRating.toFixed(1)}</span>
          <span className="label">Avg Rating</span>
        </div>
        <div className="stat">
          <span className="value">{feedback.corrections}</span>
          <span className="label">Corrections</span>
        </div>
        <div className="stat">
          <span className="value">+{feedback.trainingImpact.toFixed(1)}%</span>
          <span className="label">Accuracy Impact</span>
        </div>
      </div>
    </div>
  );
}
