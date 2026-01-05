import {
  buildClarifySuggestions,
  buildComponentCapabilities,
  buildComponentEditSummary,
  normalizeUpdatedXmd,
  type EmbeddedComponentKind,
} from './component-ai-adapters/index';
import { validateComponentReplacement } from './component-ai-edit';

export type FinalizeComponentModelUpdateResult =
  | { ok: true; replacement: string; summary: string | null }
  | { ok: false; message: string; suggestions: string[] };

export function finalizeComponentModelUpdate(input: {
  kind: EmbeddedComponentKind;
  editMode: 'markdown' | 'latex';
  original: string;
  updatedXmdRaw: string;
}): FinalizeComponentModelUpdateResult {
  const original = String(input.original ?? '');
  const updatedRaw = String(input.updatedXmdRaw ?? '');
  const replacement = normalizeUpdatedXmd(input.kind, updatedRaw);

  if (!replacement.trim()) {
    const caps = buildComponentCapabilities(input.kind);
    return {
      ok: false,
      message: 'I couldn’t generate an updated component. Try rephrasing.',
      suggestions: buildClarifySuggestions(input.kind, caps),
    };
  }

  const validated = validateComponentReplacement({
    kind: input.kind,
    editMode: input.editMode,
    original,
    replacement,
  });

  if (!validated.ok) {
    const caps = buildComponentCapabilities(input.kind);
    return {
      ok: false,
      message: validated.message || 'That edit isn’t valid for this component.',
      suggestions: buildClarifySuggestions(input.kind, caps),
    };
  }

  const summary = buildComponentEditSummary({
    kind: input.kind,
    original,
    replacement,
  });

  return { ok: true, replacement, summary };
}


