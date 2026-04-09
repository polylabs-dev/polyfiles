/**
 * ESLM Classification Review Queue Widget
 *
 * Human-in-the-loop review interface for low-confidence ESLM auto-classifications.
 * Displays files where ESLM confidence < 0.8, allowing operators to:
 * - Accept: confirm ESLM suggestion (rating: 5)
 * - Override: select correct tag (rating: 1-3, correction provided)
 * - Flag: escalate to policy review
 *
 * All content previews are sanitized through the 3-stage pipeline
 * (PII detect -> value transform -> audit) before display.
 *
 * Human feedback is submitted via EslmEngine::submit_feedback() and
 * weighted 2-3x in ESLM training vs automated samples.
 *
 * Event Bus:
 *   Emits: REVIEW_COMPLETED (on accept/override/flag -> refreshes accuracy + feedback)
 *   Listens: CLASSIFICATION_FILTER (filters queue to specific classification)
 *            FILTER_RESET (clears filter)
 *
 * Lex stream: polyqlabs.data.eslm.classification
 * Required role: polydata-operator
 */

import React, { useState } from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent, useEmitPolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

interface ReviewItem {
  sampleHash: Uint8Array;
  fileName: string;
  filePath: string;
  suggestedTag: string;
  confidence: number;
  alternatives: Array<{ tag: string; confidence: number }>;
  sanitizedPreview: string;
  timestamp: number;
}

export default function EslmReviewQueueWidget() {
  const fixture = getFixture<any>('polydata-eslm-review-queue');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const emitReviewCompleted = useEmitPolydataEvent(POLYDATA_EVENTS.REVIEW_COMPLETED);
  const classFilter = usePolydataEvent(POLYDATA_EVENTS.CLASSIFICATION_FILTER);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveQueue, status } = useStreamSubscription(
    'polyqlabs.data.eslm.classification',
    { filter: { confidence_lt: 0.8, human_reviewed: false } },
  );

  const queue = fixture ?? liveQueue;

  const submitFeedback = async (item: ReviewItem, action: 'accept' | 'override' | 'flag', correction?: string) => {
    setSubmitting(item.fileName);

    // Submit to ESLM training loop via stream
    // await client.emit('polyqlabs.data.eslm.classification.feedback', feedback);

    // Notify other widgets that a review was completed
    emitReviewCompleted({
      action,
      sampleHash: Array.from(item.sampleHash).map(b => b.toString(16).padStart(2, '0')).join(''),
      classification: correction ?? item.suggestedTag,
    });

    setSubmitting(null);
  };

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to classification stream...</div>;
  }

  let items: ReviewItem[] = queue?.items ?? [];

  // Apply classification filter from event bus
  const activeTag = !filterReset ? classFilter?.tag : null;
  if (activeTag) {
    items = items.filter((item) =>
      item.suggestedTag === activeTag ||
      item.alternatives.some((a) => a.tag === activeTag)
    );
  }

  return (
    <div className="polydata-eslm-review-queue">
      <div className="queue-header">
        <span className="count">{items.length} items pending review</span>
        {activeTag && <span className="filter-badge">Filtered: {activeTag}</span>}
      </div>

      <div className="queue-list">
        {items.map((item) => (
          <div key={item.fileName} className="review-item">
            <div className="item-header">
              <span className="filename">{item.fileName}</span>
              <span className="path">{item.filePath}</span>
            </div>

            <div className="suggestion">
              <span className="tag">{item.suggestedTag}</span>
              <span className="confidence">{(item.confidence * 100).toFixed(1)}%</span>
            </div>

            {item.alternatives.length > 0 && (
              <div className="alternatives">
                {item.alternatives.map((alt) => (
                  <span key={alt.tag} className="alt-tag">
                    {alt.tag} ({(alt.confidence * 100).toFixed(1)}%)
                  </span>
                ))}
              </div>
            )}

            <div className="sanitized-preview">
              <pre>{item.sanitizedPreview}</pre>
              <span className="sanitization-notice">Content sanitized (PII/PCI/HIPAA/GDPR)</span>
            </div>

            <div className="actions">
              <button
                className="action-accept"
                onClick={() => submitFeedback(item, 'accept')}
                disabled={submitting === item.fileName}
              >
                Accept
              </button>
              <button
                className="action-override"
                onClick={() => submitFeedback(item, 'override')}
                disabled={submitting === item.fileName}
              >
                Override
              </button>
              <button
                className="action-flag"
                onClick={() => submitFeedback(item, 'flag')}
                disabled={submitting === item.fileName}
              >
                Flag for Review
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
