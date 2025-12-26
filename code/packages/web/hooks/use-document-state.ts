'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/client';

const AUTO_SAVE_DELAY = 2000; // 2 seconds after last edit

export function useDocumentState(documentId: string, projectId: string) {
  const [content, setContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actualDocumentId, setActualDocumentId] = useState<string>(documentId);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load document content (or create "Untitled Document" if project has no documents)
  useEffect(() => {
    async function loadDocument() {
      try {
        setIsLoading(true);
        
        // If documentId is 'default', find or create the default document for this project
        if (documentId === 'default') {
          // Get all documents for this project
          const documents = await api.documents.listByProject(projectId);
          
          // If project has documents, use the first one
          // Otherwise, create a new "Untitled Document"
          let document;
          if (documents.length > 0) {
            document = documents[0];
          } else {
            // Project has no documents, create the default "Untitled Document"
            document = await api.documents.create({
              projectId,
              title: 'Untitled Document',
              content: '',
              metadata: {
                type: 'standalone',
              },
            });
          }
          
          setActualDocumentId(document.id);
          setContent(document.content || '');
          setDocumentTitle(document.title);
          setLastSaved(new Date(document.updatedAt));
          setIsLoading(false);
          return;
        }

        // Try to get existing document by ID
        try {
          const document = await api.documents.get(documentId);
          setActualDocumentId(document.id);
          setContent(document.content || '');
          setDocumentTitle(document.title);
          setLastSaved(new Date(document.updatedAt));
          setIsLoading(false);
        } catch (error) {
          console.error('Failed to load document:', error);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to load document:', error);
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [documentId, projectId]);

  // Auto-save function
  const saveDocument = useCallback(
    async (contentToSave: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Don't save if we don't have an actual document ID yet
      if (!actualDocumentId || actualDocumentId === 'default') {
        return;
      }

      setIsSaving(true);
      try {
        const document = await api.documents.update(actualDocumentId, {
          content: contentToSave,
          changeType,
        });
        setDocumentTitle(document.title);
        setLastSaved(new Date(document.updatedAt));
      } catch (error) {
        console.error('Failed to save document:', error);
        // Don't update lastSaved on error - user will see "Not saved" status
      } finally {
        setIsSaving(false);
      }
    },
    [actualDocumentId]
  );

  // Update content with auto-save
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveDocument(newContent, 'auto-save');
      }, AUTO_SAVE_DELAY);
    },
    [saveDocument]
  );

  // Set content without triggering auto-save (for viewing older versions)
  const setContentWithoutSave = useCallback((newContent: string) => {
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setContent(newContent);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    content,
    documentTitle,
    updateContent,
    setContentWithoutSave,
    isSaving,
    lastSaved,
    isLoading,
    documentId: actualDocumentId,
    saveDocument: async (contentToSave: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      await saveDocument(contentToSave, changeType);
    },
  };
}

