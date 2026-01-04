export type ThinkModeApplyParams = {
  content: string;
  openParagraphId: string | null;
  generatedContent: string;
  mode: string;
  scope?: 'block' | 'document';
};

export function applyThinkModeGeneratedContentToXmd(params: ThinkModeApplyParams): string | null {
  const { content, openParagraphId, generatedContent, mode } = params;
  const scope = params.scope ?? 'block';

  const applyingToDocument = scope === 'document';
  if (!applyingToDocument && !openParagraphId) return null;

  const lines = content.split('\n');
  const startLine = applyingToDocument ? 0 : parseInt(openParagraphId!.match(/^para-(\d+)$/)![1], 10);
  if (!applyingToDocument) {
    const match = openParagraphId!.match(/^para-(\d+)$/);
    if (!match) return null;
    if (startLine < 0 || startLine >= lines.length) return null;
  }

  const isHeading = (line: string) => /^#{1,6}\s/.test(line.trim());
  const startLineIsHeading = startLine < lines.length && isHeading(lines[startLine].trim());

  let endLine = startLine;
  if (applyingToDocument) {
    endLine = lines.length;
  } else if (startLineIsHeading) {
    endLine = startLine + 1;
    while (endLine < lines.length) {
      if (isHeading(lines[endLine].trim())) break;
      endLine++;
    }
  } else {
    while (endLine < lines.length) {
      const trimmed = lines[endLine].trim();
      if (!trimmed || isHeading(trimmed)) break;
      endLine++;
    }
  }

  const beforeLines = lines.slice(0, startLine);
  const afterLines = lines.slice(endLine); // endLine is exclusive (first line after block)

  let newContent: string;
  if (mode === 'replace' || mode === 'lead' || mode === 'conclude' || mode === 'extend' || mode === 'citation' || mode === 'summary') {
    if (mode === 'lead' || mode === 'conclude' || mode === 'extend') {
      const currentBlockContent = lines.slice(startLine, endLine).join('\n');

      // Special case: sections start with a markdown heading. "Lead" should add content
      // to the beginning of the section body (right after the heading), not above the heading.
      if (mode === 'lead' && startLineIsHeading && !applyingToDocument) {
        const headingLine = lines[startLine] ?? '';
        const bodyContent = lines.slice(startLine + 1, endLine).join('\n');
        const gen = generatedContent.trim();
        const body = bodyContent.trim();
        const combined =
          gen && body
            ? `${headingLine}\n\n${gen}\n\n${bodyContent}`
            : gen
              ? `${headingLine}\n\n${gen}`
              : body
                ? `${headingLine}\n\n${bodyContent}`
                : headingLine;
        newContent = [...beforeLines, combined, ...afterLines].join('\n');
      } else {
        const left = mode === 'lead' ? generatedContent : currentBlockContent;
        const right = mode === 'lead' ? currentBlockContent : generatedContent;
        const combined =
          left.trimEnd() && right.trimStart() ? `${left.trimEnd()}\n\n${right.trimStart()}` : `${left}${right}`;
        newContent = [...beforeLines, combined, ...afterLines].join('\n');
      }
    } else {
      // Replace, Citation, or Summary: replace with generated content
      newContent = [...beforeLines, generatedContent, ...afterLines].join('\n');
    }
  } else {
    // Blend: the AI already returned the complete blended content (existing + new)
    newContent = [...beforeLines, generatedContent, ...afterLines].join('\n');
  }

  return newContent;
}


