import { api } from '@/lib/api/client';

export async function rollbackToVersion(params: {
  actualDocumentId: string;
  versionNumber: number;
  setSelectedVersion: (v: number | null) => void;
  updateContent: (content: string) => void;
}) {
  const { actualDocumentId, versionNumber, setSelectedVersion, updateContent } = params;
  const content = await api.versions.reconstruct(actualDocumentId, versionNumber);
  // Persist immediately as a rollback change (creates a new document version).
  await api.documents.update(actualDocumentId, {
    content,
    changeType: 'rollback',
    changeDescription: `Restored version v${versionNumber}`,
  });
  setSelectedVersion(null); // back to latest (editable)
  updateContent(content); // update local editor state
}

export async function selectVersionForViewing(params: {
  actualDocumentId: string;
  versionNumber: number;
  latestVersion: number | null;
  setLatestVersion: (v: number | null) => void;
  setSelectedVersion: (v: number | null) => void;
  updateContent: (content: string) => void;
  setContentWithoutSave: (content: string) => void;
}) {
  const {
    actualDocumentId,
    versionNumber,
    latestVersion,
    setLatestVersion,
    setSelectedVersion,
    updateContent,
    setContentWithoutSave,
  } = params;

  const reconstructed = await api.versions.reconstruct(actualDocumentId, versionNumber);

  // Always fetch latest version metadata to ensure we have the current latest
  let currentLatestVersion: number | null = latestVersion ?? null;
  const metadata = await api.versions.getMetadata(actualDocumentId);
  if (metadata.currentVersion !== undefined && metadata.currentVersion !== null) {
    currentLatestVersion = Number(metadata.currentVersion);
  } else {
    const versions = await api.versions.list(actualDocumentId, 1, 0);
    if (versions.length > 0) {
      currentLatestVersion = versions[0].versionNumber;
    }
  }
  setLatestVersion(currentLatestVersion);

  // If selecting the latest version, reset to null to enable editing
  if (currentLatestVersion !== null && Number(versionNumber) === Number(currentLatestVersion)) {
    setSelectedVersion(null);
    updateContent(reconstructed);
  } else {
    setSelectedVersion(versionNumber);
    setContentWithoutSave(reconstructed);
  }
}


