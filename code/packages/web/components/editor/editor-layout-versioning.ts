import { useEffect } from 'react';
import { api } from '@/lib/api/client';

export function useEditorVersionMetadata(params: {
  actualDocumentId: string | undefined;
  lastSavedMs: number | null;
  latestVersion: number | null;
  selectedVersion: number | null;
  setLatestVersion: (v: number | null) => void;
  setSelectedVersion: (v: number | null) => void;
}) {
  const { actualDocumentId, lastSavedMs, latestVersion, selectedVersion, setLatestVersion, setSelectedVersion } = params;

  // Load version metadata to determine latest version
  useEffect(() => {
    if (!actualDocumentId || actualDocumentId === 'default') return;

    async function loadMetadata() {
      const metadata = await api.versions.getMetadata(actualDocumentId);
      let newLatestVersion: number | null = null;

      // Check if currentVersion exists and is valid
      if (metadata.currentVersion !== undefined && metadata.currentVersion !== null) {
        newLatestVersion = Number(metadata.currentVersion);
      } else {
        // Fallback: get latest from versions list
        const versions = await api.versions.list(actualDocumentId, 1, 0);
        if (versions.length > 0) {
          newLatestVersion = versions[0].versionNumber;
        }
      }

      if (newLatestVersion !== null) {
        // If the latest version changed and we were viewing the latest, update to new latest
        if (latestVersion !== null && newLatestVersion > latestVersion && selectedVersion === null) {
          // New version was created while viewing the latest - stay on latest
          setLatestVersion(newLatestVersion);
          setSelectedVersion(null); // Ensure we're still viewing the latest
        } else if (latestVersion !== null && newLatestVersion > latestVersion && selectedVersion !== null) {
          // New version was created while viewing an older version - keep viewing that older version (read-only)
          setLatestVersion(newLatestVersion);
          // Don't change selectedVersion - keep it read-only
        } else {
          setLatestVersion(newLatestVersion);
        }
      }
    }

    // Load metadata - errors will propagate in tests, handled gracefully in production
    loadMetadata().catch((error) => {
      // In test environment, let errors propagate so tests fail when mocks are incorrect
      if (process.env.NODE_ENV === 'test') {
        throw error;
      }
      // In production, log but don't break the component (background operation)
      console.error('Failed to load version metadata:', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualDocumentId, latestVersion, selectedVersion, lastSavedMs]);
}


