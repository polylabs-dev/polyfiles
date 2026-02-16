/**
 * Classification Distribution Widget
 *
 * Displays classification tag distribution across user files as a
 * breakdown chart (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, SOVEREIGN).
 *
 * Event Bus:
 *   Emits: CLASSIFICATION_FILTER (on tag bar click)
 *   Listens: FILTER_RESET (clears selection)
 *
 * Lex stream: polylabs.data.telemetry
 * Required roles: polydata-viewer, polydata-operator
 */

import React, { useState } from 'react';
import { useStreamSubscription } from '@estream/sdk-browser';
import { POLYDATA_EVENTS, usePolydataEvent, useEmitPolydataEvent, emitPolydataEvent } from '../event-bus';
import { getFixture } from '../demo-fixtures';

export default function ClassificationDistWidget() {
  const fixture = getFixture<any>('polydata-classification-dist');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const emitClassFilter = useEmitPolydataEvent(POLYDATA_EVENTS.CLASSIFICATION_FILTER);
  const filterReset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);

  const { data: liveData, status } = useStreamSubscription('polylabs.data.telemetry', {
    filter: { metric: 'polydata.classify.*' },
  });

  const data = fixture ?? liveData;

  if (!fixture && status === 'connecting') {
    return <div className="widget-loading">Connecting to classification telemetry...</div>;
  }

  // Clear selection on filter reset
  const effectiveSelection = filterReset ? null : selectedTag;

  const dist = data?.distribution ?? {
    PUBLIC: 0, INTERNAL: 0, CONFIDENTIAL: 0, RESTRICTED: 0, SOVEREIGN: 0,
  };
  const total = Object.values(dist).reduce((a: number, b: number) => a + b, 0);

  const handleTagClick = (tag: string) => {
    const newTag = effectiveSelection === tag ? null : tag;
    setSelectedTag(newTag);
    emitClassFilter({ tag: newTag });
  };

  return (
    <div className="polydata-classification-dist">
      {Object.entries(dist).map(([tag, count]) => (
        <div
          key={tag}
          className={`dist-bar tag-${tag.toLowerCase()} ${effectiveSelection === tag ? 'selected' : ''} ${effectiveSelection && effectiveSelection !== tag ? 'dimmed' : ''}`}
          onClick={() => handleTagClick(tag)}
          role="button"
          tabIndex={0}
        >
          <span className="tag-name">{tag}</span>
          <div className="bar" style={{ width: `${total > 0 ? ((count as number) / total) * 100 : 0}%` }} />
          <span className="count">{(count as number).toLocaleString()}</span>
        </div>
      ))}
      {effectiveSelection && (
        <button
          className="clear-filter"
          onClick={() => {
            setSelectedTag(null);
            emitPolydataEvent(POLYDATA_EVENTS.FILTER_RESET, {});
          }}
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
