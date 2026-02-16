/**
 * Classification Distribution Widget
 *
 * Displays classification tag distribution across user files as a
 * breakdown chart (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, SOVEREIGN).
 *
 * Lex stream: polylabs.data.telemetry
 * Required roles: polydata-viewer, polydata-operator
 */

import React from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';

export default function ClassificationDistWidget() {
  const { data, status } = useStreamSubscription('polylabs.data.telemetry', {
    filter: { metric: 'polydata.classify.*' },
  });

  if (status === 'connecting') {
    return <div className="widget-loading">Connecting to classification telemetry...</div>;
  }

  const dist = data?.distribution ?? {
    PUBLIC: 0, INTERNAL: 0, CONFIDENTIAL: 0, RESTRICTED: 0, SOVEREIGN: 0,
  };
  const total = Object.values(dist).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="polydata-classification-dist">
      {Object.entries(dist).map(([tag, count]) => (
        <div key={tag} className={`dist-bar tag-${tag.toLowerCase()}`}>
          <span className="tag-name">{tag}</span>
          <div className="bar" style={{ width: `${total > 0 ? ((count as number) / total) * 100 : 0}%` }} />
          <span className="count">{count as number}</span>
        </div>
      ))}
    </div>
  );
}
