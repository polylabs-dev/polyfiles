/**
 * Scatter Provider Health Widget
 *
 * Displays health status and shard retrieval latency for each scatter
 * storage provider (AWS, GCP, Azure, Cloudflare, Hetzner, self-host).
 *
 * Lex stream: polylabs.data.telemetry
 * Required roles: polydata-viewer, polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

interface ProviderStatus {
  name: string;
  region: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyP50Ms: number;
  latencyP99Ms: number;
  shardCount: number;
  failureRate: number;
}

export default function ScatterHealthWidget() {
  const { data, status } = useStreamSubscription('polylabs.data.telemetry', {
    filter: { metric: 'polydata.scatter.*' },
  });

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to scatter telemetry...</div>;
  }

  const providers: ProviderStatus[] = data?.providers ?? [];

  return (
    <div className="polydata-scatter-health">
      <div className="provider-grid">
        {providers.map((p) => (
          <div key={`${p.name}-${p.region}`} className={`provider-card status-${p.status}`}>
            <div className="provider-name">{p.name}</div>
            <div className="provider-region">{p.region}</div>
            <div className="provider-status">{p.status}</div>
            <div className="provider-latency">
              P50: {p.latencyP50Ms}ms / P99: {p.latencyP99Ms}ms
            </div>
            <div className="provider-shards">{p.shardCount} shards</div>
            {p.failureRate > 0 && (
              <div className="provider-failures">{(p.failureRate * 100).toFixed(2)}% failure</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
