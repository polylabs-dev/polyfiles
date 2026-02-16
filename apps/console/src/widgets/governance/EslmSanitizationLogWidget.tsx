/**
 * ESLM Sanitization Audit Log Widget
 *
 * Displays the 3-stage sanitization audit trail for all data processed
 * through ESLM. Shows what was redacted, transform actions, and PoVC
 * witness attestations.
 *
 * Compliance: HIPAA, PCI-DSS, GDPR, SOC2
 *
 * Lex stream: polylabs.data.eslm.sanitization
 * Required roles: polydata-compliance, polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

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
  const { data, status } = useStreamSubscription(
    'polylabs.data.eslm.sanitization',
  );

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to sanitization stream...</div>;
  }

  const entries: SanitizationEntry[] = data?.entries ?? [];

  const stageLabels = {
    pii_detect: 'PII Detection',
    value_transform: 'Value Transform',
    audit_record: 'Audit Record',
  };

  return (
    <div className="polydata-eslm-sanitization-log">
      <div className="log-header">
        <span className="count">{entries.length} sanitization actions</span>
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
            <tr key={i}>
              <td>{new Date(entry.timestamp).toLocaleTimeString()}</td>
              <td>{stageLabels[entry.stage]}</td>
              <td className="field-path">{entry.fieldPath}</td>
              <td>{entry.originalType}</td>
              <td className="placeholder">{entry.placeholder}</td>
              <td>{entry.regulation.join(', ')}</td>
              <td className="witness-hash">{entry.witnessHash.slice(0, 12)}...</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
