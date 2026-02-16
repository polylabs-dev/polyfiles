/**
 * Deviation Feed Widget
 *
 * Live feed of StreamSight baseline deviations and anomalies for
 * all Poly Data circuits. Shows z-score, affected metric, circuit,
 * and baseline comparison.
 *
 * Lex stream: polylabs.data.metrics.deviations
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

interface Deviation {
  timestamp: number;
  metric: string;
  circuit: string;
  zScore: number;
  observed: number;
  baseline: number;
  severity: 'deviation' | 'anomaly';
}

export default function DeviationFeedWidget() {
  const { data, status } = useStreamSubscription('polylabs.data.metrics.deviations');

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to deviation stream...</div>;
  }

  const deviations: Deviation[] = data?.deviations ?? [];

  return (
    <div className="polydata-deviation-feed">
      <div className="feed-list">
        {deviations.map((d, i) => (
          <div key={i} className={`deviation-item severity-${d.severity}`}>
            <span className="time">{new Date(d.timestamp).toLocaleTimeString()}</span>
            <span className="circuit">{d.circuit}</span>
            <span className="metric">{d.metric}</span>
            <span className="z-score">z={d.zScore.toFixed(2)}</span>
            <span className="values">
              {d.observed.toFixed(0)} vs baseline {d.baseline.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
