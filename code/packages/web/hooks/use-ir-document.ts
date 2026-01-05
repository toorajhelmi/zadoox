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

        // #region agent log
        try {
          fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'switch-churn',hypothesisId:'H14',location:'use-ir-document.ts:parse',message:'IR recomputed from XMD',data:{xmdLen:String(xmd??'').length,added:d.added.length,changed:d.changed.length,removed:d.removed.length,topTypes:(nextIr.children??[]).slice(0,10).map((n:any)=>n?.type),gridCount:(nextIr.children??[]).filter((n:any)=>n?.type==='grid').length},timestamp:Date.now()})}).catch(()=>{});
        } catch { /* ignore */ }
        // #endregion agent log

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


