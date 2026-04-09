/**
 * Capacity Forecast Widget
 *
 * Storage capacity forecast per classification tier, with growth rate
 * and projected tier limit exhaustion timeline.
 *
 * Event Bus:
 *   Emits: CLASSIFICATION_FILTER (on tier row click)
 *   Listens: CLASSIFICATION_FILTER (highlights matching tier)
 *            FILTER_RESET (clears highlight)
 *
 * Lex stream: polyqlabs.data.capacity
 * Required role: polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent, useEmitPolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

export default function CapacityForecastWidget() {
  const fixture = getFixture<any>('polydata-capacity-forecast');
  const emitClassFilter = useEmitPolydataEvent(POLYDATA_EVENTS.CLASSIFICATION_FILTER);
  const classFilter = usePolydataEvent(POLYDATA_EVENTS.CLASSIFICATION_FILTER);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription('polyqlabs.data.capacity');

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to capacity stream...</div>;
  }

  const tiers = data?.tiers ?? [];
  const activeTag = !filterReset ? classFilter?.tag : null;

  return (
    <div className="polydata-capacity-forecast">
      <div className="tier-list">
        {tiers.map((tier: any) => (
          <div
            key={tier.classification}
            className={`tier-row ${activeTag === tier.classification ? 'highlighted' : ''} ${activeTag && activeTag !== tier.classification ? 'dimmed' : ''}`}
            onClick={() => emitClassFilter({ tag: tier.classification })}
            role="button"
            tabIndex={0}
          >
            <span className="tier-name">{tier.classification}</span>
            <div className="usage-bar">
              <div
                className={`used ${tier.usagePercent > 80 ? 'critical' : tier.usagePercent > 60 ? 'warning' : ''}`}
                style={{ width: `${tier.usagePercent}%` }}
              />
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
