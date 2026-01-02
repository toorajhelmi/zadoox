import { StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, WidgetType, EditorView } from '@codemirror/view';
import { api } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

function parseAttrValue(attrs: string, key: string): string | null {
  const re = new RegExp(`${key}="([^"]*)"`);
  const m = re.exec(attrs);
  return m ? m[1] : null;
}

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
}

function stripAttrKeys(attrs: string, keys: string[]): string {
  let out = attrs;
  for (const k of keys) {
    out = out.replace(new RegExp(`\\s*${k}="[^"]*"`, 'g'), '');
  }
  return out.replace(/\s+/g, ' ').trim();
}

function upsertAttr(attrs: string, key: string, value: string | null): string {
  const cleaned = stripAttrKeys(attrs, [key]);
  if (!value || value.trim().length === 0) return cleaned;
  return `${cleaned} ${key}="${escapeAttrValue(value)}"`.trim();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parsePercentWidth(width: string | null): number | null {
  if (!width) return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(width);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function formatPercentWidth(pct: number): string {
  // Keep it simple and stable for diffs/widgets.
  return `${Math.round(pct)}%`;
}

class FigureCardWidget extends WidgetType {
  constructor(
    // Raw markdown URL (e.g. data:... or zadoox-asset://<key>)
    private readonly rawUrl: string,
    // Display URL for <img src> (e.g. /api/assets/<key>)
    private readonly displaySrc: string,
    private readonly alt: string
    ,
    private readonly desc: string | null,
    private readonly attrs: string | null,
    private readonly from: number,
    private readonly to: number
  ) {
    super();
  }

  eq(other: FigureCardWidget): boolean {
    return (
      this.rawUrl === other.rawUrl &&
      this.displaySrc === other.displaySrc &&
      this.alt === other.alt &&
      this.desc === other.desc &&
      this.attrs === other.attrs &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  ignoreEvent(): boolean {
    return false;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-embedded-figure-card';
    wrap.style.position = 'relative';
    wrap.style.margin = '8px 0';
    wrap.style.padding = '8px';
    wrap.style.border = '1px solid rgba(255,255,255,0.08)';
    wrap.style.borderRadius = '8px';
    wrap.style.background = 'rgba(0,0,0,0.12)';

    const baseAttrs = (this.attrs || '').trim();
    const align = baseAttrs ? parseAttrValue(baseAttrs, 'align') : null; // left|center|right
    const width = baseAttrs ? parseAttrValue(baseAttrs, 'width') : null; // e.g. 50% or 320px
    const placement = baseAttrs ? parseAttrValue(baseAttrs, 'placement') : null; // inline|block

    // Keep the editor stable: we don't do true text-wrapping inline layout inside CodeMirror.
    // But we *do*:
    // - respect the configured width so the figure matches preview sizing
    // - show a visual hint that this figure will be inline/wrapped in preview
    if (placement === 'inline') {
      if (width) {
        wrap.style.width = width;
        wrap.style.maxWidth = width;
      }
      wrap.style.outline = '1px dashed rgba(120, 170, 255, 0.55)';
      wrap.style.outlineOffset = '3px';

      // Align the whole card within the editor (best-effort).
      // We don't do true inline wrapping inside CodeMirror, but alignment should still match preview intent.
      if (align === 'center') {
        wrap.style.marginLeft = 'auto';
        wrap.style.marginRight = 'auto';
      } else if (align === 'right') {
        wrap.style.marginLeft = 'auto';
        wrap.style.marginRight = '0';
      } else if (align === 'left') {
        wrap.style.marginLeft = '0';
        wrap.style.marginRight = 'auto';
      }
    } else {
      // Block placement: the card should occupy the full editor width (prevents caret showing beside it).
      wrap.style.width = '100%';
      wrap.style.maxWidth = '100%';
      // Align the figure content (inner wrapper) within the full-width card.
      // This ensures align changes are visible even when width is not explicitly set.
      wrap.style.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    }

    const img = document.createElement('img');
    img.src = this.displaySrc || '';
    img.alt = this.alt || 'Figure';
    img.style.display = 'block';
    // Default: allow the image to size naturally but never overflow the container.
    img.style.maxWidth = '100%';
    // Allow scaling; don't clamp to a small fixed height (S/M/L should actually scale).
    img.style.maxHeight = '60vh';
    // Sizing:
    // - inline: wrapper width drives image width (fill)
    // - block: wrapper is full width; width constrains the image (max-width) inside it
    if (placement === 'inline' && width) {
      img.style.width = '100%';
    } else {
      if (width) {
        img.style.maxWidth = width;
      }
      img.style.width = 'auto';
    }
    img.style.height = 'auto';
    img.style.borderRadius = '6px';
    img.style.border = '1px solid rgba(255,255,255,0.10)';
    if (align === 'center') img.style.margin = '0 auto';
    if (align === 'right') img.style.marginLeft = 'auto';
    if (align === 'left') img.style.marginRight = 'auto';
    wrap.appendChild(img);

    // If this is an asset reference, fetch it with Authorization and convert to a blob URL.
    // This avoids relying on cookie-based auth for <img src>.
    if (this.rawUrl.startsWith('zadoox-asset://')) {
      const key = this.rawUrl.slice('zadoox-asset://'.length);
      if (key) {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
        const supabase = createClient();
        // Prevent duplicate loads if CodeMirror reuses DOM nodes.
        (img as unknown as { __assetLoading?: boolean }).__assetLoading = true;
        void (async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;
            const res = await fetch(`${API_BASE}/assets/${encodeURIComponent(key)}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            (img as unknown as { __assetBlobUrl?: string }).__assetBlobUrl = url;
            img.src = url;
          } catch {
            // ignore
          } finally {
            (img as unknown as { __assetLoading?: boolean }).__assetLoading = false;
          }
        })();
      }
    }

    if (placement === 'inline') {
      // Inline-wrap hint: subtle side fades indicating text will flow around the figure in preview.
      const leftHint = document.createElement('div');
      leftHint.style.position = 'absolute';
      leftHint.style.left = '-10px';
      leftHint.style.top = '0';
      leftHint.style.bottom = '0';
      leftHint.style.width = '10px';
      leftHint.style.borderRadius = '8px 0 0 8px';
      leftHint.style.background =
        'linear-gradient(to left, rgba(120,170,255,0.18), rgba(120,170,255,0.00))';

      const rightHint = document.createElement('div');
      rightHint.style.position = 'absolute';
      rightHint.style.right = '-10px';
      rightHint.style.top = '0';
      rightHint.style.bottom = '0';
      rightHint.style.width = '10px';
      rightHint.style.borderRadius = '0 8px 8px 0';
      rightHint.style.background =
        'linear-gradient(to right, rgba(120,170,255,0.18), rgba(120,170,255,0.00))';

      const badge = document.createElement('div');
      badge.textContent = 'Inline (preview)';
      badge.style.position = 'absolute';
      badge.style.left = '8px';
      badge.style.top = '8px';
      badge.style.fontSize = '10px';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '999px';
      badge.style.border = '1px solid rgba(120,170,255,0.35)';
      badge.style.background = 'rgba(120,170,255,0.12)';
      badge.style.color = '#cfd7ff';
      badge.style.pointerEvents = 'none';

      wrap.appendChild(leftHint);
      wrap.appendChild(rightHint);
      wrap.appendChild(badge);
    }

    // Inner wrapper so caption width follows the image width (even when no explicit width attr exists).
    // This prevents "caption centered across full page" when image is smaller than the editor width.
    const inner = document.createElement('div');
    if (placement === 'inline') {
      // Inline figures: keep caption width <= image width.
      // Use shrink-to-fit inner wrapper; only fill the wrapper when an explicit width is set.
      inner.style.display = 'inline-block';
      inner.style.maxWidth = '100%';
      if (width) inner.style.width = '100%';
    } else {
      inner.style.display = 'inline-block';
      inner.style.maxWidth = '100%';
      if (width) inner.style.width = width;
      // Alignment is handled by wrap.style.textAlign in block mode.
    }

    // If we explicitly sized the figure (block + width), make the image fill the inner width.
    if (placement !== 'inline' && width) {
      img.style.width = '100%';
      img.style.maxWidth = '100%';
    }

    const caption = document.createElement('div');
    caption.textContent = this.alt || 'Figure';
    caption.style.marginTop = '6px';
    caption.style.fontSize = '12px';
    caption.style.color = '#9aa0a6';
    caption.style.fontStyle = 'italic';
    // Product rule: caption text centered relative to the image width (via inner wrapper)
    caption.style.textAlign = 'center';
    caption.style.display = 'block';
    caption.style.width = '100%';
    // Ensure long captions wrap within the figure width (never overflow wider than the image).
    caption.style.whiteSpace = 'normal';
    (caption.style as unknown as { overflowWrap?: string }).overflowWrap = 'anywhere';
    caption.style.wordBreak = 'break-word';

    inner.appendChild(img);
    inner.appendChild(caption);
    wrap.appendChild(inner);

    // Hover toolbar (quick controls)
    const hoverBar = document.createElement('div');
    hoverBar.style.position = 'absolute';
    hoverBar.style.top = '8px';
    hoverBar.style.right = '8px';
    hoverBar.style.display = 'flex';
    hoverBar.style.gap = '6px';
    hoverBar.style.padding = '6px';
    hoverBar.style.borderRadius = '8px';
    hoverBar.style.border = '1px solid rgba(255,255,255,0.10)';
    hoverBar.style.background = 'rgba(20,20,22,0.9)';
    hoverBar.style.backdropFilter = 'blur(6px)';
    hoverBar.style.zIndex = '2';
    hoverBar.style.alignItems = 'center';
    hoverBar.style.flexWrap = 'nowrap';
    // Keep the hover menu compact/squarish by constraining width so icons wrap.
    hoverBar.style.width = '160px';
    hoverBar.style.maxWidth = '160px';
    hoverBar.style.justifyContent = 'center';
    hoverBar.style.fontSize = '11px';
    hoverBar.style.color = '#cfcfcf';
    // Use separate lines/rows for related options.
    hoverBar.style.flexDirection = 'column';
    hoverBar.style.visibility = 'hidden';

    const makeIconBtn = (opts: { label: string; svg: string; selected?: boolean }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', opts.label);
      b.title = opts.label;
      const selected = Boolean(opts.selected);
      b.className =
        'w-7 h-7 flex items-center justify-center rounded border border-vscode-border transition-colors ' +
        (selected
          ? 'bg-vscode-active text-vscode-text'
          : 'bg-transparent text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-buttonHoverBg');
      const span = document.createElement('span');
      span.innerHTML = opts.svg;
      b.appendChild(span);
      return b;
    };

    const makeRow = () => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.justifyContent = 'center';
      row.style.width = '100%';
      return row;
    };

    const applyAttrUpdate = (updates: { align?: string | null; width?: string | null; placement?: string | null; desc?: string | null; caption?: string | null; src?: string | null }) => {
      const currentCaption = (updates.caption ?? this.alt ?? 'Figure').trim() || 'Figure';
      const currentDesc = updates.desc ?? this.desc ?? '';
      const currentSrc = updates.src ?? this.rawUrl;
      const cleaned = stripAttrKeys(baseAttrs, ['align', 'width', 'placement', 'desc']);
      let nextAttrs = cleaned;
      if (updates.align !== undefined) nextAttrs = upsertAttr(nextAttrs, 'align', updates.align);
      else if (align) nextAttrs = upsertAttr(nextAttrs, 'align', align);
      if (updates.width !== undefined) nextAttrs = upsertAttr(nextAttrs, 'width', updates.width);
      else if (width) nextAttrs = upsertAttr(nextAttrs, 'width', width);
      if (updates.placement !== undefined) nextAttrs = upsertAttr(nextAttrs, 'placement', updates.placement);
      else if (placement) nextAttrs = upsertAttr(nextAttrs, 'placement', placement);
      if (currentDesc && currentDesc.trim().length > 0) nextAttrs = upsertAttr(nextAttrs, 'desc', currentDesc);

      const attrBlock = nextAttrs.trim().length > 0 ? `{${nextAttrs.trim()}}` : '';
      const nextText = `![${currentCaption}](${currentSrc})${attrBlock}`;
      view.dispatch({ changes: { from: this.from, to: this.to, insert: nextText } });
    };

    const icon = {
      edit:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M11.5 2.5l2 2L6 12H4v-2L11.5 2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<path d="M10.5 3.5l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      regen:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M13 3v4H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M13 7a5 5 0 1 0 1 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      trash:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M3 5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6 5v8m4-8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6 3h4l1 2H5l1-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '</svg>',
      alignLeft:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M2 7h8M2 11h10M2 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      alignCenter:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M4 7h8M3 11h10M5 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      alignRight:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M6 7h8M3 11h11M8 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      sizeS:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5.5" y="5.5" width="5" height="5" stroke="currentColor" stroke-width="1.5" />' +
        '</svg>',
      sizeM:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="4" y="4" width="8" height="8" stroke="currentColor" stroke-width="1.5" />' +
        '</svg>',
      sizeL:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2.5" y="2.5" width="11" height="11" stroke="currentColor" stroke-width="1.5" />' +
        '</svg>',
      inline:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2.5" y="5" width="5" height="6" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="8.5" y="5" width="5" height="6" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      block:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="2.5" width="10" height="4" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="3" y="9.5" width="10" height="4" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
    };

    const currentPlacement = placement === 'inline' ? 'inline' : 'block';
    const currentAlign = (align ?? (currentPlacement === 'inline' ? 'left' : 'left')) as 'left' | 'center' | 'right';
    const currentPct = parsePercentWidth(width);

    // Editing controls in hover bar so they're always accessible (including inline placement).
    const btnEditIcon = makeIconBtn({ label: 'Edit', svg: icon.edit });
    const btnRegenIcon = makeIconBtn({ label: 'Regenerate', svg: icon.regen });
    const btnTrashIcon = makeIconBtn({ label: 'Delete', svg: icon.trash });

    const btnLeft = makeIconBtn({ label: 'Align left', svg: icon.alignLeft, selected: currentAlign === 'left' });
    const btnCenter = makeIconBtn({ label: 'Align center', svg: icon.alignCenter, selected: currentAlign === 'center' });
    const btnRight = makeIconBtn({ label: 'Align right', svg: icon.alignRight, selected: currentAlign === 'right' });
    btnLeft.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      applyAttrUpdate({ align: 'left' });
    });
    btnCenter.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      applyAttrUpdate({ align: 'center' });
    });
    btnRight.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      applyAttrUpdate({ align: 'right' });
    });

    const btnS = makeIconBtn({ label: 'Size small (33%)', svg: icon.sizeS, selected: currentPct === 33 });
    const btnM = makeIconBtn({ label: 'Size medium (50%)', svg: icon.sizeM, selected: currentPct === 50 });
    const btnL = makeIconBtn({ label: 'Size large (100%)', svg: icon.sizeL, selected: currentPct === 100 });
    btnS.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ width: '33%' }); });
    btnM.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ width: '50%' }); });
    btnL.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ width: '100%' }); });

    const iconMinus =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
    const iconPlus =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M8 3.5v9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';

    const btnSmaller = makeIconBtn({ label: 'Decrease size (-10%)', svg: iconMinus });
    const btnLarger = makeIconBtn({ label: 'Increase size (+10%)', svg: iconPlus });
    const stepPct = 10;
    const minPct = 10;
    const maxPct = 100;

    const stepWidth = (delta: number) => {
      const currentPct = parsePercentWidth(width) ?? 50;
      const nextPct = clamp(currentPct + delta, minPct, maxPct);
      applyAttrUpdate({ width: formatPercentWidth(nextPct) });
    };

    btnSmaller.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stepWidth(-stepPct);
    });

    btnLarger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stepWidth(stepPct);
    });

    const btnInline = makeIconBtn({ label: 'Placement inline', svg: icon.inline, selected: currentPlacement === 'inline' });
    const btnBlock = makeIconBtn({ label: 'Placement block', svg: icon.block, selected: currentPlacement === 'block' });
    btnInline.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ placement: 'inline' }); });
    btnBlock.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ placement: 'block' }); });

    const rowActions = makeRow();
    rowActions.appendChild(btnEditIcon);
    rowActions.appendChild(btnRegenIcon);
    rowActions.appendChild(btnTrashIcon);

    const rowAlign = makeRow();
    rowAlign.appendChild(btnLeft);
    rowAlign.appendChild(btnCenter);
    rowAlign.appendChild(btnRight);

    const rowSize = makeRow();
    rowSize.appendChild(btnSmaller);
    rowSize.appendChild(btnS);
    rowSize.appendChild(btnM);
    rowSize.appendChild(btnL);
    rowSize.appendChild(btnLarger);

    const rowPlacement = makeRow();
    rowPlacement.appendChild(btnInline);
    rowPlacement.appendChild(btnBlock);

    hoverBar.appendChild(rowActions);
    hoverBar.appendChild(rowAlign);
    hoverBar.appendChild(rowSize);
    hoverBar.appendChild(rowPlacement);
    wrap.appendChild(hoverBar);

    wrap.addEventListener('mouseenter', () => {
      hoverBar.style.visibility = 'visible';
    });
    wrap.addEventListener('mouseleave', () => {
      hoverBar.style.visibility = 'hidden';
    });

    const buttonClass =
      'px-2 py-1 text-xs rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text ' +
      'hover:bg-vscode-buttonHoverBg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.textContent = 'Edit';
    btnEdit.className = `cm-embedded-figure-btn ${buttonClass}`;

    const btnRegenerate = document.createElement('button');
    btnRegenerate.type = 'button';
    btnRegenerate.textContent = 'Regenerate';
    btnRegenerate.className = `cm-embedded-figure-btn ${buttonClass}`;

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.textContent = 'Delete';
    btnDelete.className = `cm-embedded-figure-btn ${buttonClass} text-red-200 hover:bg-red-900/30`;

    const editor = document.createElement('div');
    editor.style.display = 'none';
    editor.style.marginTop = '8px';
    editor.style.borderTop = '1px solid rgba(255,255,255,0.08)';
    editor.style.paddingTop = '8px';

    const captionLabel = document.createElement('div');
    captionLabel.textContent = 'Caption';
    captionLabel.style.fontSize = '11px';
    captionLabel.style.color = '#9aa0a6';
    captionLabel.style.marginBottom = '4px';
    editor.appendChild(captionLabel);

    const captionInput = document.createElement('input');
    captionInput.value = this.alt || '';
    captionInput.style.width = '100%';
    captionInput.style.background = '#0b0b0c';
    captionInput.style.color = '#e5e7eb';
    captionInput.style.border = '1px solid rgba(255,255,255,0.12)';
    captionInput.style.borderRadius = '6px';
    captionInput.style.padding = '6px 8px';
    editor.appendChild(captionInput);

    const descLabel = document.createElement('div');
    descLabel.textContent = 'Description (for regenerate)';
    descLabel.style.fontSize = '11px';
    descLabel.style.color = '#9aa0a6';
    descLabel.style.marginTop = '8px';
    descLabel.style.marginBottom = '4px';
    editor.appendChild(descLabel);

    const descInput = document.createElement('textarea');
    descInput.value = this.desc || '';
    descInput.rows = 3;
    descInput.style.width = '100%';
    descInput.style.background = '#0b0b0c';
    descInput.style.color = '#e5e7eb';
    descInput.style.border = '1px solid rgba(255,255,255,0.12)';
    descInput.style.borderRadius = '6px';
    descInput.style.padding = '6px 8px';
    editor.appendChild(descInput);

    const editorActions = document.createElement('div');
    editorActions.style.display = 'flex';
    editorActions.style.gap = '8px';
    editorActions.style.marginTop = '8px';

    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.textContent = 'Save';
    btnSave.className = `cm-embedded-figure-btn ${buttonClass} bg-vscode-blue hover:bg-blue-600 text-white border-transparent`;

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.textContent = 'Cancel';
    btnCancel.className = `cm-embedded-figure-btn ${buttonClass}`;

    editorActions.appendChild(btnSave);
    editorActions.appendChild(btnCancel);
    editor.appendChild(editorActions);
    wrap.appendChild(editor);

    const setBusy = (busy: boolean) => {
      btnEdit.disabled = busy;
      btnRegenerate.disabled = busy;
      btnDelete.disabled = busy;
      btnSave.disabled = busy;
      btnCancel.disabled = busy;
      img.style.opacity = busy ? '0.6' : '1';
    };

    const rebuildMarkdown = (nextSrc: string, nextCaption: string, nextDesc: string) => {
      const cleaned = stripAttrKeys(baseAttrs, ['desc']);
      const withDesc = nextDesc.trim().length > 0 ? upsertAttr(cleaned, 'desc', nextDesc) : cleaned;
      const attrBlock = withDesc.trim().length > 0 ? `{${withDesc.trim()}}` : '';
      return `![${nextCaption}](${nextSrc})${attrBlock}`;
    };

    btnEdit.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
      if (editor.style.display !== 'none') {
        captionInput.focus();
        captionInput.select();
      }
    });

    btnEditIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btnEdit.click();
    });

    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      captionInput.value = this.alt || '';
      descInput.value = this.desc || '';
      editor.style.display = 'none';
    });

    btnSave.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nextCaption = captionInput.value.trim() || 'Figure';
      const nextDesc = descInput.value;
      const nextText = rebuildMarkdown(this.rawUrl, nextCaption, nextDesc);
      view.dispatch({ changes: { from: this.from, to: this.to, insert: nextText } });
    });

    btnDelete.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const doc = view.state.doc;
      const line = doc.lineAt(this.from);
      // Remove the entire line containing the figure markdown to avoid leaving behind blank lines.
      const from = line.from;
      const to = Math.min(doc.length, line.to + (line.to < doc.length ? 1 : 0));
      view.dispatch({ changes: { from, to, insert: '' } });
    });

    btnTrashIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btnDelete.click();
    });

    btnRegenerate.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        setBusy(true);
        const baseParts: string[] = [];
        baseParts.push('Create a clean, publication-ready figure image.');
        baseParts.push('Style: minimal, high contrast, no watermark.');
        baseParts.push('IMPORTANT: Do NOT include any text, labels, numbers, legends, or watermarks inside the image.');
        const promptParts: string[] = [];
        const d = (descInput.value || this.desc || '').trim();
        if (d) promptParts.push(d);
        const c = (captionInput.value || this.alt || '').trim();
        if (c) promptParts.push(`Caption: ${c}`);
        const prompt = [...baseParts, ...promptParts].join('\n\n');
        const res = await api.ai.images.generate({ prompt, model: 'auto' });
        // If this figure is already stored as an asset ref, upload the new image as an asset too.
        // Otherwise, fall back to embedding data: (legacy docs).
        let nextSrc = `data:${res.mimeType};base64,${res.b64}`;
        if (this.rawUrl.startsWith('zadoox-asset://')) {
          const key = this.rawUrl.slice('zadoox-asset://'.length);
          const docId = key.split('__')[0] || '';
          if (docId) {
            const asset = await api.assets.upload({ documentId: docId, b64: res.b64, mimeType: res.mimeType });
            nextSrc = asset.ref;
          }
        }
        const nextCaption = (captionInput.value || this.alt || 'Figure').trim() || 'Figure';
        const nextDesc = descInput.value || this.desc || '';
        const nextText = rebuildMarkdown(nextSrc, nextCaption, nextDesc);
        view.dispatch({ changes: { from: this.from, to: this.to, insert: nextText } });
      } finally {
        setBusy(false);
      }
    });

    btnRegenIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Reuse the existing handler for consistent behavior.
      btnRegenerate.click();
    });

    return wrap;
  }
}

/**
 * Renders previews for embedded base64 images in markdown like:
 * ![Alt](data:image/png;base64,AAAA...)
 *
 * - Visually collapses the long base64 payload to an ellipsis so the editor doesn't show a giant string.
 * - Adds a block image preview widget under the line.
 */
export function embeddedImagePreviewExtension() {
  const buildDecorations = (state: EditorView['state']): DecorationSet => {
    const doc = state.doc;
    const text = doc.toString();
    if (!text.includes('data:image/') && !text.includes('zadoox-asset://')) {
      return Decoration.none;
    }

    const resolveSrc = (url: string): string => {
      const trimmed = (url || '').trim();
      if (trimmed.startsWith('zadoox-asset://')) {
        // We'll load this via fetch+Authorization and set a blob URL on the client.
        return '';
      }
      return trimmed;
    };

    // Capture optional attribute block after the image.
    // Supports:
    // - data:image/...;base64,...
    // - zadoox-asset://<key> (stored in Supabase Storage, fetched via backend)
    const re =
      /!\[([^\]]*)\]\(((?:data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)|(?:zadoox-asset:\/\/[^)\s]+))\)\s*(\{(?:\{REF\}|\{CH\}|[^}])*\})?/g;

    const decos = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const alt = (m[1] || '').trim();
      const rawUrl = (m[2] || '').trim();
      const src = resolveSrc(rawUrl);
      const attrs = (m[3] || '').trim();
      const desc = attrs ? parseAttrValue(attrs, 'desc') : null;
      const placement = attrs ? parseAttrValue(attrs, 'placement') : null;

      const matchStart = m.index;
      const matchText = m[0] || '';

      const matchEnd = matchStart + matchText.length;

      // Hide the entire markdown image token (B), and render a figure card instead.
      if (matchEnd > matchStart && matchEnd <= doc.length) {
        const attrsInner = attrs ? attrs.slice(1, -1) : null;
        decos.push(
          Decoration.replace({
            widget: new FigureCardWidget(
              rawUrl,
              src,
              alt || 'Figure',
              desc,
              attrsInner,
              matchStart,
              matchEnd
            ),
            block: placement !== 'inline',
          }).range(matchStart, matchEnd)
        );
      }
    }

    return Decoration.set(decos, true);
  };

  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state);
    },
    update(value, tr) {
      if (!tr.docChanged) return value;
      return buildDecorations(tr.state);
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [field];
}


