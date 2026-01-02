'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/client';
import type { ParagraphMode } from '@zadoox/shared';

const AUTO_SAVE_DELAY = 2000; // 2 seconds after last edit

function deriveTitleFromXmd(xmd: string): string | null {
  const lines = xmd.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // XMD Title marker: "@ Title"
    const t = /^@\s+(.+)$/.exec(trimmed);
    if (t) {
      const title = (t[1] || '').trim();
      if (!title) return null;
      return title.length > 160 ? `${title.slice(0, 157)}...` : title;
    }
    // Only H1: "# Title" (not "##")
    const m = /^#(?!#)\s+(.+)$/.exec(trimmed);
    if (!m) continue;
    const title = (m[1] || '').trim();
    if (!title) return null;
    // Keep titles reasonably short for UI.
    return title.length > 160 ? `${title.slice(0, 157)}...` : title;
  }
  return null;
}

export function useDocumentState(documentId: string, projectId: string) {
  const [content, setContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actualDocumentId, setActualDocumentId] = useState<string>(documentId);
  const [paragraphModes, setParagraphModes] = useState<Record<string, ParagraphMode>>({});
  const [documentMetadata, setDocumentMetadata] = useState<Record<string, any>>({});
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
          const loadedContent = document.content || '';
          setContent(loadedContent);
          setDocumentTitle(deriveTitleFromXmd(loadedContent) ?? document.title);
          setLastSaved(new Date(document.updatedAt));
          setParagraphModes(document.metadata?.paragraphModes || {});
          setDocumentMetadata(document.metadata || {});
          setIsLoading(false);
          return;
        }

        // Try to get existing document by ID
        try {
          const document = await api.documents.get(documentId);
          setActualDocumentId(document.id);
          const loadedContent = document.content || '';
          setContent(loadedContent);
          setDocumentTitle(deriveTitleFromXmd(loadedContent) ?? document.title);
          setLastSaved(new Date(document.updatedAt));
          setParagraphModes(document.metadata?.paragraphModes || {});
          setDocumentMetadata(document.metadata || {});
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
        const derivedTitle = deriveTitleFromXmd(contentToSave);
        // Get current document to preserve metadata (especially paragraphModes)
        const currentDocument = await api.documents.get(actualDocumentId);
        // Merge server metadata with local metadata (local wins) to avoid races where an autosave
        // overwrites fields like lastEditedFormat/latex that were just updated in the UI.
        const mergedMetadata = {
          ...(currentDocument.metadata || {}),
          ...(documentMetadata || {}),
          paragraphModes: paragraphModes, // Preserve current paragraph modes
        };
        
        // Update document with content change, preserving existing metadata
        const document = await api.documents.update(actualDocumentId, {
          ...(derivedTitle ? { title: derivedTitle } : null),
          content: contentToSave,
          metadata: mergedMetadata,
          changeType,
        });
        setDocumentTitle(document.title);
        setLastSaved(new Date(document.updatedAt));
        setParagraphModes(document.metadata?.paragraphModes || {});
        setDocumentMetadata(document.metadata || {});
      } catch (error) {
        console.error('Failed to save document:', error);
        // Don't update lastSaved on error - user will see "Not saved" status
      } finally {
        setIsSaving(false);
      }
    },
    [actualDocumentId, paragraphModes, documentMetadata]
  );

  // Update content with auto-save
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      const derivedTitle = deriveTitleFromXmd(newContent);
      if (derivedTitle) {
        setDocumentTitle(derivedTitle);
      }

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

  // Handle mode toggle
  const handleModeToggle = useCallback(
    async (paragraphId: string, newMode: ParagraphMode) => {
      if (!actualDocumentId || actualDocumentId === 'default') {
        return;
      }

      // Update local state immediately for responsive UI
      setParagraphModes(prev => ({
        ...prev,
        [paragraphId]: newMode,
      }));

      // Get current document to preserve existing metadata
      try {
        const currentDocument = await api.documents.get(actualDocumentId);
        const updatedModes = {
          ...(currentDocument.metadata?.paragraphModes || {}),
          [paragraphId]: newMode,
        };

        // Update document metadata
        await api.documents.update(actualDocumentId, {
          metadata: {
            ...currentDocument.metadata,
            paragraphModes: updatedModes,
          },
        });
      } catch (error) {
        console.error('Failed to update paragraph mode:', error);
        // Revert local state on error
        setParagraphModes(prev => {
          const next = { ...prev };
          delete next[paragraphId];
          return next;
        });
      }
    },
    [actualDocumentId]
  );

  return {
    content,
    documentTitle,
    updateContent,
    setContentWithoutSave,
    isSaving,
    lastSaved,
    isLoading,
    documentId: actualDocumentId,
    paragraphModes,
    documentMetadata,
    setDocumentMetadata,
    handleModeToggle,
    saveDocument: async (contentToSave: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      await saveDocument(contentToSave, changeType);
    },
  };
}

