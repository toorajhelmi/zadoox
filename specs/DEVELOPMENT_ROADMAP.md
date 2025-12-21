# Zadoox Development Roadmap

## Phase 1: MVP

### Web App Core Editor
- **Document Editor**
  - Extended Markdown editor
  - Markdown syntax highlighting
  - Basic text editing operations
- **Basic UI Components**
  - Document outline/sidebar
  - Editor toolbar
  - Settings panel
  - Project dashboard
- **Document Management**
  - Create/edit/delete documents
  - Chapter organization
  - File upload (images, assets)
- **LaTeX Compilation**
  - Compile to LaTeX button
  - Extended Markdown → LaTeX conversion
  - PDF generation (via LaTeX)
  - Download compiled output

### Basic Editing Features
- **Text Editing**
  - Markdown formatting (bold, italic, headings, lists)
  - Extended Markdown syntax support
  - Basic text operations (find/replace)
- **Element Insertion**
  - Backslash commands (`\` palette)
  - Basic bottom panel (text formatting buttons)
  - Image insertion
  - Table creation
- **Placeholder System**
  - `{REF}` placeholder support
  - Auto-numbering based on structure
  - Placeholder replacement on export

### Basic AI Features
- **Writing Assistance**
  - Inline suggestions (accept with Tab)
  - Basic grammar/spelling checks
  - Simple completion suggestions
- **Content Generation**
  - Expand selected text
  - Improve clarity
  - Basic style suggestions
- **AI Integration**
  - Single LLM provider (OpenAI or Anthropic)
  - Basic prompt management
  - Response caching

---

## Phase 2: Enhanced

### Code-Doc Linking
- **Cursor Integration**
  - Cursor extension installation
  - Workspace connection
  - Code structure detection
  - Function/class extraction
- **Linking Features**
  - Link documents to code elements
  - Bidirectional links (code ↔ docs)
  - Visual indicators in editor
  - Navigation between code and docs
- **Code Analysis**
  - AST parsing (multi-language)
  - Code element identification
  - Dependency mapping
  - Semantic code search

### Real-Time Collaboration
- **Multi-User Editing**
  - WebSocket connection
  - Live cursor positions
  - Presence indicators
  - Real-time content sync
- **Conflict Resolution**
  - Automatic conflict detection
  - Merge strategies
  - Version comparison
  - Conflict resolution UI
- **Collaboration Features**
  - User permissions
  - Comments and suggestions
  - Review workflow
  - Activity feed

### Advanced AI Features
- **Enhanced Writing Assistance**
  - Context-aware suggestions
  - Style refinement (academic, technical, etc.)
  - Tone adjustment
  - Vocabulary enhancement
- **Content Operations**
  - Find references (academic papers)
  - Add examples (code, diagrams)
  - Generate counterarguments
  - Translate content
- **Document-Level AI**
  - Section enhancement
  - Missing element detection
  - Structure improvements
  - Document summarization
- **AI Modes**
  - Ideation mode support
  - Fragment mode support
  - Draft mode support
  - Mode content linking

### Git Integration
- **Repository Management**
  - Git integration in settings
  - Connect to Git repositories
  - Repository configuration
  - Branch selection
- **Placeholder Processing**
  - `{REF}` replacement on push
  - Placeholder restoration on pull
  - Git hooks setup
  - Pre-push/post-pull automation
- **Version Control**
  - Push to Git functionality
  - Pull from Git functionality
  - Commit automation
  - Change tracking
  - Diff visualization
  - Version history (via Git)
  - Rollback capabilities (via Git)

### Cursor Extension (Basic)
- **Extension Core**
  - VS Code extension framework
  - Extension installation
  - Account connection
  - Basic UI components
- **Code Analysis**
  - File system watcher
  - Code structure scanning
  - Function/class detection
  - Change detection
- **Documentation Panel**
  - Embedded webview
  - Quick doc editor
  - Code-doc link display
  - Sync status indicator
- **Sync Engine**
  - WebSocket connection
  - File change detection
  - Upload/download sync
  - Conflict handling

### LaTeX/Markdown Export
- **Export Engine**
  - Extended Markdown → LaTeX conversion
  - Extended Markdown → Markdown conversion
  - PDF generation (via LaTeX)
  - Multi-format export pipeline
- **Template Support**
  - Template file management
  - Format-specific template linking
  - Template variable substitution
  - Template application during export
- **Style Application**
  - Style settings application
  - Citation format handling
  - Heading style conversion
  - Figure/table placement
- **Export Options**
  - Include/exclude meta content
  - Export selected sections
  - Custom export settings
  - Batch export

### Meta Content System (Ideation, Fragments)
- **Meta Content Types**
  - Ideation mode
  - Fragment mode
  - Draft mode
  - Mode content storage
- **Linking System**
  - Link meta content to document sections
  - Section-level links
  - Paragraph-level links
  - Inline links
- **UI Features**
  - Show/hide meta content
  - Meta content panel
  - Visual link indicators
  - Mode switching
- **Storage & Management**
  - Meta content database schema
  - Link relationship tracking
  - Version history for meta content
  - Export meta content options

### Style System (Academic, Whitepaper, etc.)
- **Style Management**
  - Style CRUD operations
  - System vs. user-created styles
  - Style sharing
  - Style templates
- **Style Features**
  - Citation format (APA, MLA, Chicago, IEEE)
  - Heading styles (numbered, unnumbered)
  - Figure/table placement
  - Font and typography settings
  - Page layout (margins, size)
- **Style Application**
  - Apply style to documents
  - Style preview
  - Style validation
  - Format compatibility checking
- **Custom Styles**
  - Create custom styles
  - Style editor UI
  - Style export/import
  - Style marketplace (future)

### Template System (Format-Specific Template Linking)
- **Template Management**
  - Template CRUD operations
  - Template file upload (.tex, .md, .html)
  - Template categorization
  - Template metadata
- **Template Linking**
  - Link templates to documents
  - Format-specific template selection
  - Multiple templates per document (per format)
  - Template variable management
- **Template Processing**
  - Template file storage
  - Template variable substitution
  - Template application during export
  - Template preview
- **Template Library**
  - System-provided templates
  - User-created templates
  - Template sharing
  - Template marketplace (future)

---

## Phase 3: Scale

### Multi-Language Support
- **Content Translation**
  - Document translation
  - Multi-language document versions
  - Translation memory
  - Technical term preservation
- **UI Localization**
  - Interface translation
  - Language selection
  - RTL language support
  - Locale-specific formatting
- **Language Features**
  - Spell check (multiple languages)
  - Grammar check (multiple languages)
  - Language-specific AI models
  - Regional citation styles

### Enterprise Features
- **Organization Management**
  - Organization accounts
  - Team management
  - Role-based access control (RBAC)
  - Department/project organization
- **Security & Compliance**
  - SSO integration (SAML, OAuth)
  - Audit logs
  - Data encryption (at rest, in transit)
  - Compliance certifications (SOC 2, GDPR)
- **Administration**
  - Admin dashboard
  - User management
  - Usage analytics
  - Billing management
- **On-Premise Deployment**
  - Self-hosted option
  - Docker/Kubernetes deployment
  - Data residency controls
  - Custom domain support

### Advanced Analytics
- **Usage Analytics**
  - Document creation metrics
  - User activity tracking
  - Feature adoption rates
  - Performance metrics
- **Content Analytics**
  - Writing quality metrics
  - AI suggestion acceptance rates
  - Collaboration statistics
  - Export frequency
- **Business Analytics**
  - User engagement
  - Retention metrics
  - Conversion tracking
  - Revenue analytics
- **Reporting**
  - Custom reports
  - Scheduled reports
  - Data export
  - Dashboard customization

### API Platform
- **REST API**
  - Complete API coverage
  - API documentation
  - Rate limiting
  - Authentication (API keys, OAuth)
- **Webhooks**
  - Event subscriptions
  - Webhook delivery
  - Retry mechanisms
  - Webhook management UI
- **SDKs & Libraries**
  - JavaScript/TypeScript SDK
  - Python SDK
  - CLI tool
  - Community SDKs
- **API Features**
  - GraphQL endpoint (optional)
  - Batch operations
  - Webhook testing
  - API versioning

### Extended Meta Content Types (Commentary, Annotations)
- **Additional Meta Types**
  - Commentary mode
  - Annotations mode
  - Review notes
  - Discussion threads
- **Advanced Linking**
  - Multi-level linking
  - Cross-document links
  - Link relationships
  - Link visualization
- **Collaboration Integration**
  - Meta content in reviews
  - Annotations in comments
  - Discussion threads
  - Meta content permissions
- **Export & Publishing**
  - Include meta content in exports
  - Meta content as appendices
  - Separate meta content files
  - Publishing options for meta content
