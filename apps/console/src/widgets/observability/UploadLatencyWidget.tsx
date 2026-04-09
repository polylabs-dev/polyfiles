/**
 * Upload Latency Widget
 *
 * Real-time gauge showing end-to-end upload latency broken down by phase:
 * encrypt, chunk, erasure-code, scatter. Uses StreamSight baseline comparison.
 *
 * Event Bus:
 *   Listens: DEVIATION_SELECT (highlights affected phase)
 *            CIRCUIT_FILTER (filters to specific circuit)
 *            FILTER_RESET (clears highlights)
 *
 * Lex stream: polyqlabs.data.telemetry
 * Metrics: polydata.upload.latency_ns, polydata.encrypt.chunk_ns,
 *          polydata.erasure.encode_ns, polydata.scatter.duration_ns
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

export default function UploadLatencyWidget() {
  const fixture = getFixture<any>('polydata-upload-latency');
  const deviationEvent = usePolydataEvent(POLYDATA_EVENTS.DEVIATION_SELECT);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription('polyqlabs.data.telemetry', {
    filter: { metric: 'polydata.upload.latency_ns' },
  });

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to telemetry stream...</div>;
  }

  const highlightPhase = !filterReset && deviationEvent
    ? phaseFromMetric(deviationEvent.metric)
    : null;

  return (
    <div className="polydata-upload-latency">
      <div className="latency-gauge">
        <div className={`phase ${highlightPhase === 'encrypt' ? 'highlighted' : ''}`} data-phase="encrypt">
          <span className="label">Encrypt</span>
          <span className="value">{formatNs(data?.encrypt_ns)}</span>
        </div>
        <div className={`phase ${highlightPhase === 'erasure' ? 'highlighted' : ''}`} data-phase="chunk">
          <span className="label">Chunk + Erasure</span>
          <span className="value">{formatNs(data?.erasure_ns)}</span>
        </div>
        <div className={`phase ${highlightPhase === 'scatter' ? 'highlighted' : ''}`} data-phase="scatter">
          <span className="label">Scatter</span>
          <span className="value">{formatNs(data?.scatter_ns)}</span>
        </div>
        <div className="phase total" data-phase="total">
          <span className="label">Total</span>
          <span className="value">{formatNs(data?.total_ns)}</span>
        </div>
      </div>
    </div>
  );
}

function formatNs(ns: number | undefined): string {
  if (ns == null) return '\u2014';
  if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(1)}ms`;
  if (ns >= 1_000) return `${(ns / 1_000).toFixed(0)}\u00B5s`;
  return `${ns}ns`;
}

function phaseFromMetric(metric: string): string | null {
  if (metric.includes('encrypt')) return 'encrypt';
  if (metric.includes('erasure')) return 'erasure';
  if (metric.includes('scatter')) return 'scatter';
  if (metric.includes('upload')) return 'total';
  return null;
}
