'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeIrDelta,
  irEventsFromDelta,
  makeSnapshotFromIr,
  parseXmdToIr,
  type DocumentNode,
  type IrDelta,
  type IrEvent,
} from '@zadoox/shared';

export interface UseIrDocumentResult {
  ir: DocumentNode | null;
  delta: IrDelta | null;
  events: IrEvent[];
  changedNodeIds: string[];
  isParsing: boolean;
}

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * Keep an IR snapshot updated from XMD.
 *
 * Phase 11: full re-parse on debounce, then compute node-level delta + events.
 */
export function useIrDocument(params: {
  docId: string;
  xmd: string;
  debounceMs?: number;
  enabled?: boolean;
}): UseIrDocumentResult {
  const { docId, xmd, debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = params;

  const [ir, setIr] = useState<DocumentNode | null>(null);
  const [delta, setDelta] = useState<IrDelta | null>(null);
  const [events, setEvents] = useState<IrEvent[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const prevNodeHashRef = useRef<Map<string, string> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsParsing(true);

    timeoutRef.current = setTimeout(() => {
      try {
        const nextIr = parseXmdToIr({ docId, xmd });
        const snap = makeSnapshotFromIr(nextIr);

        const prev = prevNodeHashRef.current ?? new Map<string, string>();
        const d = computeIrDelta(prev, snap.nodeHash);
        const e = irEventsFromDelta(d);

        prevNodeHashRef.current = snap.nodeHash;
        setIr(nextIr);
        setDelta(d);
        setEvents(e);
      } finally {
        setIsParsing(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [docId, xmd, debounceMs, enabled]);

  const changedNodeIds = useMemo(() => {
    if (!delta) return [];
    return [...delta.added, ...delta.changed];
  }, [delta]);

  return { ir, delta, events, changedNodeIds, isParsing };
}


