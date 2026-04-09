/**
 * Shard Failures Widget
 *
 * Tracks shard retrieval failure rate, affected providers, and impacted files.
 *
 * Event Bus:
 *   Emits: PROVIDER_SELECT (on provider row click)
 *   Listens: PROVIDER_SELECT (highlights matching provider)
 *            DEVIATION_SELECT (highlights if shard failure metric)
 *            FILTER_RESET (clears highlights)
 *
 * Lex stream: polyqlabs.data.telemetry
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent, useEmitPolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

export default function ShardFailuresWidget() {
  const fixture = getFixture<any>('polydata-shard-failures');
  const emitProviderSelect = useEmitPolydataEvent(POLYDATA_EVENTS.PROVIDER_SELECT);
  const providerEvent = usePolydataEvent(POLYDATA_EVENTS.PROVIDER_SELECT);
  const deviationEvent = usePolydataEvent(POLYDATA_EVENTS.DEVIATION_SELECT);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription('polyqlabs.data.telemetry', {
    filter: { metric: 'polydata.shard.failure_total' },
  });

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to shard telemetry...</div>;
  }

  const failures = data?.failures ?? { total: 0, byProvider: {}, affectedFiles: 0 };

  const isShardDeviation = !filterReset && deviationEvent?.metric.includes('shard');
  const activeProvider = !filterReset ? providerEvent?.provider : null;

  return (
    <div className={`polydata-shard-failures ${isShardDeviation ? 'deviation-highlight' : ''}`}>
      <div className="failure-summary">
        <div className="stat">
          <span className="value">{failures.total}</span>
          <span className="label">Total Failures (24h)</span>
        </div>
        <div className="stat">
          <span className="value">{failures.affectedFiles}</span>
          <span className="label">Affected Files</span>
        </div>
      </div>
      <div className="by-provider">
        {Object.entries(failures.byProvider).map(([provider, count]) => (
          <div
            key={provider}
            className={`provider-failure ${activeProvider && provider.includes(activeProvider) ? 'highlighted' : ''}`}
            onClick={() => {
              const match = provider.match(/^(.+?)\s*\((.+?)\)$/);
              if (match) emitProviderSelect({ provider: match[1], region: match[2] });
            }}
            role="button"
            tabIndex={0}
          >
            <span className="name">{provider}</span>
            <span className="count">{count as number}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
