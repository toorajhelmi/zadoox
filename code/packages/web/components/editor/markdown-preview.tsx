'use client';

import { renderMarkdownToHtml, extractHeadings } from '@zadoox/shared';
import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
// KaTeX is loaded lazily so math rendering can never break the preview (figures/assets/etc).

interface MarkdownPreviewProps {
  content: string;
  /**
   * Optional pre-rendered HTML (e.g. IR -> HTML).
   * When provided, we skip Markdown parsing and just run the shared post-processing steps
   * (asset URL rewrite, citation linking, etc).
   */
  htmlOverride?: string;
  /**
   * Optional documentId for resolving LaTeX bundle assets when rendering IR previews.
   */
  latexDocId?: string;
  /**
   * Optional KaTeX macros map (math-only), typically extracted from LaTeX preamble.
   * Unknown macros remain red; this only helps for simple \newcommand/\def cases.
   */
  katexMacros?: Record<string, string>;
}

const TRANSPARENT_PIXEL =
  // 1x1 transparent GIF
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

export function MarkdownPreview({ content, htmlOverride, latexDocId, katexMacros }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [figureBgDefault] = useState<'dark' | 'light'>(() => {
    // Default to light so black-on-transparent plots remain readable.
    if (typeof window === 'undefined') return 'light';
    const v = window.localStorage.getItem('zx.preview.figureBg');
    if (v === 'dark' || v === 'light') return v;
    try {
      window.localStorage.setItem('zx.preview.figureBg', 'light');
    } catch {
      // ignore
    }
    return 'light';
  });
  const assetUrlCacheRef = useRef<Map<string, string>>(new Map());
  const assetInFlightRef = useRef<Set<string>>(new Set());
  const latexAssetUrlCacheRef = useRef<Map<string, { url: string; contentType: string }>>(new Map());
  const latexAssetInFlightRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const html = useMemo(() => {
    if (!content.trim() && !htmlOverride?.trim()) {
      return '';
    }
    
    let htmlContent = htmlOverride?.trim().length ? htmlOverride : renderMarkdownToHtml(content);
    
    // If we're rendering from raw markdown, add heading IDs for outline navigation.
    if (!htmlOverride?.trim().length) {
      const headings = extractHeadings(content);
      headings.forEach((heading) => {
        const headingTag = `h${heading.level}`;
        const escapedText = heading.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`<${headingTag}>${escapedText}</${headingTag}>`);
        htmlContent = htmlContent.replace(regex, `<${headingTag} id="${heading.id}">${heading.text}</${headingTag}>`);
      });
    }
    
    // Add IDs to reference entries in References section FIRST (before converting citations to links)
    // This ensures references have IDs before citations link to them
    const referencesSectionMatch = htmlContent.match(/(<h2[^>]*>References<\/h2>)([\s\S]*?)(?=<h[1-6]|<\/div>|$)/i);
    if (referencesSectionMatch) {
      let referencesContent = referencesSectionMatch[2];
      let refNumber = 1;
      const sanitizeKey = (raw: string): string =>
        String(raw ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      
      // First, handle numbered/IEEE format: [1] ..., [2] ...
      // References might be in separate paragraphs OR in the same paragraph separated by <br />
      // We need to handle both cases:
      // Case 1: <p>[1] text</p><p>[2] text</p> (separate paragraphs)
      // Case 2: <p>[1] text<br />[2] text</p> (same paragraph with breaks)
      
      // First, handle separate paragraphs starting with [number]
      referencesContent = referencesContent.replace(
        /<p([^>]*)>\[(\d+)\]\s*/g,
        (match, attrs, number) => {
          // If attrs is empty, just add id and class
          if (!attrs || attrs.trim() === '') {
            return `<p id="ref-${number}" class="reference-entry">[${number}] `;
          } else {
            // Preserve existing attributes but add id (if not present) and class
            const hasId = /id=/.test(attrs);
            const hasClass = /class=/.test(attrs);
            if (!hasId) {
              return `<p id="ref-${number}" ${hasClass ? '' : 'class="reference-entry" '}${attrs}>[${number}] `;
            } else {
              // ID already exists, just ensure class is present
              return `<p ${attrs}${hasClass ? '' : ' class="reference-entry"'}>[${number}] `;
            }
          }
        }
      );
      
      // Then, handle references that appear after <br /> tags (same paragraph case)
      // Match <br /> followed by [number] - convert to separate paragraph with ID
      // So we'll convert <br />[number] to </p><p id="ref-X">[number]
      referencesContent = referencesContent.replace(
        /<br\s*\/?>\s*\[(\d+)\]\s*/g,
        (match, number) => {
          // Close the previous paragraph and start a new one with the ID
          return `</p><p id="ref-${number}" class="reference-entry">[${number}] `;
        }
      );
      
      // Then, for other formats (APA, MLA, Chicago, footnote), number them sequentially
      // Only process paragraphs that don't already have an id (were not processed above)
      referencesContent = referencesContent.replace(
        /<p(?!\s+id=)([^>]*)>([^<]+)<\/p>/g,
        (match, attrs, content) => {
          // Skip if empty
          if (content.trim() === '') {
            return match;
          }
          // Add ID to this reference
          const id = `id="ref-${refNumber}"`;
          refNumber++;
          return `<p ${id} class="reference-entry"${attrs}>${content}</p>`;
        }
      );

      // Finally, handle BibTeX-key style: [vaswani2017attention] ...
      // Add id="refkey-<key>" so inline cite tokens can link to it.
      referencesContent = referencesContent.replace(
        /<p([^>]*)>\[([^\]]+)\]\s*/g,
        (match, attrs, key) => {
          const k = String(key ?? '').trim();
          // Keep numeric refs handled above
          if (/^\d+$/.test(k)) return match;
          const id = `refkey-${sanitizeKey(k)}`;
          const hasId = /id=/.test(attrs);
          const hasClass = /class=/.test(attrs);
          if (hasId) return match;
          const cls = hasClass ? '' : 'class="reference-entry" ';
          return `<p id="${id}" ${cls}${attrs}>[${k}] `;
        }
      );
      
      htmlContent = htmlContent.replace(referencesSectionMatch[0], referencesSectionMatch[1] + referencesContent);
    }
    
    // Convert citation markers [1], [2], etc. to clickable anchors
    // Match citations like [1], [2], [10], etc. but not those already in links
    // Also skip citations at the start of reference paragraphs (they're part of the reference format)
    let processedHtml = htmlContent;
    const citationMatches: Array<{ full: string; number: string; index: number }> = [];
    const citationRegex = /\[(\d+)\]/g;
    let match;
    
    // Find the References section boundaries
    const refSectionStart = htmlContent.indexOf('<h2') !== -1 ? htmlContent.indexOf('References</h2>') : -1;
    
    // Collect all citation matches with their positions
    while ((match = citationRegex.exec(htmlContent)) !== null) {
      const beforeText = htmlContent.substring(0, match.index);
      
      // Skip if already inside an <a> tag or inside code/pre blocks
      const lastOpenA = beforeText.lastIndexOf('<a');
      const lastCloseA = beforeText.lastIndexOf('</a>');
      const lastOpenPre = beforeText.lastIndexOf('<pre');
      const lastClosePre = beforeText.lastIndexOf('</pre>');
      const lastOpenCode = beforeText.lastIndexOf('<code');
      const lastCloseCode = beforeText.lastIndexOf('</code>');
      
      // Skip if inside a link (open tag without matching close)
      if (lastOpenA > lastCloseA) {
        continue;
      }
      
      // Skip if inside a <pre> block (open tag without matching close)
      if (lastOpenPre > lastClosePre) {
        continue;
      }
      
      // Skip if inside a <code> block (open tag without matching close)
      // Only check if we found an opening code tag
      if (lastOpenCode !== -1 && lastOpenCode > lastCloseCode) {
        continue;
      }
      
      // Skip if this citation is at the start of a reference paragraph (in References section)
      // Check if we're in the References section and the citation is part of a reference entry
      if (refSectionStart !== -1 && match.index > refSectionStart) {
        // Look backwards to find the nearest opening tag
        const beforeCitation = htmlContent.substring(Math.max(0, match.index - 200), match.index);
        const lastPTagIndex = beforeCitation.lastIndexOf('<p');
        if (lastPTagIndex !== -1) {
          const pTagAndAfter = beforeCitation.substring(lastPTagIndex);
          // Check if this is a reference entry paragraph (has id="ref-X" or class="reference-entry")
          if (/<p[^>]*(id="ref-|class="reference-entry")/.test(pTagAndAfter)) {
            // Extract what's between the <p> tag and the citation
            const pTagMatch = pTagAndAfter.match(/<p[^>]*>/);
            if (pTagMatch) {
              const betweenPAndCitation = pTagAndAfter.substring(pTagMatch[0].length);
              // If there's only whitespace between <p> tag and citation, it's at the start - skip it
              if (/^\s*$/.test(betweenPAndCitation)) {
                continue;
              }
            }
          }
        }
      }
      
      citationMatches.push({
        full: match[0],
        number: match[1],
        index: match.index,
      });
    }
    
    // Replace citations from end to start to preserve indices
    citationMatches.reverse().forEach((citation) => {
      const before = processedHtml.substring(0, citation.index);
      const after = processedHtml.substring(citation.index + citation.full.length);
      const linkHtml = `<a href="#ref-${citation.number}" class="citation-link" data-ref-number="${citation.number}">${citation.full}</a>`;
      processedHtml = before + linkHtml + after;
    });
    
    htmlContent = processedHtml;

    // IMPORTANT: Never leave <img src="zadoox-asset://..."> in the DOM.
    // Browsers treat that as an unknown URL scheme and will fail before our JS can swap it.
    // Instead, replace it with a placeholder src + a data-asset-key we can resolve.
    htmlContent = htmlContent.replace(
      /<img([^>]*?)\s+src="zadoox-asset:\/\/([^"]+)"([^>]*)>/gim,
      (_m, preAttrs, key, postAttrs) =>
        `<img${preAttrs} src="${TRANSPARENT_PIXEL}" data-asset-key="${String(key)}"${postAttrs}>`
    );
    
    return htmlContent;
  }, [content, htmlOverride]);

  // Track auth token so asset fetching can retry when a session becomes available.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setAccessToken(session?.access_token ?? null);
    })();

    // IMPORTANT: don't detach the method from `supabase.auth` (it relies on `this` internally).
    const maybeOnAuthStateChange = (supabase.auth as unknown as { onAuthStateChange?: unknown }).onAuthStateChange;
    const sub =
      typeof maybeOnAuthStateChange === 'function'
        ? (supabase.auth as unknown as {
            onAuthStateChange: (cb: (event: unknown, session: { access_token?: string } | null) => void) => {
              data: { subscription: { unsubscribe: () => void } };
            };
          }).onAuthStateChange((_event, session) => {
            if (cancelled) return;
            setAccessToken(session?.access_token ?? null);
          })
        : null;

    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  // Resolve zadoox-asset:// images by fetching from backend with Authorization header.
  // This avoids relying on cookie-based sessions for <img src> requests.
  const clampFigureCaptionsToImageWidth = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const figures = Array.from(container.querySelectorAll('.figure-inner')) as HTMLElement[];
    for (const inner of figures) {
      const img = inner.querySelector('img') as HTMLImageElement | null;
      const caption = inner.querySelector('.figure-caption') as HTMLElement | null;
      if (!img || !caption) continue;

      const apply = () => {
        const w = img.getBoundingClientRect().width;
        if (!Number.isFinite(w) || w <= 0) return;
        // Constrain caption to the *rendered* image width (important when images are scaled by height).
        caption.style.maxWidth = `${w}px`;
        caption.style.marginLeft = 'auto';
        caption.style.marginRight = 'auto';
      };

      if (img.complete) {
        apply();
      } else {
        img.addEventListener('load', apply, { once: true });
      }
    }
  }, []);

  const applyGridIntrinsicPercentSizing = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const inners = Array.from(container.querySelectorAll('span.figure-inner')) as HTMLSpanElement[];
    if (inners.length === 0) return;

    const pctFromStyle = (s: string): number | null => {
      const t = String(s || '');
      const m = /\b(?:width|max-width)\s*:\s*(\d+(?:\.\d+)?)%\b/i.exec(t);
      if (!m) return null;
      const n = Number(m[1]);
      if (!Number.isFinite(n) || n <= 0 || n >= 100) return null;
      return Math.round(n);
    };

    for (const inner of inners) {
      const inGrid = Boolean(inner.closest('.xmd-grid'));
      if (!inGrid) continue;

      const pct =
        (() => {
          const tagged = inner.getAttribute('data-zx-width-pct');
          const nTagged = tagged ? Number(tagged) : NaN;
          if (Number.isFinite(nTagged) && nTagged > 0 && nTagged < 100) return Math.round(nTagged);
          const fromInner = pctFromStyle(inner.getAttribute('style') || '');
          if (fromInner) return fromInner;
          const img0 = inner.querySelector('img') as HTMLImageElement | null;
          const fromImg = img0 ? pctFromStyle(img0.getAttribute('style') || '') : null;
          return fromImg;
        })() ?? NaN;
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) continue;

      const img = inner.querySelector('img') as HTMLImageElement | null;
      if (!img) continue;

      const apply = () => {
        const nw = img.naturalWidth || 0;
        if (!Number.isFinite(nw) || nw <= 0) return;

        // Match MD edit mode behavior:
        // - % is intrinsic scaling
        // - cap to available width (use the grid width when available)
        const grid = inner.closest('.xmd-grid') as HTMLElement | null;
        const baseW = grid ? grid.getBoundingClientRect().width : container.getBoundingClientRect().width;
        const maxW = Math.max(1, Math.floor(baseW - 32));
        const target = Math.max(1, Math.round((nw * pct) / 100));
        const px = Math.min(target, maxW);

        inner.style.width = `${px}px`;
        inner.style.maxWidth = `${px}px`;
        img.style.width = `${px}px`;
        img.style.maxWidth = `${px}px`;
        img.style.height = 'auto';
      };

      // Apply immediately if possible.
      if (img.complete) apply();

      // Ensure we re-apply when the real asset image loads (src may be swapped from placeholder).
      if (img.getAttribute('data-zx-pct-listener') !== '1') {
        img.setAttribute('data-zx-pct-listener', '1');
        img.addEventListener('load', apply);
      }
    }
  }, []);

  const resolveAssetImages = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    const token = accessToken;
    if (!token) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    if (!abortRef.current) abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    const assetImgs = imgs.filter((img) => {
      const key = img.dataset.assetKey;
      if (!key) return false;
      // Only try to resolve if still on placeholder or missing.
      const src = img.getAttribute('src') || '';
      return src === TRANSPARENT_PIXEL || src.trim() === '';
    });
    if (assetImgs.length === 0) return;

    await Promise.all(
      assetImgs.map(async (img) => {
        const key = img.dataset.assetKey || '';
        if (!key) return;

        const cached = assetUrlCacheRef.current.get(key);
        if (cached) {
          img.src = cached;
          return;
        }

        if (assetInFlightRef.current.has(key)) return;
        assetInFlightRef.current.add(key);
        try {
          const res = await fetch(`${API_BASE}/assets/${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal,
          });
          if (!res.ok) return;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          assetUrlCacheRef.current.set(key, url);
          img.src = url;
          // After setting the final src, clamp caption width to the rendered image width.
          // (The browser may scale the image by max-height, so measured width is what matters.)
          clampFigureCaptionsToImageWidth();
          applyGridIntrinsicPercentSizing();
        } catch {
          // ignore
        } finally {
          assetInFlightRef.current.delete(key);
        }
      })
    );
  }, [accessToken, clampFigureCaptionsToImageWidth, applyGridIntrinsicPercentSizing]);

  const resolveLatexAssetImages = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    const token = accessToken;
    if (!token) return;
    if (!latexDocId) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    if (!abortRef.current) abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    const latexImgs = imgs.filter((img) => {
      const p = img.dataset.zxAssetPath;
      if (!p) return false;
      const src = img.getAttribute('src') || '';
      return src === TRANSPARENT_PIXEL || src.trim() === '';
    });

    const pdfObjects = Array.from(container.querySelectorAll('object.latex-figure-pdf')) as HTMLObjectElement[];
    const latexObjs = pdfObjects.filter((obj) => {
      const p = obj.getAttribute('data-zx-asset-path') || '';
      if (!p) return false;
      const data = obj.getAttribute('data') || '';
      return data === TRANSPARENT_PIXEL || data.trim() === '';
    });

    if (latexImgs.length === 0 && latexObjs.length === 0) return;

    const asPdfObject = (p: string, url: string): HTMLObjectElement => {
      const obj = document.createElement('object');
      obj.className = 'latex-figure-pdf';
      obj.setAttribute('data-zx-asset-path', p);
      obj.setAttribute('type', 'application/pdf');
      obj.setAttribute('data', url);
      obj.setAttribute(
        'style',
        'width:min(900px,100%);height:520px;display:block;border:1px solid rgba(255,255,255,0.12);border-radius:8px'
      );
      return obj;
    };

    await Promise.all(
      [...latexImgs.map((img) => ({ kind: 'img' as const, el: img })), ...latexObjs.map((obj) => ({ kind: 'obj' as const, el: obj }))].map(async (item) => {
        const p =
          item.kind === 'img' ? (item.el as HTMLImageElement).dataset.zxAssetPath || '' : (item.el as HTMLObjectElement).getAttribute('data-zx-asset-path') || '';
        if (!p) return;

        const cached = latexAssetUrlCacheRef.current.get(p);
        if (cached) {
          if (cached.contentType.includes('application/pdf')) {
            if (item.kind === 'img') {
              const imgEl = item.el as HTMLImageElement;
              imgEl.replaceWith(asPdfObject(p, cached.url));
            } else {
              (item.el as HTMLObjectElement).setAttribute('data', cached.url);
            }
          } else {
            if (item.kind === 'img') (item.el as HTMLImageElement).src = cached.url;
            else (item.el as HTMLObjectElement).setAttribute('data', cached.url);
          }
          return;
        }

        if (latexAssetInFlightRef.current.has(p)) return;
        latexAssetInFlightRef.current.add(p);
        try {
          const url = `${API_BASE}/documents/${encodeURIComponent(latexDocId)}/latex/file?path=${encodeURIComponent(p)}`;
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
          if (!res.ok) return;
          const blob = await res.blob();
          const objUrl = URL.createObjectURL(blob);
          const contentType = (res.headers.get('Content-Type') || blob.type || '').toLowerCase();
          latexAssetUrlCacheRef.current.set(p, { url: objUrl, contentType });
          if (contentType.includes('application/pdf')) {
            if (item.kind === 'img') {
              const imgEl = item.el as HTMLImageElement;
              imgEl.replaceWith(asPdfObject(p, objUrl));
            } else {
              (item.el as HTMLObjectElement).setAttribute('data', objUrl);
            }
          } else {
            if (item.kind === 'img') (item.el as HTMLImageElement).src = objUrl;
            else (item.el as HTMLObjectElement).setAttribute('data', objUrl);
          }
          clampFigureCaptionsToImageWidth();
          applyGridIntrinsicPercentSizing();
        } catch {
          // ignore
        } finally {
          latexAssetInFlightRef.current.delete(p);
        }
      })
    );
  }, [accessToken, latexDocId, clampFigureCaptionsToImageWidth, applyGridIntrinsicPercentSizing]);

  useEffect(() => {
    void resolveAssetImages();
    void resolveLatexAssetImages();
  }, [html, accessToken, resolveAssetImages, resolveLatexAssetImages]);

  // Add per-figure background toggle buttons (and apply default background) after each HTML change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ensureFigureButtons = () => {
      // Some figures may not have the expected wrapper; normalize:
      // - Ensure media (<img>/<object>) is wrapped in .zx-figure-media-frame
      // - Ensure each frame has a .zx-figure-bg-toggle button
      const figureInners = Array.from(container.querySelectorAll('.figure-inner')) as HTMLElement[];
      for (const inner of figureInners) {
        const media = inner.querySelector('img, object') as HTMLElement | null;
        if (!media) continue;
        const existingFrame = media.closest('.zx-figure-media-frame') as HTMLElement | null;
        let frame = existingFrame;
        if (!frame) {
          frame = document.createElement('span');
          frame.className = 'zx-figure-media-frame';
          media.replaceWith(frame);
          frame.appendChild(media);
        }
        if (figureBgDefault === 'light') frame.classList.add('zx-figure-frame-light');
        else frame.classList.remove('zx-figure-frame-light');

        if (!frame.querySelector('.zx-figure-bg-toggle')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'zx-figure-bg-toggle';
          btn.textContent = 'Bg';
          btn.setAttribute('aria-label', 'Toggle figure background');
          frame.appendChild(btn);
        }
      }
    };

    try {
      ensureFigureButtons();
    } catch {
      // ignore
    }

    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('.zx-figure-bg-toggle') as HTMLButtonElement | null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const frame = btn.closest('.zx-figure-media-frame') as HTMLElement | null;
      if (!frame) return;
      frame.classList.toggle('zx-figure-frame-light');
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [html, figureBgDefault]);

  const katexRef = useRef<any>(null);
  const katexLoadPromiseRef = useRef<Promise<any> | null>(null);
  const loadKatex = useCallback(async (): Promise<any | null> => {
    if (katexRef.current) return katexRef.current;
    if (!katexLoadPromiseRef.current) {
      katexLoadPromiseRef.current = (async () => {
        // Import the ESM bundle; it exports { default }.
        const mod: any = await import('katex/dist/katex.mjs');
        const k = mod?.default ?? mod;
        katexRef.current = k;
        return k;
      })();
    }
    try {
      return await katexLoadPromiseRef.current;
    } catch {
      return null;
    }
  }, []);

  const typesetMath = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const codeNodes = Array.from(container.querySelectorAll('.math-latex')) as HTMLElement[];
    const blockNodes = Array.from(container.querySelectorAll('div.math-block')) as HTMLElement[];
    const nodes: HTMLElement[] = [...codeNodes];
    for (const b of blockNodes) {
      // Some math blocks might not include the <code.math-latex> wrapper (e.g. legacy/alternate HTML).
      // If so, typeset the whole block.
      if (!b.querySelector('.math-latex')) nodes.push(b);
    }
    if (nodes.length === 0) return;

    const normalizeTex = (raw: string, isDisplay: boolean): string => {
      let tex = String(raw ?? '').trim();
      if (!tex) return tex;
      // Normalize common variants
      tex = tex.replace(/\\newline\b/g, '\\\\');
      // Trim trailing line breaks that often appear in extracted align blocks
      tex = tex.replace(/\\\\\s*$/g, '');
      // If this looks like an aligned block but isn't wrapped, wrap it so KaTeX can parse & and \\.
      if (isDisplay && !/\\begin\{[a-zA-Z*]+\}/.test(tex) && (tex.includes('&') || tex.includes('\\\\'))) {
        tex = `\\begin{aligned}\n${tex}\n\\end{aligned}`;
      }
      // Light unicode normalization (helps with some PDF-ish extractions)
      tex = tex.replace(/−/g, '-').replace(/⋅/g, '\\cdot ');
      return tex;
    };
    void (async () => {
      const k = await loadKatex();
      if (!k) return;
      const render = k.render as ((tex: string, el: HTMLElement, opts: any) => void) | undefined;
      const renderToString = k.renderToString as ((tex: string, opts: any) => string) | undefined;
      if (!render && !renderToString) return;
      for (const el of nodes) {
        if (el.getAttribute('data-zx-math-rendered') === '1') continue;
        const displayMode = el.classList.contains('math-block') || Boolean(el.closest('.math-block'));
        const raw = el.getAttribute('data-zx-math-raw') ?? el.textContent ?? '';
        const tex = normalizeTex(raw, displayMode);
        try {
          const macros = katexMacros && Object.keys(katexMacros).length > 0 ? katexMacros : undefined;
          if (render) {
            render(tex, el, { throwOnError: false, displayMode, strict: 'ignore', ...(macros ? { macros } : null) });
          } else if (renderToString) {
            el.innerHTML = renderToString(tex, { throwOnError: false, displayMode, strict: 'ignore', ...(macros ? { macros } : null) });
          }
          if (!el.getAttribute('data-zx-math-raw')) {
            el.setAttribute('data-zx-math-raw', String(raw));
          }
          el.setAttribute('data-zx-math-rendered', '1');
        } catch {
          // ignore (math will remain as raw LaTeX)
        }
      }
    })();
  }, [katexMacros, loadKatex]);

  // If the preview DOM is replaced/reconciled (or images are inserted later),
  // keep resolving any placeholder asset images.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const obs = new MutationObserver(() => {
      void resolveAssetImages();
      void resolveLatexAssetImages();
      clampFigureCaptionsToImageWidth();
      applyGridIntrinsicPercentSizing();
      typesetMath();
      // If figures/media were inserted after initial HTML render, ensure per-figure Bg buttons exist.
      try {
        const frames = Array.from(container.querySelectorAll('.zx-figure-media-frame')) as HTMLElement[];
        for (const f of frames) {
          if (!f.querySelector('.zx-figure-bg-toggle')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'zx-figure-bg-toggle';
            btn.textContent = 'Bg';
            btn.setAttribute('aria-label', 'Toggle figure background');
            f.appendChild(btn);
          }
        }
      } catch {
        // ignore
      }
    });
    obs.observe(container, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
    };
  }, [resolveAssetImages, resolveLatexAssetImages, clampFigureCaptionsToImageWidth, applyGridIntrinsicPercentSizing, typesetMath]);

  // Also clamp captions after each HTML change (non-asset images / already-loaded images).
  useEffect(() => {
    clampFigureCaptionsToImageWidth();
    applyGridIntrinsicPercentSizing();
  }, [html, clampFigureCaptionsToImageWidth, applyGridIntrinsicPercentSizing]);

  // Typeset LaTeX math blocks after each HTML update.
  useEffect(() => {
    typesetMath();
  }, [html, typesetMath]);

  // Cleanup blob URLs + in-flight fetch on unmount
  useEffect(() => {
    const cache = assetUrlCacheRef.current;
    const latexCache = latexAssetUrlCacheRef.current;
    const inflight = assetInFlightRef.current;
    const latexInflight = latexAssetInFlightRef.current;
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
      cache.clear();
      inflight.clear();
      for (const url of latexCache.values()) {
        URL.revokeObjectURL(url.url);
      }
      latexCache.clear();
      latexInflight.clear();
    };
  }, []);

  // Handle citation link clicks
  useEffect(() => {
    const handleCitationClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const citationLink = target.closest('.citation-link') as HTMLAnchorElement;
      
      if (citationLink) {
        e.preventDefault();
        const refNumber = citationLink.getAttribute('data-ref-number');
        if (refNumber) {
          const refId = `ref-${refNumber}`;
          const refElement = document.getElementById(refId);
          if (refElement) {
            // Scroll to the reference
            refElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight the reference temporarily
            refElement.classList.add('reference-highlight');
            setTimeout(() => {
              refElement.classList.remove('reference-highlight');
            }, 2000);
          }
        }
      }
    };

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('click', handleCitationClick as EventListener);
    return () => {
      container.removeEventListener('click', handleCitationClick as EventListener);
    };
  }, [html]);

  // Prevent normal markdown links from navigating away from the editor.
  // Instead, open external/relative links in a new tab; handle hash links as in-page scroll.
  useEffect(() => {
    const normalizeHref = (rawHref: string): string => {
      const href = rawHref.trim();
      if (!href) return href;

      // Already an absolute URL with scheme (http:, https:, mailto:, etc.)
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
        return href;
      }

      // Protocol-relative URL (//example.com)
      if (href.startsWith('//')) {
        return `https:${href}`;
      }

      // Common "bare domain" patterns (e.g. www.google.com) -> https://www.google.com
      if (/^www\./i.test(href)) {
        return `https://${href}`;
      }

      // If it looks like a domain (has a dot, no spaces, no leading slash), treat as https
      if (!href.startsWith('/') && href.includes('.') && !/\s/.test(href)) {
        return `https://${href}`;
      }

      // Otherwise leave as-is (relative paths remain relative)
      return href;
    };

    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a') as HTMLAnchorElement | null;
      if (!link) return;

      // Let citation handler manage citations (it calls preventDefault itself).
      if (link.classList.contains('citation-link')) {
        return;
      }

      const href = link.getAttribute('href') || '';
      if (!href) return;

      e.preventDefault();
      e.stopPropagation();

      // In-page anchors: scroll within preview
      if (href.startsWith('#')) {
        const id = href.slice(1);
        if (!id) return;
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Open in a new tab to avoid breaking the SPA route
      try {
        const normalizedHref = normalizeHref(href);
        const url = new URL(normalizedHref, window.location.origin);
        window.open(url.toString(), '_blank', 'noopener,noreferrer');
      } catch {
        // If URL parsing fails, just ignore (do not navigate away)
      }
    };

    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('click', handleLinkClick as EventListener);
    return () => {
      container.removeEventListener('click', handleLinkClick as EventListener);
    };
  }, [html]);

  if (!content.trim() && !htmlOverride?.trim()) {
    return (
      <div className="h-full flex items-center justify-center text-vscode-text-secondary">
        <p>No content to preview</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 bg-vscode-bg">
      <div
        ref={containerRef}
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          color: '#cccccc',
          fontFamily: 'var(--font-vscode, Consolas, Monaco, "Courier New", monospace)',
          lineHeight: '1.6',
        }}
      />
      <style jsx global>{`
        /* Figure background is controlled per-image via .zx-figure-frame-light. */
        .markdown-content .zx-figure-media-frame {
          position: relative;
          display: inline-block;
        }
        .markdown-content .zx-figure-media-frame.zx-figure-frame-light {
          background: #ffffff;
          padding: 8px;
          border-radius: 10px;
          display: inline-block;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
        }
        .markdown-content .zx-figure-media-frame.zx-figure-frame-light .latex-figure-pdf {
          border-color: rgba(0, 0, 0, 0.12) !important;
        }
        .markdown-content .zx-figure-bg-toggle {
          position: absolute;
          top: 6px;
          right: 6px;
          z-index: 5;
          font-size: 11px;
          line-height: 1;
          padding: 4px 6px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(0, 0, 0, 0.35);
          color: rgba(255, 255, 255, 0.92);
          cursor: pointer;
        }
        .markdown-content .zx-figure-media-frame.zx-figure-frame-light .zx-figure-bg-toggle {
          border-color: rgba(0, 0, 0, 0.12);
          background: rgba(255, 255, 255, 0.9);
          color: rgba(0, 0, 0, 0.75);
        }
        .markdown-content .doc-title {
          font-size: 2.2em;
          font-weight: 800;
          margin: 0.2em 0 0.7em 0;
          color: #ffffff;
        }
        .markdown-content .doc-author,
        .markdown-content .doc-date {
          color: #9aa0a6;
          font-size: 0.95em;
          margin: 0.1em 0;
          text-align: center;
        }
        .markdown-content .doc-authors {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 4px 16px;
          align-items: center;
          justify-items: center;
          margin: 0.1em 0;
        }
        .markdown-content .doc-authors .doc-author {
          margin: 0;
          text-align: center;
          width: 100%;
        }
        .markdown-content h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 1em 0 0.5em 0;
          color: #ffffff;
        }
        .markdown-content h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.8em 0 0.4em 0;
          color: #ffffff;
        }
        .markdown-content h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin: 0.6em 0 0.3em 0;
          color: #ffffff;
        }
        .markdown-content h4 {
          font-size: 1.1em;
          font-weight: bold;
          margin: 0.55em 0 0.25em 0;
          color: #ffffff;
        }
        .markdown-content h5 {
          font-size: 1.02em;
          font-weight: 800;
          margin: 0.5em 0 0.2em 0;
          color: #ffffff;
        }
        .markdown-content h6 {
          font-size: 0.98em;
          font-weight: 800;
          margin: 0.45em 0 0.2em 0;
          color: rgba(255, 255, 255, 0.92);
        }
        .markdown-content p {
          margin: 0.5em 0;
        }
        .markdown-content code {
          background-color: #3e3e42;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: var(--font-vscode, Consolas, Monaco, "Courier New", monospace);
        }
        .markdown-content pre {
          background-color: #252526;
          padding: 1em;
          border-radius: 4px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .markdown-content strong {
          font-weight: bold;
          color: #ffffff;
        }
        .markdown-content em {
          font-style: italic;
        }
        .markdown-content .figure-caption {
          /* Let the renderer control block/width via inline styles so captions align to image width */
          display: block;
          margin-top: 0.25em;
          color: #9aa0a6;
        }
        .markdown-content a {
          color: #4ec9b0;
          text-decoration: underline;
        }
        .markdown-content a:hover {
          color: #6ed4c0;
        }
        .markdown-content u {
          text-decoration: underline;
        }
        .markdown-content sup {
          vertical-align: super;
          font-size: 0.8em;
        }
        .markdown-content sub {
          vertical-align: sub;
          font-size: 0.8em;
        }
        .markdown-content .citation-link {
          color: #4ec9b0;
          text-decoration: underline;
          cursor: pointer;
          transition: color 0.2s;
        }
        .markdown-content .citation-link:hover {
          color: #6ed4c0;
          text-decoration: underline;
        }
        .markdown-content .reference-entry {
          transition: background-color 0.3s;
        }
        .markdown-content .reference-entry.reference-highlight {
          background-color: rgba(78, 201, 176, 0.2);
          padding: 0.2em 0.4em;
          border-radius: 4px;
          animation: highlight-fade 2s ease-out;
        }
        @keyframes highlight-fade {
          0% {
            background-color: rgba(78, 201, 176, 0.4);
          }
          100% {
            background-color: rgba(78, 201, 176, 0);
          }
        }
        .markdown-content .math-block {
          margin: 14px auto;
          padding: 10px 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          max-width: 100%;
          overflow-x: auto;
          font-family: var(--font-vscode, Consolas, Monaco, "Courier New", monospace);
        }
        .markdown-content .math-block .math-latex {
          white-space: pre;
          color: #e6e6e6;
        }
        .markdown-content .math-inline .math-latex {
          /* Inline math should not look like inline code. */
          background: transparent !important;
          padding: 0 !important;
          border-radius: 0 !important;
          font-family: inherit;
          white-space: normal;
        }
        .markdown-content code.math-latex {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 0 !important;
          font-family: inherit;
        }
        .markdown-content .raw-latex-block {
          opacity: 0.75;
        }
        .markdown-content .unrecognized-block {
          margin: 14px 0;
          padding: 10px 12px;
          border: 1px solid rgba(255, 165, 0, 0.35);
          border-radius: 10px;
          background: rgba(255, 165, 0, 0.06);
        }
        .markdown-content .unrecognized-badge {
          display: inline-block;
          font-size: 11px;
          letter-spacing: 0.02em;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255, 165, 0, 0.45);
          color: rgba(255, 215, 160, 0.95);
          margin-bottom: 8px;
        }
        .markdown-content .unrecognized-block pre {
          margin: 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
      `}</style>
    </div>
  );
}

