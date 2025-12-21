# Zadoox Architecture - Hybrid Model
## Technical Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Zadoox Platform                           │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   Web Application    │         │  Cursor Extension    │
│   (React/Next.js)    │◄───────►│  (TypeScript/Node)   │
│                      │   API   │                      │
│  - Document Editor   │         │  - Code Analysis     │
│  - AI Assistant      │         │  - Doc Generation    │
│  - Collaboration     │         │  - Sync Engine       │
│  - Export Engine     │         │  - Link Manager      │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │                                │
           ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│              Backend Services (Node)                     │
├──────────────────────────────────────────────────────────┤
│  - API Gateway (REST + WebSocket)                        │
│  - Authentication & Authorization                        │
│  - Document Management Service                           │
│  - AI Service (LLM Integration)                          │
│  - Code Analysis Service                                 │
│  - Sync Service                                          │
│  - Export Service (LaTeX, Markdown, PDF)                 │
│  - Git Integration Service                               │
│  - Collaboration Service (Real-time)                     │
│  - Meta Content Service (Ideation, Fragments, etc.)      │
└──────────┬───────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                    Data Layer                            │
├──────────────────────────────────────────────────────────┤
│  - Supabase (Documents, Users, Projects, MetaContent,   │
│              Styles, Templates)                         │
│  - Redis (Caching, Real-time state)                      │
│  - S3/Blob Storage (Files, Assets)                       │
│  - Vector DB (Code embeddings, Semantic search)          │
│  - Git Repositories (Version control)                    │
└──────────────────────────────────────────────────────────┘
```

## Core Services

### 1. Document Management Service
- CRUD operations for documents
- Chapter organization
- Version control
- File storage
- Meta content linking (ideation, fragments, etc.)
- Document-meta content relationships
- Input format normalization (LaTeX → Extended Markdown conversion)
- Content storage in Extended Markdown format

### 2. AI Service
- LLM integration (OpenAI, Anthropic, or self-hosted)
- Context management
- Prompt engineering
- Response caching
- Cost optimization

### 3. Code Analysis Service
- AST parsing (supports multiple languages)
- Code structure analysis
- Function/class extraction
- Dependency mapping
- Semantic code search

### 4. Sync Service
- Web ↔ Cursor synchronization
- Conflict resolution
- Change tracking
- Real-time updates (WebSocket)

### 5. Export Service
- Extended Markdown → LaTeX conversion
- PDF generation
- Multi-format export
- Style application
- Template application:
  - Uses linked format-specific templates during export
  - LaTeX export: Uses linked `.tex` template file
  - Markdown export: Uses linked `.md` template file
  - HTML export: Uses linked `.html` template file
  - Template variables substitution
  - Document content insertion into template structure

### 7. Style Service
- Style management (CRUD)
- Style application to documents
- Style validation
- Format compatibility checking

### 8. Template Service
- Template management (CRUD)
- Template linking to documents
- Template variable substitution
- Template file management (LaTeX .tex, Markdown .md, HTML .html files)

### 9. Content Normalization Service
- Converts LaTeX syntax to Extended Markdown format
- Preserves LaTeX commands within Extended Markdown
- Handles mixed LaTeX/Markdown input
- Normalizes content to Extended Markdown for storage
- Bidirectional conversion (for display/editing)

### 6. Git Integration Service
- Repository management
- Commit automation
- Branch handling
- {REF} placeholder processing

## Data Models

### Document
```typescript
{
  id: string
  projectId: string
  title: string
  content: string (Extended Markdown)  // Main refined content (stored in Extended Markdown format)
  metadata: {
    chapterNumber: number
    type: 'chapter' | 'section' | 'standalone'
  }
  styleId: string  // Reference to Style
  templates: {
    latex?: string  // Template ID for LaTeX export
    markdown?: string  // Template ID for Markdown export
    html?: string  // Template ID for HTML export
  }  // Format-specific template links
  codeLinks: CodeLink[]
  metaContentLinks: MetaContentLink[]  // Links to ideation, fragments, etc.
  version: number
  createdAt: Date
  updatedAt: Date
  authorId: string
}
```

### Style
```typescript
{
  id: string
  name: string  // 'academic', 'whitepaper', 'technical-docs', 'blog', etc.
  displayName: string
  description: string
  settings: {
    citationStyle: 'apa' | 'mla' | 'chicago' | 'ieee' | 'custom'
    headingStyle: 'numbered' | 'unnumbered' | 'mixed'
    figurePlacement: 'inline' | 'floating' | 'end'
    tableStyle: 'simple' | 'grid' | 'booktabs'
    fontFamily: string
    fontSize: string
    lineSpacing: number
    margins: { top: number, bottom: number, left: number, right: number }
    pageSize: 'a4' | 'letter' | 'custom'
  }
  formatSupport: ('latex' | 'markdown' | 'html' | 'pdf')[]  // Formats this style supports
  isSystem: boolean  // System-provided vs user-created
  createdAt: Date
  updatedAt: Date
}
```

### Template
```typescript
{
  id: string
  name: string
  displayName: string
  description: string
  category: 'academic' | 'industry' | 'technical' | 'general'
  format: 'latex' | 'markdown' | 'html' | 'pdf'  // Format this template is for
  templatePath: string  // Path/reference to format-specific template file
  // For LaTeX: path to .tex template file
  // For Markdown: path to .md template file
  // For HTML: path to .html template file
  variables?: {
    [key: string]: {
      type: 'string' | 'number' | 'date' | 'list'
      default?: any
      description: string
    }
  }  // Optional variables for template substitution
  isSystem: boolean  // System-provided vs user-created
  createdAt: Date
  updatedAt: Date
}
```

### MetaContent
```typescript
{
  id: string
  documentId: string  // Parent document
  type: 'ideation' | 'fragment' | 'draft' | 'notes' | 'commentary'
  content: string (Markdown)  // Meta content (ideation, fragments, etc.)
  linkedSections: string[]  // Section IDs or ranges this meta content relates to
  metadata: {
    mode: 'formal' | 'ideation' | 'fragment' | 'draft'
    tags: string[]
    createdAt: Date
    updatedAt: Date
  }
  version: number
  isVisible: boolean  // Show/hide in UI
  order: number  // Display order
}
```

### MetaContentLink
```typescript
{
  id: string
  documentId: string  // Main document
  metaContentId: string  // Linked meta content
  linkType: 'section' | 'paragraph' | 'inline' | 'document'
  target: {
    sectionId?: string
    paragraphRange?: [number, number]
    characterRange?: [number, number]
  }
  bidirectional: boolean
  createdAt: Date
}
```

### CodeLink
```typescript
{
  id: string
  documentId: string
  codeElement: {
    filePath: string
    functionName?: string
    className?: string
    lineStart: number
    lineEnd: number
  }
  bidirectional: boolean
  createdAt: Date
}
```

### Project
```typescript
{
  id: string
  name: string
  type: 'academic' | 'industry' | 'code-docs'
  settings: {
    defaultFormat: 'latex' | 'markdown'
    chapterNumbering: boolean
    autoSync: boolean
  }
  integrations: {
    cursor: boolean
    git: GitConfig
  }
  members: User[]
}
```

## API Design

### REST Endpoints

#### Documents
- `GET /api/documents/:id` - Get document
- `GET /api/documents/:id?includeMeta=true` - Get document with meta content
- `POST /api/documents` - Create document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/:id/versions` - Get version history

#### Meta Content
- `GET /api/documents/:id/meta` - Get all meta content for document
- `GET /api/meta/:id` - Get specific meta content
- `POST /api/documents/:id/meta` - Create meta content
- `PUT /api/meta/:id` - Update meta content
- `DELETE /api/meta/:id` - Delete meta content
- `POST /api/meta/:id/link` - Link meta content to document section
- `DELETE /api/meta/:id/link/:linkId` - Remove link
- `GET /api/documents/:id/meta/:type` - Get meta content by type (ideation, fragment, etc.)
- `PUT /api/meta/:id/visibility` - Toggle visibility

#### AI
- `POST /api/ai/suggest` - Get AI suggestions
- `POST /api/ai/enhance` - Enhance section
- `POST /api/ai/references` - Find references
- `POST /api/ai/translate` - Translate text

#### Code
- `GET /api/code/workspace` - Get workspace structure
- `POST /api/code/analyze` - Analyze code
- `POST /api/code/link` - Create code-doc link
- `GET /api/code/elements` - Get code elements

#### Export
- `POST /api/export/latex` - Export to LaTeX
- `POST /api/export/pdf` - Export to PDF
- `POST /api/export/markdown` - Export to Markdown

#### Styles
- `GET /api/styles` - Get all available styles
- `GET /api/styles/:id` - Get specific style
- `POST /api/styles` - Create custom style (user-created)
- `PUT /api/styles/:id` - Update style (user-created only)
- `DELETE /api/styles/:id` - Delete style (user-created only)
- `GET /api/styles/:id/formats` - Get supported formats for style
- `POST /api/documents/:id/style` - Apply style to document

#### Templates
- `GET /api/templates` - Get all available templates
- `GET /api/templates?format=latex` - Get templates for specific format
- `GET /api/templates/:id` - Get specific template
- `GET /api/templates/:id/file` - Get template file content
- `POST /api/templates` - Create custom template (user-created, upload template file)
- `PUT /api/templates/:id` - Update template (user-created only)
- `DELETE /api/templates/:id` - Delete template (user-created only)
- `POST /api/documents/:id/template` - Link template to document
- `DELETE /api/documents/:id/template` - Unlink template from document

### WebSocket Events

#### Real-time Collaboration
- `document:change` - Document updated
- `cursor:move` - User cursor moved
- `selection:change` - User selection changed
- `presence:update` - User presence updated

#### Sync
- `sync:start` - Sync started
- `sync:progress` - Sync progress
- `sync:complete` - Sync completed
- `sync:conflict` - Sync conflict detected

## Cursor Extension Architecture

### Extension Components

```
┌─────────────────────────────────────┐
│      Cursor Extension (VS Code)     │
├─────────────────────────────────────┤
│  - Extension Host                   │
│  - Language Server (LSP)            │
│  - Webview Panel (Doc Editor)       │
│  - Code Analyzer                    │
│  - Sync Client                      │
│  - Link Manager                     │
└─────────────────────────────────────┘
```

### Key Features

1. **Code Analysis**
   - AST parsing via Tree-sitter
   - Multi-language support
   - Real-time code monitoring

2. **Documentation Panel**
   - Embedded webview
   - Quick doc editor
   - AI suggestions inline

3. **Sync Client**
   - WebSocket connection to backend
   - File system watcher
   - Change detection and upload

4. **Link Manager**
   - Tracks code-doc relationships
   - Visual indicators in editor
   - Navigation between code and docs

## AI Integration

### AI Service Architecture

```
┌─────────────────────────────────────┐
│         AI Service Layer             │
├─────────────────────────────────────┤
│  - Prompt Manager                   │
│  - Context Builder                  │
│  - LLM Router (multi-provider)      │
│  - Response Cache                   │
│  - Cost Tracker                     │
└─────────────────────────────────────┘
```

### AI Features

1. **Writing Assistance**
   - Context-aware suggestions
   - Style refinement
   - Grammar and clarity

2. **Content Generation**
   - Section expansion
   - Example generation
   - Reference finding

3. **Code Understanding**
   - Code-to-doc generation
   - Function documentation
   - Architecture explanations

4. **Multi-language**
   - Translation
   - Localization
   - Technical term handling

## Security & Privacy

### Authentication
- OAuth 2.0 (GitHub, Google)
- JWT tokens
- Refresh token rotation
- Session management

### Authorization
- Role-based access control (RBAC)
- Project-level permissions
- Document-level sharing

### Data Privacy
- End-to-end encryption (optional)
- On-premise deployment option
- Data residency controls
- GDPR compliance

### Code Security
- Secure code analysis (no code leaves workspace without permission)
- Sandboxed AI processing
- Audit logs

## Scalability

### Horizontal Scaling
- Stateless API servers
- Load balancing
- Database replication
- Redis cluster

### Caching Strategy
- Document content caching
- AI response caching
- Code analysis caching
- CDN for static assets

### Performance Optimization
- Lazy loading
- Incremental sync
- Background processing
- Queue system for heavy operations

## Deployment

### Infrastructure
- Containerized services (Docker)
- Kubernetes orchestration
- Cloud-agnostic design
- Auto-scaling

### CI/CD
- Automated testing
- Staged deployments
- Rollback capability
- Feature flags

### Monitoring
- Application metrics
- Error tracking
- Performance monitoring
- User analytics

## Integration Points

### External Services
- **Git Providers**: GitHub, GitLab, Bitbucket
- **AI Providers**: OpenAI, Anthropic, Self-hosted
- **Storage**: AWS S3, Azure Blob, GCS
- **Publishing**: GitBook, GitHub Pages, Custom

### APIs
- REST API for integrations
- Webhook support
- GraphQL (optional)
- CLI tool

## Meta Content Architecture

### Overview

Zadoox supports multiple content types linked to the main document:
- **Main Content**: Refined, final document content
- **Meta Content**: Ideation, fragments, drafts, notes, commentary

### Storage Model

```
Document (Main Content)
  ├── MetaContent (Ideation)
  │   └── Linked to: Section 1, Section 2
  ├── MetaContent (Fragments)
  │   └── Linked to: Section 1
  ├── MetaContent (Draft)
  │   └── Linked to: Entire document
  └── MetaContent (Notes)
      └── Linked to: Paragraph 3
```

### Database Schema

#### meta_content table
```sql
CREATE TABLE meta_content (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'ideation' | 'fragment' | 'draft' | 'notes' | 'commentary'
  content TEXT,  -- Markdown content
  mode TEXT,  -- 'formal' | 'ideation' | 'fragment' | 'draft'
  metadata JSONB,  -- Tags, custom fields
  is_visible BOOLEAN DEFAULT true,
  order_index INTEGER,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  author_id UUID
);

CREATE INDEX idx_meta_content_document ON meta_content(document_id);
CREATE INDEX idx_meta_content_type ON meta_content(type);
```

#### meta_content_links table
```sql
CREATE TABLE meta_content_links (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  meta_content_id UUID REFERENCES meta_content(id) ON DELETE CASCADE,
  link_type TEXT,  -- 'section' | 'paragraph' | 'inline' | 'document'
  target JSONB,  -- Section IDs, ranges, etc.
  bidirectional BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);

CREATE INDEX idx_meta_links_document ON meta_content_links(document_id);
CREATE INDEX idx_meta_links_content ON meta_content_links(meta_content_id);
```

### Meta Content Service

#### Service Responsibilities
- **CRUD Operations**: Create, read, update, delete meta content
- **Linking Management**: Create/remove links between main content and meta content
- **Type Management**: Handle different meta content types
- **Visibility Control**: Show/hide meta content in UI
- **Versioning**: Track meta content versions
- **Querying**: Efficient retrieval of linked meta content

#### Service Methods
```typescript
class MetaContentService {
  // CRUD
  createMetaContent(documentId, type, content, mode)
  getMetaContent(metaContentId)
  updateMetaContent(metaContentId, content)
  deleteMetaContent(metaContentId)
  
  // Linking
  linkToSection(metaContentId, documentId, sectionId)
  linkToRange(metaContentId, documentId, range)
  unlink(linkId)
  getLinksForDocument(documentId)
  getLinksForMetaContent(metaContentId)
  
  // Querying
  getByDocument(documentId, type?)
  getByType(documentId, type)
  getVisible(documentId)
  getLinkedToSection(documentId, sectionId)
  
  // Visibility
  toggleVisibility(metaContentId)
  showAll(documentId)
  hideAll(documentId)
}
```

### Link Resolution

#### Link Types

**1. Section Link**
```typescript
{
  linkType: 'section',
  target: {
    sectionId: 'sec:background'
  }
}
```
- Links meta content to entire section
- Appears when section is viewed/edited

**2. Paragraph Link**
```typescript
{
  linkType: 'paragraph',
  target: {
    paragraphRange: [0, 2]  // Paragraphs 0-2
  }
}
```
- Links to specific paragraph range
- More granular than section

**3. Inline Link**
```typescript
{
  linkType: 'inline',
  target: {
    characterRange: [150, 300]  // Character positions
  }
}
```
- Links to specific text range
- Most granular link type

**4. Document Link**
```typescript
{
  linkType: 'document',
  target: {}
}
```
- Links to entire document
- Global meta content (e.g., overall ideation)

### API Response Structure

#### Get Document with Meta Content
```json
{
  "document": {
    "id": "doc-123",
    "title": "Chapter 1",
    "content": "# Main content...",
    "metaContentLinks": [
      {
        "id": "link-1",
        "metaContentId": "meta-1",
        "type": "ideation",
        "linkType": "section",
        "target": { "sectionId": "sec:background" },
        "isVisible": true
      }
    ]
  },
  "metaContent": [
    {
      "id": "meta-1",
      "type": "ideation",
      "content": "- Idea 1\n- Idea 2",
      "mode": "ideation",
      "linkedSections": ["sec:background"],
      "isVisible": true
    }
  ]
}
```

### Frontend Integration

#### Document Editor
- **Show/Hide Toggle**: Toggle meta content visibility
- **Linked Indicators**: Visual indicators where meta content is linked
- **Side Panel**: Display linked meta content
- **Inline View**: Show meta content inline (collapsible)

#### Meta Content Panel
```
┌─────────────────────────────────────┐
│  Meta Content                       │
├─────────────────────────────────────┤
│  [Show All] [Hide All]              │
│                                     │
│  📝 Ideation (2)                    │
│  └─ Linked to: Section 1, Section 2│
│                                     │
│  📋 Fragments (5)                   │
│  └─ Linked to: Section 1           │
│                                     │
│  📄 Draft (1)                       │
│  └─ Linked to: Entire document     │
└─────────────────────────────────────┘
```

### Export Considerations

#### Export Options
- **Include Meta Content**: Export with meta content visible
- **Exclude Meta Content**: Export only main content
- **Appendix**: Export meta content as appendix
- **Separate Files**: Export meta content to separate files

#### Export Format
```markdown
# Main Document Content

[Main content here...]

---

## Appendix: Ideation Notes

[Ideation content here...]

## Appendix: Fragments

[Fragment content here...]
```

### Performance Optimization

#### Lazy Loading
- Load main content first
- Load meta content on demand
- Cache meta content in frontend

#### Indexing
- Index meta content by document
- Index links by target
- Fast lookup for linked content

#### Caching
- Cache meta content in Redis
- Invalidate on updates
- Cache link relationships

