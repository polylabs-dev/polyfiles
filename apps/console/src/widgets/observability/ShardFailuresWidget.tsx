/**
 * Shard Failures Widget
 *
 * Tracks shard retrieval failure rate, affected providers, and impacted files.
 *
 * Lex stream: polylabs.data.telemetry
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

export default function ShardFailuresWidget() {
  const { data, status } = useStreamSubscription('polylabs.data.telemetry', {
    filter: { metric: 'polydata.shard.failure_total' },
  });

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to shard telemetry...</div>;
  }

  const failures = data?.failures ?? { total: 0, byProvider: {}, affectedFiles: 0 };

  return (
    <div className="polydata-shard-failures">
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
          <div key={provider} className="provider-failure">
            <span className="name">{provider}</span>
            <span className="count">{count as number}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
