/**
 * Citation utilities for extracting and managing citations in document content
 */

/**
 * Extract source IDs from citations in content
 * Matches citations in format [@sourceId]
 */
export function extractCitedSourceIds(contentText: string): Set<string> {
  const citedIds = new Set<string>();
  const citationRegex = /\[@([a-zA-Z0-9-]+)\]/g;
  let match;
  while ((match = citationRegex.exec(contentText)) !== null) {
    citedIds.add(match[1]);
  }
  return citedIds;
}

