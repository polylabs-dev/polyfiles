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
 * Event Bus:
 *   Listens: REVIEW_COMPLETED (refreshes feedback stats on new review)
 *            FILTER_RESET (clears highlights)
 *
 * Lex stream: polyqlabs.data.eslm.classification
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

export default function EslmFeedbackWidget() {
  const fixture = getFixture<any>('polydata-eslm-feedback');
  const reviewEvent = usePolydataEvent(POLYDATA_EVENTS.REVIEW_COMPLETED);

  const { data: liveData, status } = useStreamSubscription(
    'polyqlabs.data.eslm.classification',
    { filter: { type: 'feedback_summary' } },
  );

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
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
          <span className="value">{feedback.totalReviews.toLocaleString()}</span>
          <span className="label">Total Reviews</span>
        </div>
        <div className="stat">
          <span className="value">{feedback.avgRating.toFixed(1)}</span>
          <span className="label">Avg Rating</span>
        </div>
        <div className="stat">
          <span className="value">{feedback.corrections.toLocaleString()}</span>
          <span className="label">Corrections</span>
        </div>
        <div className="stat">
          <span className="value">+{feedback.trainingImpact.toFixed(1)}%</span>
          <span className="label">Accuracy Impact</span>
        </div>
      </div>
      {reviewEvent && (
        <div className="last-review-indicator">
          Latest: {reviewEvent.action} ({reviewEvent.classification})
        </div>
      )}
    </div>
  );
}
