/**
 * Poly Data Widget Event Bus
 *
 * Cross-widget communication using the eStream Console Widget Event Bus (#555).
 * Widgets emit typed events and subscribe to events from other widgets,
 * enabling drill-down navigation, filter propagation, and selection sync.
 *
 * Events are namespaced under `polydata.*` to avoid collision with other apps.
 *
 * @see https://github.com/polyquantum/estream-io/issues/555
 */

import { useCallback, useEffect, useState } from 'react';
import { widgetEventBus } from '@estream/sdk-browser/widgets';

// ─── Event Type Definitions ──────────────────────────────────────────────────

export const POLYDATA_EVENTS = {
  /** Deviation clicked → drill down in related observability widgets */
  DEVIATION_SELECT: 'polydata.deviation.select',
  /** Classification tag clicked → filter governance + observability widgets */
  CLASSIFICATION_FILTER: 'polydata.classification.filter',
  /** Provider clicked → filter shard/scatter widgets */
  PROVIDER_SELECT: 'polydata.provider.select',
  /** ESN-AI "Investigate" → drill down to relevant observability widget */
  INVESTIGATE_METRIC: 'polydata.investigate.metric',
  /** Review action completed → refresh accuracy + feedback widgets */
  REVIEW_COMPLETED: 'polydata.review.completed',
  /** Time range changed → propagate to all widgets */
  TIME_RANGE: 'polydata.time.range',
  /** Circuit filter → scope all widgets to specific circuit */
  CIRCUIT_FILTER: 'polydata.circuit.filter',
  /** Reset all cross-widget filters */
  FILTER_RESET: 'polydata.filter.reset',
} as const;

export type PolydataEventType = typeof POLYDATA_EVENTS[keyof typeof POLYDATA_EVENTS];

// ─── Event Payloads ──────────────────────────────────────────────────────────

export interface DeviationSelectEvent {
  metric: string;
  circuit: string;
  zScore: number;
  timestamp: number;
}

export interface ClassificationFilterEvent {
  tag: string | null; // null = clear filter
}

export interface ProviderSelectEvent {
  provider: string;
  region: string;
}

export interface InvestigateMetricEvent {
  metric: string;
  circuit?: string;
  category: string;
  recommendationId: string;
}

export interface ReviewCompletedEvent {
  action: 'accept' | 'override' | 'flag';
  sampleHash: string;
  classification: string;
}

export interface TimeRangeEvent {
  from: number; // unix ms
  to: number;
}

export interface CircuitFilterEvent {
  circuit: string | null; // null = clear filter
}

export type PolydataEventPayload = {
  [POLYDATA_EVENTS.DEVIATION_SELECT]: DeviationSelectEvent;
  [POLYDATA_EVENTS.CLASSIFICATION_FILTER]: ClassificationFilterEvent;
  [POLYDATA_EVENTS.PROVIDER_SELECT]: ProviderSelectEvent;
  [POLYDATA_EVENTS.INVESTIGATE_METRIC]: InvestigateMetricEvent;
  [POLYDATA_EVENTS.REVIEW_COMPLETED]: ReviewCompletedEvent;
  [POLYDATA_EVENTS.TIME_RANGE]: TimeRangeEvent;
  [POLYDATA_EVENTS.CIRCUIT_FILTER]: CircuitFilterEvent;
  [POLYDATA_EVENTS.FILTER_RESET]: Record<string, never>;
};

// ─── Typed Emit Helper ───────────────────────────────────────────────────────

export function emitPolydataEvent<K extends PolydataEventType>(
  event: K,
  payload: PolydataEventPayload[K],
): void {
  widgetEventBus.emit(event, payload);
}

// ─── React Hooks ─────────────────────────────────────────────────────────────

/**
 * Subscribe to a Poly Data widget event.
 * Returns the latest payload (or null if no event received yet).
 */
export function usePolydataEvent<K extends PolydataEventType>(
  event: K,
): PolydataEventPayload[K] | null {
  const [payload, setPayload] = useState<PolydataEventPayload[K] | null>(null);

  useEffect(() => {
    const unsub = widgetEventBus.on(event, (p: PolydataEventPayload[K]) => {
      setPayload(p);
    });
    return () => unsub();
  }, [event]);

  return payload;
}

/**
 * Typed emit hook, memoized for stable reference in event handlers.
 */
export function useEmitPolydataEvent<K extends PolydataEventType>(event: K) {
  return useCallback(
    (payload: PolydataEventPayload[K]) => emitPolydataEvent(event, payload),
    [event],
  );
}

/**
 * Listen for filter reset events. Returns true while any cross-widget
 * filter is active, resets to false on FILTER_RESET.
 */
export function useFilterActive(): boolean {
  const reset = usePolydataEvent(POLYDATA_EVENTS.FILTER_RESET);
  const classFilter = usePolydataEvent(POLYDATA_EVENTS.CLASSIFICATION_FILTER);
  const circuitFilter = usePolydataEvent(POLYDATA_EVENTS.CIRCUIT_FILTER);
  const providerFilter = usePolydataEvent(POLYDATA_EVENTS.PROVIDER_SELECT);

  if (reset) return false;
  return !!(classFilter?.tag || circuitFilter?.circuit || providerFilter);
}
