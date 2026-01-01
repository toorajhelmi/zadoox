import { EditorLayout } from '@/components/editor/editor-layout';

export const dynamic = 'force-dynamic';

interface DocumentEditorPageProps {
  params: Promise<{
    id: string;
    documentId: string;
  }>;
}

export default async function DocumentEditorPage({
  params,
}: DocumentEditorPageProps) {
  const { id, documentId } = await params;
  return <EditorLayout projectId={id} documentId={documentId} />;
}

