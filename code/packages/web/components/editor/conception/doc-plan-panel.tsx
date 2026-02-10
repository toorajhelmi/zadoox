'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DOC_PLAN_DOC_TYPE_ALL_CHOICES, DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES } from '@zadoox/shared';
import type { ConceptionState, DocPlan } from '@zadoox/shared';

function cloneDocPlan(dp: DocPlan): DocPlan {
  return {
    ...dp,
    toneGuess: Array.isArray(dp.toneGuess) ? [...dp.toneGuess] : [],
    sections: Array.isArray(dp.sections) ? dp.sections.map((s) => ({ ...s, bullets: Array.isArray(s.bullets) ? [...s.bullets] : [] })) : [],
    openQuestions: Array.isArray(dp.openQuestions) ? dp.openQuestions.map((q) => ({ ...q })) : [],
    scope: dp.scope
      ? {
          inScope: Array.isArray(dp.scope.inScope) ? dp.scope.inScope.map((x) => ({ ...x })) : [],
          outOfScope: Array.isArray(dp.scope.outOfScope) ? dp.scope.outOfScope.map((x) => ({ ...x })) : [],
        }
      : undefined,
  };
}

function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

type DocPlanTemplateField = {
  id: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
  inputKind: 'dropdown' | 'short_text' | 'long_text';
  options?: Array<{ value: string; label: string }>;
};

type DocPlanTemplate = {
  docType: string;
  fields: DocPlanTemplateField[];
  implicit?: Record<string, string>;
};

export function DocPlanPanel(props: {
  conception: ConceptionState;
  onSaveConception: (next: ConceptionState, changeType?: 'auto-save' | 'ai-action') => void;
}) {
  const { conception, onSaveConception } = props;
  const base = useMemo<DocPlan>(() => conception.docPlan ?? { docType: 'unknown', sections: [] }, [conception.docPlan]);

  // Local editable draft + debounce save (avoid spamming metadata saves while typing).
  const [draft, setDraft] = useState<DocPlan>(() => cloneDocPlan(base));
  const [optionalOpen, setOptionalOpen] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastBaseRef = useRef<DocPlan | null>(null);

  useEffect(() => {
    // If conception updates externally (LLM step), refresh the draft.
    // Keep it simple for now: last write wins.
    if (lastBaseRef.current === base) return;
    lastBaseRef.current = base;
    setDraft(cloneDocPlan(base));
  }, [base]);

  function scheduleSave(nextDraft: DocPlan) {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const next: ConceptionState = { ...conception, docPlan: nextDraft, updatedAt: new Date().toISOString() };
      onSaveConception(next, 'ai-action');
    }, 450);
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const setField = <K extends keyof DocPlan>(k: K, v: DocPlan[K]) => {
    const nextDraft = { ...draft, [k]: v };
    setDraft(nextDraft);
    scheduleSave(nextDraft);
  };

  const docType = draft.docType ?? 'unknown';
  const showPlanningFields = docType !== 'unknown';
  const dmAny = (conception as unknown as { dm?: unknown }).dm;
  const dm = (dmAny && typeof dmAny === 'object' ? (dmAny as Record<string, unknown>) : {}) as Record<string, unknown>;
  const ready = Boolean(dm.docPlanReady);
  const templateRaw = dm.docPlanTemplate;
  const template: DocPlanTemplate | null =
    templateRaw && isRecord(templateRaw) && Array.isArray((templateRaw as any).fields)
      ? {
          docType: String((templateRaw as any).docType ?? ''),
          fields: (templateRaw as any).fields as DocPlanTemplateField[],
          implicit: isRecord((templateRaw as any).implicit) ? ((templateRaw as any).implicit as Record<string, string>) : undefined,
        }
      : null;
  const selectedMediumFieldIds = Array.isArray(dm.selectedMediumFieldIds) ? (dm.selectedMediumFieldIds as unknown[]).map(String) : [];

  const prefs = (draft.prefs && isRecord(draft.prefs) ? (draft.prefs as Record<string, unknown>) : {}) as Record<string, unknown>;
  const setPref = (fieldId: string, value: unknown) => {
    const nextPrefs = { ...prefs, [fieldId]: value };
    setField('prefs', nextPrefs as any);
  };

  const visibleFields: DocPlanTemplateField[] = useMemo(() => {
    if (!template) return [];
    const highs = template.fields.filter((f) => f && f.priority === 'high');
    const meds = template.fields.filter((f) => f && f.priority === 'medium' && selectedMediumFieldIds.includes(f.id));
    return [...highs, ...meds];
  }, [templateRaw, selectedMediumFieldIds.join('|')]);

  const optionalFields: DocPlanTemplateField[] = useMemo(() => {
    if (!template) return [];
    const notAskedMedium = template.fields.filter((f) => f.priority === 'medium' && !selectedMediumFieldIds.includes(f.id));
    const lows = template.fields.filter((f) => f.priority === 'low');
    return [...notAskedMedium, ...lows];
  }, [templateRaw, selectedMediumFieldIds.join('|')]);

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="h-full overflow-auto p-4">
        <div className="max-w-[920px] space-y-6">
          <div>
            <div className="text-xs font-mono uppercase text-[#969696] mb-2">Doc Plan</div>
            <div className="text-[11px] text-[#969696] mb-3">
              Non-content planning settings (audience, tone, format). This guides drafting in the next stage.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#969696] mb-1">Doc type</label>
                <select
                  className="w-full text-sm bg-[#111111] border border-[#3e3e42] rounded px-2 py-2 text-[#e5e5e5]"
                  value={docType}
                  onChange={(e) => setField('docType', e.target.value as DocPlan['docType'])}
                >
                  <option value="unknown">Unknown</option>
                  {DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                  <optgroup label="More">
                    {DOC_PLAN_DOC_TYPE_ALL_CHOICES.filter(
                      (c) => c.value !== 'unknown' && !DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES.some((x) => x.value === c.value)
                    ).map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {showPlanningFields && !template ? (
              <div className="mt-4 text-sm text-[#969696]">Loading template…</div>
            ) : null}
          </div>

          {showPlanningFields && template ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase text-[#969696]">Required (High + selected Medium)</div>
                <div className="text-[10px] font-mono uppercase text-[#969696]">
                  {ready ? 'Planning complete' : 'Planning in progress'}
                </div>
              </div>

              <div className="space-y-3">
                {visibleFields.map((f) => {
                  const v = prefs[f.id];
                  const valueStr = typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
                  return (
                    <div key={f.id} className="rounded border border-[#3e3e42] bg-[#0f0f0f] p-3">
                      <label className="block text-[10px] font-mono uppercase text-[#969696] mb-1">{f.label}</label>
                      {f.inputKind === 'dropdown' && Array.isArray(f.options) ? (
                        <select
                          className="w-full text-sm bg-[#111111] border border-[#3e3e42] rounded px-2 py-2 text-[#e5e5e5]"
                          value={valueStr}
                          onChange={(e) => setPref(f.id, e.target.value)}
                        >
                          <option value="">(select)</option>
                          {f.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : f.inputKind === 'long_text' ? (
                        <textarea
                          className="w-full text-sm bg-[#111111] border border-[#3e3e42] rounded px-2 py-2 text-[#e5e5e5] min-h-[72px]"
                          value={valueStr}
                          onChange={(e) => setPref(f.id, e.target.value)}
                        />
                      ) : (
                        <input
                          className="w-full text-sm bg-[#111111] border border-[#3e3e42] rounded px-2 py-2 text-[#e5e5e5]"
                          value={valueStr}
                          onChange={(e) => setPref(f.id, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
                {visibleFields.length === 0 ? (
                  <div className="text-sm text-[#969696]">No required fields for this template.</div>
                ) : null}
              </div>

              {ready ? (
                <div className="mt-2">
                  <button
                    type="button"
                    className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#1e1e1e] text-[10px] font-mono uppercase text-[#cccccc]"
                    onClick={() => setOptionalOpen((v) => !v)}
                  >
                    {optionalOpen ? 'Hide optional fields' : `Show optional fields (${optionalFields.length})`}
                  </button>
                </div>
              ) : null}

              {ready && optionalOpen ? (
                <div className="space-y-3">
                  <div className="text-xs font-mono uppercase text-[#969696]">Optional (unasked Medium + Low)</div>
                  {optionalFields.map((f) => {
                    const v = prefs[f.id];
                    const valueStr = typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
                    return (
                      <div key={f.id} className="rounded border border-[#3e3e42] bg-[#0f0f0f] p-3">
                        <label className="block text-[10px] font-mono uppercase text-[#969696] mb-1">{f.label}</label>
                        {f.inputKind === 'dropdown' && Array.isArray(f.options) ? (
                          <select
                            className="w-full text-sm bg-[#111111] border border-[#3e3e42] rounded px-2 py-2 text-[#e5e5e5]"
                            value={valueStr}
                            onChange={(e) => setPref(f.id, e.target.value)}
                          >
                            <option value="">(select)</option>
                            {f.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : f.inputKind === 'long_text' ? (
                          <textarea
                            className="w-full text-sm bg-[#111111] border border-[#3e3e42] rounded px-2 py-2 text-[#e5e5e5] min-h-[72px]"
                            value={valueStr}
                            onChange={(e) => setPref(f.id, e.target.value)}
                          />
                        ) : (
                          <input
                            className="w-full text-sm bg-[#111111] border border-[#3e3e42] rounded px-2 py-2 text-[#e5e5e5]"
                            value={valueStr}
                            onChange={(e) => setPref(f.id, e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}



