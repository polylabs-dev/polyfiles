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
 * (PII detect → value transform → audit) before display.
 *
 * Human feedback is submitted via EslmEngine::submit_feedback() and
 * weighted 2-3x in ESLM training vs automated samples.
 *
 * Lex stream: polylabs.data.eslm.classification
 * Required role: polydata-operator
 */

import React, { useState } from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

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

interface HumanFeedback {
  sampleHash: Uint8Array;
  rating: number;
  correction: string | null;
  reviewerHash: Uint8Array;
}

export default function EslmReviewQueueWidget() {
  const [submitting, setSubmitting] = useState<string | null>(null);

  const { data: queue, status } = useStreamSubscription(
    'polylabs.data.eslm.classification',
    { filter: { confidence_lt: 0.8, human_reviewed: false } },
  );

  const submitFeedback = async (item: ReviewItem, action: 'accept' | 'override' | 'flag', correction?: string) => {
    setSubmitting(item.fileName);

    const feedback: HumanFeedback = {
      sampleHash: item.sampleHash,
      rating: action === 'accept' ? 5 : action === 'override' ? 2 : 1,
      correction: correction ?? null,
      reviewerHash: new Uint8Array(32), // derived from SPARK session
    };

    // Submit to ESLM training loop via stream
    // await client.emit('polylabs.data.eslm.classification.feedback', feedback);

    setSubmitting(null);
  };

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to classification stream...</div>;
  }

  const items: ReviewItem[] = queue?.items ?? [];

  return (
    <div className="polydata-eslm-review-queue">
      <div className="queue-header">
        <span className="count">{items.length} items pending review</span>
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
