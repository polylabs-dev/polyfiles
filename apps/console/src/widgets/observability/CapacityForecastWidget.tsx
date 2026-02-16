/**
 * Capacity Forecast Widget
 *
 * Storage capacity forecast per classification tier, with growth rate
 * and projected tier limit exhaustion timeline.
 *
 * Lex stream: polylabs.data.capacity
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

export default function CapacityForecastWidget() {
  const { data, status } = useStreamSubscription('polylabs.data.capacity');

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to capacity stream...</div>;
  }

  const tiers = data?.tiers ?? [];

  return (
    <div className="polydata-capacity-forecast">
      <div className="tier-list">
        {tiers.map((tier: any) => (
          <div key={tier.classification} className="tier-row">
            <span className="tier-name">{tier.classification}</span>
            <div className="usage-bar">
              <div className="used" style={{ width: `${tier.usagePercent}%` }} />
            </div>
            <span className="usage">{tier.usagePercent.toFixed(1)}%</span>
            <span className="forecast">
              {tier.daysUntilLimit > 0 ? `${tier.daysUntilLimit}d remaining` : 'At limit'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
