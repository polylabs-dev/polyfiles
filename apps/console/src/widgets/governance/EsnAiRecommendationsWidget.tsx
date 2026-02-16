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
 * Event Bus:
 *   Emits: INVESTIGATE_METRIC (on "Investigate" -> drills into observability widgets)
 *          CIRCUIT_FILTER (on circuit name click -> scopes all widgets)
 *   Listens: DEVIATION_SELECT (highlights correlated recommendations)
 *            FILTER_RESET (clears highlights)
 *
 * Lex stream: polylabs.data.eslm.recommendation
 * Required role: polydata-operator
 */

import React, { useState } from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent, useEmitPolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

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
  const fixture = getFixture<any>('polydata-esn-ai-recommendations');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const emitInvestigate = useEmitPolydataEvent(POLYDATA_EVENTS.INVESTIGATE_METRIC);
  const emitCircuit = useEmitPolydataEvent(POLYDATA_EVENTS.CIRCUIT_FILTER);
  const deviationEvent = usePolydataEvent(POLYDATA_EVENTS.DEVIATION_SELECT);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription(
    'polylabs.data.eslm.recommendation',
  );

  const data = fixture ?? liveData;

  const handleAction = async (rec: Recommendation, action: 'accept' | 'dismiss' | 'snooze' | 'investigate') => {
    if (action === 'dismiss') {
      setDismissed((prev) => new Set([...prev, rec.id]));
    }
    if (action === 'investigate') {
      emitInvestigate({
        metric: rec.metric ?? '',
        circuit: rec.circuit,
        category: rec.category,
        recommendationId: rec.id,
      });
    }
    // Emit feedback to ESN-AI stream
    // await client.emit('polylabs.data.eslm.recommendation.feedback', { id: rec.id, action });
  };

  const handleCircuitClick = (e: React.MouseEvent, circuit: string) => {
    e.stopPropagation();
    emitCircuit({ circuit });
  };

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to ESN-AI stream...</div>;
  }

  const recommendations: Recommendation[] = (data?.items ?? []).filter(
    (r: Recommendation) => !dismissed.has(r.id),
  );

  // Highlight recommendations correlated with active deviation
  const activeDeviation = !filterReset ? deviationEvent : null;

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
        {recommendations.map((rec) => {
          const isCorrelated = activeDeviation && (
            rec.metric === activeDeviation.metric ||
            rec.circuit === activeDeviation.circuit
          );

          return (
            <div key={rec.id} className={`rec-item impact-${rec.impact} ${isCorrelated ? 'correlated' : ''}`}>
              <div className="rec-meta">
                <span className="category">{categoryLabels[rec.category]}</span>
                <span className={`impact impact-${rec.impact}`}>{rec.impact}</span>
                {isCorrelated && <span className="correlation-badge">Correlated</span>}
              </div>

              <h4 className="rec-title">{rec.title}</h4>
              <p className="rec-description">{rec.description}</p>

              {rec.circuit && (
                <span
                  className="rec-circuit clickable"
                  onClick={(e) => handleCircuitClick(e, rec.circuit!)}
                >
                  Circuit: {rec.circuit}
                </span>
              )}

              <div className="rec-actions">
                <button onClick={() => handleAction(rec, 'accept')}>Accept</button>
                <button onClick={() => handleAction(rec, 'investigate')}>Investigate</button>
                <button onClick={() => handleAction(rec, 'snooze')}>Snooze</button>
                <button onClick={() => handleAction(rec, 'dismiss')}>Dismiss</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
