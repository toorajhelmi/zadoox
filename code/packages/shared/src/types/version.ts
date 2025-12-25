/**
 * Document Versioning Types
 */

export type VersionChangeType = 'manual-save' | 'auto-save' | 'ai-action' | 'milestone' | 'rollback';

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  contentSnapshot?: string; // Full content if snapshot
  contentDelta?: VersionDelta; // Delta if not snapshot
  isSnapshot: boolean;
  snapshotBaseVersion?: number; // Base version for delta
  authorId: string;
  createdAt: Date;
  changeDescription?: string;
  changeType: VersionChangeType;
  metadata?: Record<string, unknown>;
}

export interface VersionDelta {
  operations: DeltaOperation[];
  baseVersion: number;
}

export interface DeltaOperation {
  type: 'insert' | 'delete' | 'replace';
  position: number;
  length?: number; // For delete/replace
  text?: string; // For insert/replace
}

export interface VersionMetadata {
  documentId: string;
  currentVersion: number;
  lastSnapshotVersion?: number;
  totalVersions: number;
  lastModifiedAt: Date;
  lastModifiedBy?: string;
}

export interface CreateVersionRequest {
  documentId: string;
  content: string;
  changeType: VersionChangeType;
  changeDescription?: string;
  forceSnapshot?: boolean; // Force creating a snapshot instead of delta
}

export interface GetVersionRequest {
  documentId: string;
  versionNumber: number;
}

export interface ListVersionsRequest {
  documentId: string;
  limit?: number;
  offset?: number;
}

export interface ReconstructVersionRequest {
  documentId: string;
  versionNumber: number;
}

