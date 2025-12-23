import { EditorLayout } from '@/components/editor/editor-layout';

interface DocumentEditorPageProps {
  params: {
    id: string;
    documentId: string;
  };
}

export default function DocumentEditorPage({ params }: DocumentEditorPageProps) {
  return <EditorLayout projectId={params.id} documentId={params.documentId} />;
}

