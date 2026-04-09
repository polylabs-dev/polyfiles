/**
 * Scatter Provider Health Widget
 *
 * Displays health status and shard retrieval latency for each scatter
 * storage provider (AWS, GCP, Azure, Cloudflare, Hetzner, self-host).
 *
 * Event Bus:
 *   Emits: PROVIDER_SELECT (on provider card click)
 *   Listens: DEVIATION_SELECT (highlights affected provider)
 *            FILTER_RESET (clears selection)
 *
 * Lex stream: polyqlabs.data.telemetry
 * Required roles: polydata-viewer, polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent, useEmitPolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

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
  const fixture = getFixture<any>('polydata-scatter-health');
  const emitProviderSelect = useEmitPolydataEvent(POLYDATA_EVENTS.PROVIDER_SELECT);
  const deviationEvent = usePolydataEvent(POLYDATA_EVENTS.DEVIATION_SELECT);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription('polyqlabs.data.telemetry', {
    filter: { metric: 'polydata.scatter.*' },
  });

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to scatter telemetry...</div>;
  }

  const providers: ProviderStatus[] = data?.providers ?? [];

  const highlightScatter = !filterReset && deviationEvent?.metric.includes('scatter');

  return (
    <div className="polydata-scatter-health">
      <div className="provider-grid">
        {providers.map((p) => (
          <div
            key={`${p.name}-${p.region}`}
            className={`provider-card status-${p.status} ${highlightScatter && p.status !== 'healthy' ? 'highlighted' : ''}`}
            onClick={() => emitProviderSelect({ provider: p.name, region: p.region })}
            role="button"
            tabIndex={0}
          >
            <div className="provider-name">{p.name}</div>
            <div className="provider-region">{p.region}</div>
            <div className="provider-status">{p.status}</div>
            <div className="provider-latency">
              P50: {p.latencyP50Ms}ms / P99: {p.latencyP99Ms}ms
            </div>
            <div className="provider-shards">{p.shardCount.toLocaleString()} shards</div>
            {p.failureRate > 0 && (
              <div className="provider-failures">{(p.failureRate * 100).toFixed(3)}% failure</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
