/**
 * ESN-AI Recommendations Widget
 *
 * Displays proactive ESCIR optimization recommendations from ESN-AI.
 * Recommendations include circuit optimization, capacity planning,
 * anomaly correlation, and security insights.
 *
 * Actions: Accept (create task), Dismiss (feedback to ESN-AI),
 *          Snooze (revisit later), Investigate (drill-down to StreamSight L2/L3)
 *
 * Lex stream: polylabs.data.eslm.recommendation
 * Required role: polydata-operator
 */

import React, { useState } from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

type RecommendationCategory = 'circuit_optimization' | 'capacity_planning' | 'anomaly_correlation' | 'security';

interface Recommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  circuit?: string;
  metric?: string;
  impact: 'low' | 'medium' | 'high';
  timestamp: number;
}

export default function EsnAiRecommendationsWidget() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, status } = useStreamSubscription(
    'polylabs.data.eslm.recommendation',
  );

  const handleAction = async (rec: Recommendation, action: 'accept' | 'dismiss' | 'snooze' | 'investigate') => {
    if (action === 'dismiss') {
      setDismissed((prev) => new Set([...prev, rec.id]));
    }
    // Emit feedback to ESN-AI stream
    // await client.emit('polylabs.data.eslm.recommendation.feedback', { id: rec.id, action });
  };

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to ESN-AI stream...</div>;
  }

  const recommendations: Recommendation[] = (data?.items ?? []).filter(
    (r: Recommendation) => !dismissed.has(r.id),
  );

  const categoryLabels: Record<RecommendationCategory, string> = {
    circuit_optimization: 'Circuit Optimization',
    capacity_planning: 'Capacity Planning',
    anomaly_correlation: 'Anomaly Correlation',
    security: 'Security',
  };

  return (
    <div className="polydata-esn-ai-recommendations">
      <div className="rec-header">
        <span className="count">{recommendations.length} active recommendations</span>
      </div>

      <div className="rec-list">
        {recommendations.map((rec) => (
          <div key={rec.id} className={`rec-item impact-${rec.impact}`}>
            <div className="rec-meta">
              <span className="category">{categoryLabels[rec.category]}</span>
              <span className={`impact impact-${rec.impact}`}>{rec.impact}</span>
            </div>

            <h4 className="rec-title">{rec.title}</h4>
            <p className="rec-description">{rec.description}</p>

            {rec.circuit && (
              <span className="rec-circuit">Circuit: {rec.circuit}</span>
            )}

            <div className="rec-actions">
              <button onClick={() => handleAction(rec, 'accept')}>Accept</button>
              <button onClick={() => handleAction(rec, 'investigate')}>Investigate</button>
              <button onClick={() => handleAction(rec, 'snooze')}>Snooze</button>
              <button onClick={() => handleAction(rec, 'dismiss')}>Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
