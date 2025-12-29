'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChangeBlock } from '@zadoox/shared';
import { calculateChanges, applyAcceptedChanges, rejectAllChanges } from '@/lib/utils/diff';
import { mapChangesToNewContent } from '@/lib/utils/diff-mapper';

interface UseChangeTrackingOptions {
  onApply?: (newContent: string) => void;
  onCancel?: () => void;
}

/**
 * Hook for managing change tracking state
 * Handles calculating, accepting, and rejecting changes
 */
export function useChangeTracking(originalContent: string, options?: UseChangeTrackingOptions) {
  const [changes, setChanges] = useState<ChangeBlock[]>([]);
  const [mappedChanges, setMappedChanges] = useState<ChangeBlock[]>([]); // Changes mapped to new content positions
  const [isTracking, setIsTracking] = useState(false);
  const originalContentRef = useRef<string>(originalContent);
  const trackingOriginalContentRef = useRef<string>(originalContent);
  const newContentRef = useRef<string>(originalContent);
  const changesRef = useRef<ChangeBlock[]>([]);

  // Update original content ref when it changes
  useEffect(() => {
    originalContentRef.current = originalContent;
  }, [originalContent]);

  // Keep changes ref in sync with state
  useEffect(() => {
    changesRef.current = changes;
  }, [changes]);

  /**
   * Start tracking changes by comparing original with new content
   * @param newContent - The new content to compare against
   * @param originalContentOverride - Optional original content to use instead of the hook's current originalContent
   */
  const startTracking = useCallback((newContent: string, originalContentOverride?: string) => {
    // Use override if provided, otherwise use the ref's current value
    const original = originalContentOverride ?? originalContentRef.current;
    // Store the original content at the time tracking starts
    trackingOriginalContentRef.current = original;
    newContentRef.current = newContent;
    const calculatedChanges = calculateChanges(trackingOriginalContentRef.current, newContent);
    setChanges(calculatedChanges);
    // Map changes to new content positions for display
    const mapped = mapChangesToNewContent(calculatedChanges, trackingOriginalContentRef.current, newContent);
    setMappedChanges(mapped);
    setIsTracking(calculatedChanges.length > 0);
  }, []);

  /**
   * Accept a specific change
   */
  const acceptChange = useCallback((changeId: string) => {
    setChanges(prev => {
      const updated = prev.map(change =>
        change.id === changeId ? { ...change, accepted: true } : change
      );
      // Update mapped changes too
      if (newContentRef.current) {
        const mapped = mapChangesToNewContent(updated, trackingOriginalContentRef.current, newContentRef.current);
        setMappedChanges(mapped);
      }
      return updated;
    });
  }, []);

  /**
   * Reject a specific change
   */
  const rejectChange = useCallback((changeId: string) => {
    setChanges(prev => {
      const updated = prev.map(change =>
        change.id === changeId ? { ...change, accepted: false } : change
      );
      // Update mapped changes too
      if (newContentRef.current) {
        const mapped = mapChangesToNewContent(updated, trackingOriginalContentRef.current, newContentRef.current);
        setMappedChanges(mapped);
      }
      return updated;
    });
  }, []);

  /**
   * Accept all changes
   */
  const acceptAll = useCallback(() => {
    setChanges(prev => {
      const updated = prev.map(change => ({ ...change, accepted: true }));
      // Update mapped changes too
      if (newContentRef.current) {
        const mapped = mapChangesToNewContent(updated, trackingOriginalContentRef.current, newContentRef.current);
        setMappedChanges(mapped);
      }
      return updated;
    });
  }, []);

  /**
   * Reject all changes
   */
  const rejectAll = useCallback(() => {
    setChanges(prev => {
      const updated = prev.map(change => ({ ...change, accepted: false }));
      // Update mapped changes too
      if (newContentRef.current) {
        const mapped = mapChangesToNewContent(updated, trackingOriginalContentRef.current, newContentRef.current);
        setMappedChanges(mapped);
      }
      return updated;
    });
    if (options?.onCancel) {
      options.onCancel();
    }
  }, [options]);

  /**
   * Apply accepted changes to original content
   * If no changes are explicitly accepted, accepts all pending changes
   */
  const applyChanges = useCallback(() => {
    // Use ref to get latest changes (avoids stale closure)
    const currentChanges = changesRef.current;
    const hasAcceptedChanges = currentChanges.some(c => c.accepted === true);
    const hasRejectedChanges = currentChanges.some(c => c.accepted === false);
    
    // If no changes have been explicitly accepted or rejected, accept all
    const changesToApply = hasAcceptedChanges || hasRejectedChanges 
      ? currentChanges 
      : currentChanges.map(c => ({ ...c, accepted: true }));
    
    const acceptedChanges = changesToApply.filter(c => c.accepted === true);
    if (acceptedChanges.length === 0) {
      // No changes accepted, use original content
      if (options?.onCancel) {
        options.onCancel();
      }
      return trackingOriginalContentRef.current;
    }

    const newContent = applyAcceptedChanges(trackingOriginalContentRef.current, changesToApply);
    
    // Reset tracking state
    setChanges([]);
    setMappedChanges([]);
    setIsTracking(false);

    if (options?.onApply) {
      options.onApply(newContent);
    }

    return newContent;
  }, [options]);

  /**
   * Cancel tracking and restore original content
   */
  const cancelTracking = useCallback(() => {
    setChanges([]);
    setMappedChanges([]);
    setIsTracking(false);
    if (options?.onCancel) {
      options.onCancel();
    }
  }, [options]);

  /**
   * Get pending changes (not yet accepted or rejected)
   */
  const pendingChanges = changes.filter(c => c.accepted === undefined);

  /**
   * Get accepted changes
   */
  const acceptedChanges = changes.filter(c => c.accepted === true);

  /**
   * Get rejected changes
   */
  const rejectedChanges = changes.filter(c => c.accepted === false);

  return {
    changes, // Original positions (for applying)
    mappedChanges, // Mapped to new content positions (for display)
    isTracking,
    pendingChanges,
    acceptedChanges,
    rejectedChanges,
    startTracking,
    acceptChange,
    rejectChange,
    acceptAll,
    rejectAll,
    applyChanges,
    cancelTracking,
  };
}

