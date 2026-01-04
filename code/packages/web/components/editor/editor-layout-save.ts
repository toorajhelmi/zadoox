import { useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import { extractCitedSourceIds } from '@/lib/utils/citation';
import type { ResearchSource } from '@zadoox/shared';

export function useEditorSaveWithCitationsCleanup(params: {
  actualDocumentId: string | undefined;
  originalSaveDocument: (contentToSave: string, changeType?: 'auto-save' | 'ai-action') => Promise<void>;
}) {
  const { actualDocumentId, originalSaveDocument } = params;

  // Track last saved content so we can diff citations on save.
  const previousContentRef = useRef<string>('');

  // Helper to clean up insertedSources when citations are removed
  // This is a background cleanup operation - errors are logged but don't block the main flow
  const cleanupInsertedSources = useCallback(
    async (newContent: string, _oldContent: string) => {
      if (!actualDocumentId) return;
      const currentDocument = await api.documents.get(actualDocumentId);
      const insertedSources: ResearchSource[] = currentDocument.metadata?.insertedSources || [];

      // Extract source IDs that are still cited in the new content
      const citedSourceIds = extractCitedSourceIds(newContent);

      // Filter out sources that are no longer cited
      const remainingInsertedSources = insertedSources.filter((source) => citedSourceIds.has(source.id));

      // Only update if something changed
      if (remainingInsertedSources.length !== insertedSources.length) {
        await api.documents.update(actualDocumentId, {
          metadata: {
            ...currentDocument.metadata,
            insertedSources: remainingInsertedSources,
          },
        });
      }
    },
    [actualDocumentId]
  );

  const saveDocument = useCallback(
    async (contentToSave: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      const oldContent = previousContentRef.current;
      await cleanupInsertedSources(contentToSave, oldContent);
      previousContentRef.current = contentToSave;
      await originalSaveDocument(contentToSave, changeType);
    },
    [cleanupInsertedSources, originalSaveDocument]
  );

  return { saveDocument, cleanupInsertedSources, previousContentRef };
}


