/**
 * ESLM Sanitization Audit Log Widget
 *
 * Displays the 3-stage sanitization audit trail for all data processed
 * through ESLM. Shows what was redacted, transform actions, and PoVC
 * witness attestations.
 *
 * Compliance: HIPAA, PCI-DSS, GDPR, SOC2
 *
 * Event Bus:
 *   Listens: CLASSIFICATION_FILTER (filters log entries by classification context)
 *            TIME_RANGE (filters by time window)
 *            FILTER_RESET (clears filters)
 *
 * Lex stream: polylabs.data.eslm.sanitization
 * Required roles: polydata-compliance, polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

interface SanitizationEntry {
  timestamp: number;
  stage: 'pii_detect' | 'value_transform' | 'audit_record';
  fieldPath: string;
  originalType: string;
  placeholder: string;
  regulation: string[];
  witnessHash: string;
}

export default function EslmSanitizationLogWidget() {
  const fixture = getFixture<any>('polydata-eslm-sanitization-log');
  const timeRange = usePolydataEvent(POLYDATA_EVENTS.TIME_RANGE);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription(
    'polylabs.data.eslm.sanitization',
  );

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to sanitization stream...</div>;
  }

  let entries: SanitizationEntry[] = data?.entries ?? [];

  // Apply time range filter from event bus
  const activeTimeRange = !filterReset ? timeRange : null;
  if (activeTimeRange) {
    entries = entries.filter(
      (e) => e.timestamp >= activeTimeRange.from && e.timestamp <= activeTimeRange.to,
    );
  }

  const stageLabels = {
    pii_detect: 'PII Detection',
    value_transform: 'Value Transform',
    audit_record: 'Audit Record',
  };

  const stageIcons = {
    pii_detect: '\uD83D\uDD0D',
    value_transform: '\uD83D\uDD12',
    audit_record: '\uD83D\uDCDD',
  };

  return (
    <div className="polydata-eslm-sanitization-log">
      <div className="log-header">
        <span className="count">{entries.length} sanitization actions</span>
        {activeTimeRange && (
          <span className="time-filter">
            {new Date(activeTimeRange.from).toLocaleTimeString()} - {new Date(activeTimeRange.to).toLocaleTimeString()}
          </span>
        )}
      </div>

      <table className="sanitization-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Stage</th>
            <th>Field</th>
            <th>Type</th>
            <th>Placeholder</th>
            <th>Regulation</th>
            <th>Witness</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i} className={`stage-${entry.stage}`}>
              <td>{new Date(entry.timestamp).toLocaleTimeString()}</td>
              <td>{stageIcons[entry.stage]} {stageLabels[entry.stage]}</td>
              <td className="field-path">{entry.fieldPath}</td>
              <td>{entry.originalType}</td>
              <td className="placeholder"><code>{entry.placeholder}</code></td>
              <td>{entry.regulation.join(', ')}</td>
              <td className="witness-hash"><code>{entry.witnessHash.slice(0, 12)}...</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
