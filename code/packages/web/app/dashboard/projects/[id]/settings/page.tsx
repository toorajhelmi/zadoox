'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout, LoaderIcon } from '@/components/dashboard';
import { api } from '@/lib/api/client';
import type { Project, DocumentStyle, CitationFormat } from '@zadoox/shared';

// Default settings based on document style
const DEFAULT_SETTINGS: Record<DocumentStyle, { citationFormat: CitationFormat }> = {
  academic: { citationFormat: 'apa' },
  whitepaper: { citationFormat: 'numbered' },
  'technical-docs': { citationFormat: 'numbered' },
  blog: { citationFormat: 'footnote' },
  other: { citationFormat: 'numbered' },
};

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.projects.get(projectId);
        setProject(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const handleSave = async () => {
    if (!project) return;

    try {
      setSaving(true);
      await api.projects.update(projectId, {
        settings: {
          ...project.settings,
          documentStyle: project.settings.documentStyle || 'other',
          citationFormat: project.settings.citationFormat || 'numbered',
        },
      });
      // Reload project to get updated data
      const updated = await api.projects.get(projectId);
      setProject(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentStyleChange = (style: DocumentStyle) => {
    if (!project) return;
    
    const newSettings = {
      ...project.settings,
      documentStyle: style,
      // Auto-set citation format based on style
      citationFormat: project.settings.citationFormat || DEFAULT_SETTINGS[style].citationFormat,
    };
    
    setProject({
      ...project,
      settings: newSettings,
    });
  };

  const handleCitationFormatChange = (format: CitationFormat) => {
    if (!project) return;
    
    setProject({
      ...project,
      settings: {
        ...project.settings,
        citationFormat: format,
      },
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <LoaderIcon className="w-8 h-8 text-[#969696] animate-spin" />
            </div>
            <p className="text-[#969696]">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-[#969696] mb-4">{error || 'Project not found'}</p>
            <button
              onClick={() => router.push(`/dashboard/projects/${projectId}`)}
              className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded"
            >
              Back to Project
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentDocumentStyle = project.settings.documentStyle || 'other';
  const currentCitationFormat = project.settings.citationFormat || DEFAULT_SETTINGS[currentDocumentStyle].citationFormat;

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white mb-1">Project Settings</h1>
              <p className="text-sm text-[#969696]">{project.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={() => router.push(`/dashboard/projects/${projectId}`)}
                className="px-4 py-2 text-sm text-[#cccccc] hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Document Style Section */}
            <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded">
              <h2 className="text-lg font-semibold text-white mb-4">Document Style</h2>
              <p className="text-sm text-[#969696] mb-4">
                Select the document style that best matches your project. This affects citation formats and research source types.
              </p>
              <div className="space-y-2">
                {(['academic', 'whitepaper', 'technical-docs', 'blog', 'other'] as DocumentStyle[]).map((style) => (
                  <label
                    key={style}
                    className="flex items-center p-3 border border-[#3e3e42] rounded hover:bg-[#2d2d30] cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="documentStyle"
                      value={style}
                      checked={currentDocumentStyle === style}
                      onChange={() => handleDocumentStyleChange(style)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="text-white capitalize">{style.replace('-', ' ')}</div>
                      <div className="text-xs text-[#969696]">
                        {style === 'academic' && 'Academic papers, research articles (uses academic sources)'}
                        {style === 'whitepaper' && 'Professional whitepapers, industry reports (uses publications)'}
                        {style === 'technical-docs' && 'Technical documentation, API docs (uses web sources)'}
                        {style === 'blog' && 'Blog posts, articles (uses web sources)'}
                        {style === 'other' && 'General documents (uses mixed sources)'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Citation Format Section */}
            <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded">
              <h2 className="text-lg font-semibold text-white mb-4">Citation Format</h2>
              <p className="text-sm text-[#969696] mb-4">
                Choose how citations are formatted in your documents.
              </p>
              <div className="space-y-2">
                {(['apa', 'mla', 'chicago', 'ieee', 'numbered', 'footnote'] as CitationFormat[]).map((format) => (
                  <label
                    key={format}
                    className="flex items-center p-3 border border-[#3e3e42] rounded hover:bg-[#2d2d30] cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="citationFormat"
                      value={format}
                      checked={currentCitationFormat === format}
                      onChange={() => handleCitationFormatChange(format)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="text-white uppercase">{format}</div>
                      <div className="text-xs text-[#969696]">
                        {format === 'apa' && 'American Psychological Association (Author, Year)'}
                        {format === 'mla' && 'Modern Language Association (Author Page)'}
                        {format === 'chicago' && 'Chicago Manual of Style (Author Year)'}
                        {format === 'ieee' && 'IEEE (numbered [1])'}
                        {format === 'numbered' && 'Numbered references [1], [2]...'}
                        {format === 'footnote' && 'Footnotes at bottom of page'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Current Settings Summary */}
            <div className="p-6 bg-[#1e1e1e] border border-[#3e3e42] rounded">
              <h3 className="text-sm font-semibold text-white mb-2">Current Settings</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#969696]">Document Style:</dt>
                  <dd className="text-white capitalize">{currentDocumentStyle.replace('-', ' ')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#969696]">Citation Format:</dt>
                  <dd className="text-white uppercase">{currentCitationFormat}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#969696]">Default Format:</dt>
                  <dd className="text-white capitalize">{project.settings.defaultFormat}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

