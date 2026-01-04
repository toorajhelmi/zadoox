/**
 * embeddedImagePreviewExtension tests
 * Goal: cover parsing + decoration creation for figure markdown.
 */
/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { Decoration } from '@codemirror/view';
import { embeddedImagePreviewExtension } from '../embedded-image-preview-extension';

vi.mock('@/lib/api/client', () => ({
  api: {
    ai: { images: { generate: vi.fn() } },
    assets: { upload: vi.fn() },
  },
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) },
  }),
}));

describe('embeddedImagePreviewExtension', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a replace decoration for zadoox-asset figures and respects placement block/inline', () => {
    const doc = [
      'Before',
      '![Cap](zadoox-asset://k){#fig:x align="right" width="50%" placement="inline" desc="d"}',
      'After',
    ].join('\n');

    const exts = embeddedImagePreviewExtension();
    const field = exts[1]!;
    const state = EditorState.create({ doc, extensions: exts });
    const decos = state.field(field);

    const found: Array<{ from: number; to: number; deco: Decoration }> = [];
    decos.between(0, state.doc.length, (from, to, deco) => {
      found.push({ from, to, deco: deco as unknown as Decoration });
    });

    expect(found.length).toBe(1);
    const d = found[0]!.deco as any;
    expect(d.spec?.widget).toBeTruthy();
    // placement="inline" -> block should be false
    expect(d.spec?.block).toBe(false);
  });

  it('treats non-inline figures as block decorations', () => {
    const doc = '![Cap](zadoox-asset://k){#fig:x width="50%"}';
    const exts = embeddedImagePreviewExtension();
    const field = exts[1]!;
    const state = EditorState.create({ doc, extensions: exts });
    const decos = state.field(field);

    const found: any[] = [];
    decos.between(0, state.doc.length, (_f, _t, deco) => found.push(deco));
    expect(found.length).toBe(1);
    expect(found[0]?.spec?.block).toBe(true);
  });

  it('widget DOM reflects inline placement styling', () => {
    const doc = '![Cap](zadoox-asset://k){#fig:x align="right" width="50%" placement="inline"}';
    const exts = embeddedImagePreviewExtension();
    const field = exts[1]!;
    const state = EditorState.create({ doc, extensions: exts });
    const decos = state.field(field);

    const found: any[] = [];
    decos.between(0, state.doc.length, (_f, _t, deco) => found.push(deco));
    const widget = found[0]?.spec?.widget;
    expect(widget).toBeTruthy();

    const dom = widget.toDOM({ dispatch: vi.fn() } as any);
    expect(dom.className).toContain('cm-embedded-figure-card');
    // Inline placement adds outline hint and inline-block
    expect((dom as HTMLElement).style.outline).toContain('dashed');
  });
});


