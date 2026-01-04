import { useEffect } from 'react';
import { api } from '@/lib/api/client';
import type { DocumentStyle } from '@zadoox/shared';

export function useProjectDocumentStyle(params: {
  projectId: string;
  setProjectName: (name: string) => void;
  setDocumentStyle: (style: DocumentStyle) => void;
}) {
  const { projectId, setProjectName, setDocumentStyle } = params;

  useEffect(() => {
    let cancelled = false;
    async function loadProjectSettings() {
      try {
        const project = await api.projects.get(projectId);
        if (cancelled) return;
        setProjectName(String(project.name ?? ''));

        // FIX: If documentStyle is missing, update it based on project type
        // This handles the case where the database has it but the API doesn't return it properly
        if (!project.settings.documentStyle) {
          const defaultDocumentStyle = project.type === 'academic' ? 'academic' : 'other';
          try {
            await api.projects.update(projectId, {
              settings: {
                ...project.settings,
                documentStyle: defaultDocumentStyle,
              },
            });
            // Reload project to get updated settings
            const updatedProject = await api.projects.get(projectId);
            if (cancelled) return;
            const loadedStyle = updatedProject.settings.documentStyle || defaultDocumentStyle;
            setDocumentStyle(loadedStyle);
            return;
          } catch (updateError) {
            console.error('Failed to update project documentStyle:', updateError);
            // Fall through to use default
          }
        }

        const loadedStyle = project.settings.documentStyle || 'other';
        setDocumentStyle(loadedStyle);
      } catch (error) {
        console.error('Failed to load project settings:', error);
      }
    }

    if (projectId) {
      loadProjectSettings();
    }

    return () => {
      cancelled = true;
    };
  }, [projectId, setDocumentStyle, setProjectName]);
}


