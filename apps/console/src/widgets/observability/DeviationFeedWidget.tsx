/**
 * Deviation Feed Widget
 *
 * Live feed of StreamSight baseline deviations and anomalies for
 * all Poly Data circuits. Shows z-score, affected metric, circuit,
 * and baseline comparison.
 *
 * Event Bus:
 *   Emits: DEVIATION_SELECT (on deviation row click → highlights related widgets)
 *          CIRCUIT_FILTER (on circuit name click)
 *   Listens: CLASSIFICATION_FILTER (filters deviations by classification context)
 *            FILTER_RESET (clears selection)
 *
 * Lex stream: polyqlabs.data.metrics.deviations
 * Required role: polydata-operator
 */

import React, { useState } from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent, useEmitPolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';
import type { Deviation as DeviationType } from '../../generated/types';

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
  const fixture = getFixture<any>('polydata-deviation-feed');
  const [selected, setSelected] = useState<number | null>(null);
  const emitDeviation = useEmitPolydataEvent(POLYDATA_EVENTS.DEVIATION_SELECT);
  const emitCircuit = useEmitPolydataEvent(POLYDATA_EVENTS.CIRCUIT_FILTER);
  const circuitFilter = usePolydataEvent(POLYDATA_EVENTS.CIRCUIT_FILTER);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription('polyqlabs.data.metrics.deviations');

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to deviation stream...</div>;
  }

  let deviations: Deviation[] = data?.deviations ?? [];

  // Apply circuit filter from event bus
  const activeCircuitFilter = !filterReset ? circuitFilter?.circuit : null;
  if (activeCircuitFilter) {
    deviations = deviations.filter((d) => d.circuit === activeCircuitFilter);
  }

  const handleDeviationClick = (d: Deviation, index: number) => {
    setSelected(index);
    emitDeviation({
      metric: d.metric,
      circuit: d.circuit,
      zScore: d.zScore,
      timestamp: d.timestamp,
    });
  };

  const handleCircuitClick = (e: React.MouseEvent, circuit: string) => {
    e.stopPropagation();
    emitCircuit({ circuit });
  };

  return (
    <div className="polydata-deviation-feed">
      <div className="feed-list">
        {deviations.map((d, i) => (
          <div
            key={i}
            className={`deviation-item severity-${d.severity} ${selected === i ? 'selected' : ''}`}
            onClick={() => handleDeviationClick(d, i)}
            role="button"
            tabIndex={0}
          >
            <span className="time">{new Date(d.timestamp).toLocaleTimeString()}</span>
            <span
              className="circuit clickable"
              onClick={(e) => handleCircuitClick(e, d.circuit)}
            >
              {d.circuit}
            </span>
            <span className="metric">{d.metric}</span>
            <span className="z-score">z={d.zScore.toFixed(2)}</span>
            <span className="values">
              {formatValue(d.observed)} vs baseline {formatValue(d.baseline)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}
