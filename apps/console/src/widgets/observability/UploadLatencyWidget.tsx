/**
 * Upload Latency Widget
 *
 * Real-time gauge showing end-to-end upload latency broken down by phase:
 * encrypt, chunk, erasure-code, scatter. Uses StreamSight baseline comparison.
 *
 * Lex stream: polylabs.data.telemetry
 * Metrics: polydata.upload.latency_ns, polydata.encrypt.chunk_ns,
 *          polydata.erasure.encode_ns, polydata.scatter.duration_ns
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

export default function UploadLatencyWidget() {
  const { data, status } = useStreamSubscription('polylabs.data.telemetry', {
    filter: { metric: 'polydata.upload.latency_ns' },
  });

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to telemetry stream...</div>;
  }

  return (
    <div className="polydata-upload-latency">
      <div className="latency-gauge">
        <div className="phase" data-phase="encrypt">
          <span className="label">Encrypt</span>
          <span className="value">{data?.encrypt_ns ?? '—'}</span>
        </div>
        <div className="phase" data-phase="chunk">
          <span className="label">Chunk + Erasure</span>
          <span className="value">{data?.erasure_ns ?? '—'}</span>
        </div>
        <div className="phase" data-phase="scatter">
          <span className="label">Scatter</span>
          <span className="value">{data?.scatter_ns ?? '—'}</span>
        </div>
        <div className="phase total" data-phase="total">
          <span className="label">Total</span>
          <span className="value">{data?.total_ns ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}
