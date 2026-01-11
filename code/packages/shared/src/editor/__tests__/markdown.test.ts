import { describe, it, expect } from 'vitest';
import { parseMarkdown, renderMarkdownToHtml } from '../markdown';

describe('Markdown Utilities', () => {
  describe('parseMarkdown', () => {
    it('should parse markdown without placeholders', () => {
      const content = '# Title\n\nSome content';
      const result = parseMarkdown(content);

      expect(result.content).toBe(content);
      expect(result.hasPlaceholders).toBe(false);
      expect(result.placeholderTypes).toEqual([]);
    });

    it('should detect chapter placeholder', () => {
      const content = 'This is chapter {CH}';
      const result = parseMarkdown(content);

      expect(result.hasPlaceholders).toBe(true);
      expect(result.placeholderTypes).toContain('CH');
    });

    it('should detect reference placeholder', () => {
      const content = 'See section {REF}';
      const result = parseMarkdown(content);

      expect(result.hasPlaceholders).toBe(true);
      expect(result.placeholderTypes).toContain('REF');
    });

    it('should detect both placeholders', () => {
      const content = 'Chapter {CH}, Section {REF}';
      const result = parseMarkdown(content);

      expect(result.hasPlaceholders).toBe(true);
      expect(result.placeholderTypes).toContain('CH');
      expect(result.placeholderTypes).toContain('REF');
    });
  });

  describe('renderMarkdownToHtml', () => {
    it('should render headers', () => {
      const markdown = '# H1\n## H2\n### H3';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<h1>H1</h1>');
      expect(html).toContain('<h2>H2</h2>');
      expect(html).toContain('<h3>H3</h3>');
    });

    it('should render bold text', () => {
      const markdown = 'This is **bold** text';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<strong>bold</strong>');
    });

    it('should render italic text', () => {
      const markdown = 'This is *italic* text';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<em>italic</em>');
    });

    it('should render code blocks', () => {
      const markdown = '```\ncode here\n```';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<pre><code>');
      expect(html).toContain('code here');
    });

    it('should render inline code', () => {
      const markdown = 'Use `code` inline';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<code>code</code>');
    });

    it('should render links', () => {
      const markdown = '[Link](https://example.com)';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<a href="https://example.com">Link</a>');
    });

    it('should render images', () => {
      const markdown = '![Alt](image.png)';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('class="figure"');
      expect(html).toContain('<img src="image.png" alt="Alt"');
      expect(html).toContain('class="figure-caption"');
    });

    it('should render images with attribute blocks without showing attributes', () => {
      const markdown = '![Caption](image.png){#fig:generated-123 label="Figure {REF}.1"}';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<img src="image.png" alt="Caption"');
      expect(html).toContain('class="figure-caption"');
      expect(html).toContain('class="figure"');
      expect(html).not.toContain('{#fig:');
      expect(html).not.toContain('label="Figure');
      expect(html).not.toContain('.1"}');
    });

    it('should apply alignment and width from image attribute blocks', () => {
      const markdown =
        '![Caption](image.png){#fig:generated-123 label="Figure {REF}.1" align="center" width="50%" placement="block"}';
      const html = renderMarkdownToHtml(markdown);
      // Width is applied to the inner wrapper; image fills that inner width.
      expect(html).toContain('width:50%');
      // Alignment for block figures is handled by wrapper text-align.
      expect(html).toContain('text-align:center');
    });

    it('should apply border style/color/width from image attribute blocks', () => {
      const markdown =
        '![Caption](image.png){#fig:generated-123 borderStyle="solid" borderColor="#6b7280" borderWidth="2"}';
      const html = renderMarkdownToHtml(markdown);
      expect(html).toContain('border:2px solid #6b7280');
    });

    it('should allow borderWidth="0" to disable border from image attribute blocks', () => {
      const markdown =
        '![Caption](image.png){#fig:generated-123 borderStyle="solid" borderColor="#6b7280" borderWidth="0"}';
      const html = renderMarkdownToHtml(markdown);
      expect(html).toContain('border:none');
    });

    it('should float inline figures by default so text can wrap', () => {
      const markdown =
        '![Caption](image.png){#fig:generated-123 label="Figure {REF}.1" placement="inline"}\n\nNext paragraph text';
      const html = renderMarkdownToHtml(markdown);
      expect(html).toContain('float:left');
    });

    it('should center inline figures when align="center" (no float)', () => {
      const markdown =
        '![Caption](image.png){#fig:generated-123 label="Figure {REF}.1" placement="inline" align="center"}';
      const html = renderMarkdownToHtml(markdown);
      expect(html).toContain('margin:0 auto 12px auto');
      expect(html).not.toContain('float:left');
      expect(html).not.toContain('float:right');
    });

    it('should not break asset URLs containing "__" (no accidental italics)', () => {
      const markdown =
        '![Cap](zadoox-asset://053a1656-58a5-46f1-8df6-146b6d4b40ae__af442c5b-85f0-4815-9f4e-11acbb1b71a0.png){#fig:generated-1 label="Figure {REF}.1"}';
      const html = renderMarkdownToHtml(markdown);
      expect(html).toContain('src="zadoox-asset://053a1656-58a5-46f1-8df6-146b6d4b40ae__af442c5b-85f0-4815-9f4e-11acbb1b71a0.png"');
      expect(html).not.toContain('<em></em>');
    });

    it('should handle plain text', () => {
      const markdown = 'Plain text';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<p>');
      expect(html).toContain('Plain text');
    });
  });
});

