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

      expect(html).toContain('<img src="image.png" alt="Alt" />');
    });

    it('should handle plain text', () => {
      const markdown = 'Plain text';
      const html = renderMarkdownToHtml(markdown);

      expect(html).toContain('<p>');
      expect(html).toContain('Plain text');
    });
  });
});

