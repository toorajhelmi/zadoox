import { describe, it, expect } from 'vitest';
import { markdownToLatex, latexToMarkdown } from '../latex';

describe.skip('LaTeX Conversion Utilities', () => {
  describe('markdownToLatex', () => {
    it('should convert headers to LaTeX sections', () => {
      const markdown = '# Section\n## Subsection\n### Subsubsection';
      const latex = markdownToLatex(markdown);

      expect(latex).toContain('\\section{Section}');
      expect(latex).toContain('\\subsection{Subsection}');
      expect(latex).toContain('\\subsubsection{Subsubsection}');
    });

    it('should convert bold text', () => {
      const markdown = 'This is **bold** text';
      const latex = markdownToLatex(markdown);

      expect(latex).toContain('\\textbf{bold}');
    });

    it('should convert italic text', () => {
      const markdown = 'This is *italic* text';
      const latex = markdownToLatex(markdown);

      expect(latex).toContain('\\textit{italic}');
    });

    it('should convert code blocks to verbatim', () => {
      const markdown = '```\ncode here\n```';
      const latex = markdownToLatex(markdown);

      expect(latex).toContain('\\begin{verbatim}');
      expect(latex).toContain('\\end{verbatim}');
      expect(latex).toContain('code here');
    });

    it('should convert inline code', () => {
      const markdown = 'Use `code` inline';
      const latex = markdownToLatex(markdown);

      expect(latex).toContain('\\texttt{code}');
    });

    it('should convert links', () => {
      const markdown = '[Link](https://example.com)';
      const latex = markdownToLatex(markdown);

      expect(latex).toContain('\\href{https://example.com}{Link}');
    });

    it('should convert images', () => {
      const markdown = '![Alt](image.png)';
      const latex = markdownToLatex(markdown);

      expect(latex).toContain('\\includegraphics{image.png}');
    });

    it('should handle line breaks', () => {
      const markdown = 'Line 1\n\nLine 2';
      const latex = markdownToLatex(markdown);

      expect(latex).toContain('\\par');
    });
  });

  describe('latexToMarkdown', () => {
    it('should convert LaTeX sections to headers', () => {
      const latex = '\\section{Section}\\subsection{Subsection}\\subsubsection{Subsubsection}';
      const markdown = latexToMarkdown(latex);

      expect(markdown).toContain('# Section');
      expect(markdown).toContain('## Subsection');
      expect(markdown).toContain('### Subsubsection');
    });

    it('should convert bold text', () => {
      const latex = 'This is \\textbf{bold} text';
      const markdown = latexToMarkdown(latex);

      expect(markdown).toContain('**bold**');
    });

    it('should convert italic text', () => {
      const latex = 'This is \\textit{italic} text';
      const markdown = latexToMarkdown(latex);

      expect(markdown).toContain('*italic*');
    });

    it('should convert verbatim to code blocks', () => {
      const latex = '\\begin{verbatim}\ncode here\n\\end{verbatim}';
      const markdown = latexToMarkdown(latex);

      expect(markdown).toContain('```');
      expect(markdown).toContain('code here');
    });

    it('should convert inline code', () => {
      const latex = 'Use \\texttt{code} inline';
      const markdown = latexToMarkdown(latex);

      expect(markdown).toContain('`code`');
    });

    it('should convert links', () => {
      const latex = '\\href{https://example.com}{Link}';
      const markdown = latexToMarkdown(latex);

      expect(markdown).toContain('[Link](https://example.com)');
    });

    it('should convert images', () => {
      const latex = '\\includegraphics{image.png}';
      const markdown = latexToMarkdown(latex);

      expect(markdown).toContain('![](image.png)');
    });

    it('should handle line breaks', () => {
      const latex = 'Line 1\\\\\\par Line 2';
      const markdown = latexToMarkdown(latex);

      expect(markdown).toContain('\n');
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve basic markdown through round-trip', () => {
      const original = '# Title\n\n**Bold** and *italic* text';
      const latex = markdownToLatex(original);
      const backToMarkdown = latexToMarkdown(latex);

      // Should at least preserve the concepts (not necessarily exact format)
      expect(backToMarkdown).toContain('Title');
      expect(backToMarkdown).toContain('Bold');
      expect(backToMarkdown).toContain('italic');
    });
  });
});

