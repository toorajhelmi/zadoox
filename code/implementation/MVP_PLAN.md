# Zadoox MVP Development Plan

## Overview

This document outlines the MVP development plan for Zadoox. It will be updated as we progress through implementation.

**MVP Scope**: Core document editor with basic AI features, document management, and LaTeX export.

**Target Timeline**: Focus on getting a working MVP with core features.

---

## Development Philosophy: Strict Implementation Mentality

**IMPORTANT**: This project follows a **strict implementation mentality**. 

Instead of adding error handling, defensive checks, or workarounds for things that "should exist", we **fix and implement things properly**:

- ❌ **Don't do**: Add error handling for missing environment variables, add checks for "if this doesn't exist", add fallbacks for incomplete implementations
- ✅ **Do**: Implement the missing environment variables, create the missing components, fix the root cause

**Examples**:
- If environment variables are missing → Set them up properly
- If a dependency is missing → Install and configure it
- If a feature is incomplete → Complete the implementation
- If something doesn't exist → Build it properly

**Principle**: Fix the problem, don't work around it.

---

## UX Guidelines

**IMPORTANT**: See `UX_GUIDELINES.md` for core UX principles that apply to all features.

**Key Principle**: Prefer inline/tabs over popups/modals whenever possible.

- ✅ Use tabs for switching between related views
- ✅ Use sidebars for secondary information
- ✅ Use inline panels that slide in/out
- ❌ Avoid modals for content viewing/editing
- ⚠️ Use modals only for critical confirmations or short forms

**Reference**: `code/UX_GUIDELINES.md` - Always check this before implementing new UI features.

---

## MVP Scope: What's IN

### ✅ Included Features

1. **Web Application (Next.js)**
   - User authentication (Supabase Auth)
   - Project dashboard
   - Document editor (Extended Markdown)
   - Document management (CRUD)
   - Chapter organization
   - Basic UI components (toolbar, sidebar, settings)
   - LaTeX/PDF export

2. **Backend API (Railway/Node.js)**
   - REST API for documents
   - Document CRUD operations
   - Export service (LaTeX conversion, PDF generation)
   - AI service (OpenAI integration):
     - Text analysis (quality, sentiment, wordiness, clarity)
     - Text improvement/expansion/clarification
     - Citation research (online + knowledge base search)
   - File upload/storage integration

3. **Shared Package**
   - TypeScript types
   - API client
   - Markdown utilities
   - LaTeX conversion utilities
   - Placeholder system

4. **Database (Supabase)**
   - Users table
   - Projects table
   - Documents table
   - Basic schema

5. **AI Features** (Core "WOW" Features)
   - Real-time AI analysis (quality, sentiment, wordiness, clarity)
   - Visual AI indicators (left margin indicators with hover actions)
   - Inline AI suggestions with underlines
   - One-click AI actions (Improve, Expand, Clarify, Condense)
   - AI-powered citation research (academic style, enabled by default)
   - Smart completion (context-aware autocomplete)
   - OpenAI integration

### ❌ Out of Scope (Future Phases)

See `POST_MVP_FEATURES.md` for detailed post-MVP feature list, including:
- Real-time collaboration (WebSocket)
- Code-doc linking
- Cursor extension
- Meta content system (ideation, fragments)
- Advanced AI features (batch operations, advanced suggestions)
- Git integration
- Mobile/Desktop apps
- Advanced style/template system
- Vector search
- Templates & snippets
- Advanced productivity features

---

## Implementation Phases

### Phase 0: Foundation Setup ✅
**Status**: ✅ COMPLETED

- [x] Initialize monorepo structure
- [x] Set up package.json workspaces (pnpm)
- [x] Create base package structure (web, backend, shared)
- [x] Set up TypeScript configs
- [x] Set up development environment
- [x] Configure ESLint/Prettier
- [x] Set up Git repository structure (gitignore, etc.)
- [x] Set up CI/CD (GitHub Actions):
  - [x] CI workflow (build, type-check, lint, test)
  - [x] GitHub Actions workflow file created
  - [x] Backend deployment workflow created (ready for Phase 3)

**Deliverables**:
- ✅ Working monorepo structure
- ✅ All packages configured (web, backend, shared)
- ✅ Development scripts configured
- ✅ TypeScript configs set up
- ✅ ESLint and Prettier configured
- ✅ CI workflow configured (.github/workflows/ci.yml)
- ✅ Backend deployment workflow ready (.github/workflows/deploy-backend.yml)
- ✅ Deployment guide created (code/DEPLOYMENT.md)

**Completed**: Basic monorepo structure with all three packages (web, backend, shared) set up with TypeScript, ESLint, and Prettier. Root package.json with workspace scripts. Next.js app structure initialized. Fastify backend server initialized. GitHub Actions CI workflow created (runs on push/PR to main/develop branches, performs type-check, lint, build, and test).

**Note**: Branch protection rules should be configured in GitHub repository settings. 

**Deployment**: 
- Backend deployment workflow (`.github/workflows/deploy-backend.yml`) is ready and will be activated in Phase 3 when backend API is ready
- Web app deployment uses Vercel's GitHub integration (no workflow needed) and will be set up in Phase 7
- See `code/DEPLOYMENT.md` for detailed deployment setup instructions

---

### Phase 1: Shared Package & Types ✅
**Status**: ✅ COMPLETED

- [x] Create shared package structure
- [x] Define TypeScript types:
  - [x] User types
  - [x] Project types
  - [x] Document types
  - [x] API request/response types
- [x] Basic utilities:
  - [x] ID generation (UUID v4, works in Node.js and browser)
  - [x] Validation utilities (email, strings, numbers, types)
  - [x] Constants (placeholders, markdown extensions)
- [x] Set up testing framework (Vitest)
- [x] Unit tests for utilities:
  - [x] ID generation tests (9 tests passing)
  - [x] Validation tests (18 tests passing)

**Deliverables**:
- ✅ Shared package with all core types
- ✅ Types exported and importable from `@zadoox/shared`
- ✅ Basic utilities working (ID generation, validation)
- ✅ Constants defined (placeholders: {CH}, {REF}, file extensions)
- ✅ Package builds successfully
- ✅ Testing framework set up (Vitest with coverage support)
- ✅ Unit tests for utilities (27 tests, all passing)

**Completed**: Created TypeScript types for User, Project, Document, and API request/response types. Added utility functions for ID generation and validation. Added constants for placeholders and file extensions. Set up Vitest testing framework with configuration. Created comprehensive unit tests for ID generation and validation utilities (27 tests, all passing). All code compiles and exports correctly.

---

### Phase 2: Database Schema & Supabase Setup ✅
**Status**: ✅ COMPLETED

- [x] Set up Supabase project
- [x] Create database schema:
  - [x] Users (use Supabase Auth, extend with profiles)
  - [x] Projects table
  - [x] Documents table
  - [x] Relationships and indexes
- [x] Set up Row Level Security (RLS) policies
- [x] Create database migrations
- [x] Set up Supabase client in backend

**Deliverables**:
- ✅ Database schema migration files created (001_initial_schema.sql, 002_rls_policies.sql, 003_create_profile_trigger.sql)
- ✅ RLS policies configured for all tables
- ✅ Supabase client setup in backend (`src/db/client.ts`)
- ✅ Database connection test script (`pnpm db:test`)
- ✅ Setup documentation created (`BACKEND_SETUP.md`, `src/db/README.md`)

**Completed**: Created complete database schema with user_profiles, projects, and documents tables. Set up comprehensive RLS policies to enforce access control. Created migration files for easy deployment. Set up Supabase client with both admin and user client options. Added database connection testing script. Created setup documentation and migration guide.

**Next Steps**: 
1. ✅ Add GitHub secret `DATABASE_URL` with PostgreSQL connection string (see `code/DEPLOYMENT.md`)
2. ✅ Migrations will run automatically via GitHub Actions on push to `main`
3. Create `.env` file with Supabase credentials (see `BACKEND_SETUP.md`)
4. Test database connection: `pnpm db:test`
5. Test migrations locally: `pnpm --filter backend db:migrate`
6. Once GitHub secret is configured and migrations run, Phase 2 is complete

---

### Phase 3: Backend API - Core Services ✅
**Status**: ✅ COMPLETED

- [x] Set up Fastify server
- [x] Authentication middleware (Supabase JWT)
- [x] API routes structure
- [x] Document Service:
  - [x] Create document
  - [x] Get document
  - [x] Update document
  - [x] Delete document
  - [x] List documents (by project)
- [x] Project Service:
  - [x] Create project
  - [x] Get project
  - [x] Update project
  - [x] Delete project
  - [x] List user projects
- [x] Error handling
- [x] Request validation (Zod schemas)
- [x] Unit tests for services (19 tests passing)
- [x] OpenAPI/Swagger documentation
- [x] Backend deployment configuration (Railway workflow ready, railway.toml configured) - Requires Railway account setup (see RAILWAY_SETUP.md)

**Deliverables**:
- ✅ Working REST API
- ✅ All CRUD operations functional
- ✅ Authentication working
- ✅ Unit tests for Document and Project services (19 tests passing)
- ✅ Request validation with Zod
- ✅ API testing guide (`API_TESTING.md`)
- ✅ OpenAPI/Swagger documentation (Swagger UI at /docs, OpenAPI JSON at /openapi.json)
- ✅ Backend deployment configuration (Railway workflow + railway.toml ready) - Requires Railway account setup (see `RAILWAY_SETUP.md`)

---

### Phase 4: Web App - Setup & Authentication ✅
**Status**: ✅ COMPLETED (Auth Temporarily Disabled - Will be fixed in Phase 14)

- [x] Initialize Next.js app
- [x] Set up Tailwind CSS
- [x] Configure Supabase client (client-side and server-side)
- [x] Authentication pages:
  - [x] Login page
  - [x] Signup page
  - [x] Auth state management (useAuth hook)
- [x] Protected route middleware
- [x] User session handling
- [x] Set up web app deployment (Vercel GitHub integration) - See `code/packages/web/VERCEL_SETUP.md`
- [ ] **Fix authentication cookie sync issue** (moved to Phase 14)

**Deliverables**:
- ✅ Next.js app running (already initialized)
- ✅ Authentication UI pages implemented (login/signup)
- ⚠️ Authentication temporarily disabled due to cookie sync issues
- ✅ Protected routes middleware structure in place (disabled for now)
- ✅ Web app deployment configured (Vercel) - Setup guide created

**Note**: Authentication is currently disabled to allow dashboard development. The sign-in/sign-up pages are implemented but session cookies are not syncing properly between client and server. This will be fixed in Phase 14.

---

### Phase 5: Web App - Project Dashboard ✅
**Status**: ✅ COMPLETED

- [x] Dashboard layout
- [x] Project list view
- [x] Create project modal/form
- [x] Project card component
- [x] Project settings page
- [x] Navigation structure
- [x] API integration (fetch projects)
- [ ] Add Vercel CLI deployment to GitHub Actions deploy workflow (revisit in Phase 5 later)

**Deliverables**:
- ✅ Dashboard page working
- ✅ Can create/view projects
- ✅ Navigation functional
- ✅ VS Code-like UI with AI elements
- ✅ API client for project operations
- ✅ Project detail pages

**Completed**: Created a VS Code-inspired dashboard with collapsible sidebar, project list view with cards, create project modal with AI branding, project detail pages, and API integration. The UI features VS Code dark theme colors, monospace fonts, and subtle AI indicators throughout.

**Note**: Vercel deployment is currently handled via GitHub integration (automatic deployments on push to main).

---

### Phase 6: Shared Package - Editor Logic ✅
**Status**: Not Started

- [ ] Markdown utilities:
  - [ ] Extended Markdown parser
  - [ ] Markdown renderer (HTML)
- [ ] LaTeX utilities:
  - [ ] LaTeX to Extended Markdown converter
  - [ ] Extended Markdown to LaTeX converter
- [ ] Placeholder system:
  - [ ] Placeholder resolver
  - [ ] Placeholder replacer
  - [ ] Placeholder validator
- [ ] Unit tests for editor logic:
  - [ ] Markdown parser tests
  - [ ] LaTeX converter tests
  - [ ] Placeholder system tests

**Deliverables**:
- Editor logic in shared package
- Markdown/LaTeX conversion working
- Placeholder system functional
- Unit tests for all editor logic functions

---

### Phase 7: Web App - Document Editor (Basic) ✅
**Status**: ✅ COMPLETED

- [x] Editor layout (sidebar, main, toolbar)
- [x] CodeMirror/Monaco integration
- [x] Markdown syntax highlighting
- [x] Basic text editing
- [x] Editor toolbar (basic buttons)
- [x] Document outline/sidebar
- [x] Auto-save functionality
- [x] Document state management
- [x] Formatting toolbar (bold, italic, underline, superscript, subscript, code, link)
- [x] Floating format menu on text selection
- [x] Markdown preview with view modes (edit, split, preview)
- [x] Breadcrumb navigation
- [x] Auto-create "Untitled Document" for projects
- [x] Line wrapping in editor

**Deliverables**:
- ✅ Editor page working
- ✅ Can edit documents
- ✅ Markdown highlighting working
- ✅ Auto-save functional
- ✅ Formatting tools functional
- ✅ Document outline working
- ✅ Preview mode working

**Completed**: Implemented a complete document editor with CodeMirror integration, markdown syntax highlighting, auto-save functionality, document state management, formatting toolbar, floating format menu, markdown preview with multiple view modes, breadcrumb navigation, and document outline. The editor automatically creates an "Untitled Document" for projects and provides a professional VS Code-inspired editing experience.

---

### Phase 7.5: Web App - Advanced Editing Features (MVP "WOW" Features) 🚀
**Status**: ✅ IN PROGRESS (Core Features Complete)

This phase focuses on the core AI-driven features that make Zadoox feel like a futuristic, intelligent writing tool. These features are designed to create a "WOW" experience for users and investors, demonstrating the AI-powered nature of the editor.

**Note**: Advanced features like collaboration, batch operations, templates, and productivity tools are documented in `POST_MVP_FEATURES.md` for future implementation.

#### Category 1: Visual AI Indicators & Metadata (The "WOW" Factor) ✅

- [x] **Left margin indicator system**:
  - [x] Color-coded vertical indicators (red/yellow/green/blue/gray)
  - [x] Multiple stacked indicators when needed (errors + suggestions)
  - [x] Indicator states: error, warning, suggestion, good, pending
  - [x] Visual bar/dot indicators aligned with paragraphs
  - [x] Hover on indicator → Quick action menu
  - [x] Real-time updates as user types

- [x] **Paragraph-level metadata & hover interactions**:
  - [x] Quality score calculation and display
  - [x] AI analysis metrics (sentiment, wordiness, clarity)
  - [x] Paragraph hover highlight effect
  - [x] Info banner on paragraph hover (top of paragraph)
  - [x] Quick action buttons in banner (Improve, Expand, Clarify, View Details)
  - [x] Last edit timestamp (optional, can be toggled)

#### Category 2: Real-Time AI Analysis & Inline Suggestions ✅

- [x] **Real-time content analysis** (background, debounced):
  - [x] Quality scoring algorithm
  - [x] Sentiment analysis
  - [x] Wordiness detection
  - [x] Clarity scoring
  - [x] Grammar and style checks
  - [x] Updates indicators in real-time
  - [x] Timeout handling (30s) to prevent stuck "Analyzing..." state
  - [x] Error handling and state recovery

- [ ] **Inline AI indicators**:
  - [ ] Visual underlines (wavy/straight) for issues
  - [ ] Color-coded: red (error), yellow (warning), blue (suggestion)
  - [ ] Hover tooltips showing specific issues
  - [ ] Click to accept/apply suggestions
  - [ ] Keyboard shortcuts (Ctrl+. to see suggestions)

- [x] **Smart AI suggestions**:
  - [x] Context-aware improvement suggestions
  - [x] Tone/style suggestions
  - [x] Clarity improvements
  - [x] Concision suggestions (reduce wordiness)
  - [x] Structure suggestions for paragraphs

#### Category 3: One-Click AI Writing Assistance

- [x] **AI editing actions** (quick access buttons):
  - [x] One-click "Improve" button (in hover banner)
  - [x] "Expand" button (adds content)
  - [x] "Clarify" button (improves clarity)
  - [x] "Condense" button (reduces wordiness)
  - [x] "Formalize" / "Casualize" (tone adjustment)
  - [x] Loading states and progress indicators

- [ ] **Smart completion**:
  - [ ] Context-aware autocomplete (AI-powered)
  - [ ] Expand selection with AI
  - [ ] Inline suggestions appear as user types
  - [ ] Accept with Tab/Enter

#### Category 4: AI-Powered Citation Research (Academic Style) 🔬

- [ ] **Automatic citation research** (enabled by default for academic style):
  - [ ] Research online sources based on content context
  - [ ] Search within user's existing knowledge base (all previous documents)
  - [ ] Search user-provided sources (uploaded documents, references)
  - [ ] AI suggests relevant citations as user writes
  - [ ] Citation suggestions appear inline with content

- [ ] **Citation suggestion UI**:
  - [ ] Inline citation chips/badges showing suggested sources
  - [ ] Hover to see citation summary (title, author, relevance)
  - [ ] Click to view full document/source preview
  - [ ] One-click to insert citation in proper format
  - [ ] Citation format based on project style (APA, MLA, Chicago, etc.)

- [ ] **Citation management**:
  - [ ] View all suggested citations for document
  - [ ] Accept/reject citations
  - [ ] Manual citation addition
  - [ ] Citation library (saved citations for reuse)
  - [ ] Citation formatting per style guide

- [ ] **Configuration**:
  - [ ] Enable/disable per project (project settings)
  - [ ] Configure per style (academic, industrial, etc.) in global settings
  - [ ] Toggle online research vs. knowledge base only
  - [ ] Configure citation style preferences

**Deliverables**:
- ✅ Visual AI indicators system (left margin + hover interactions)
- ✅ Real-time AI analysis with debounced background processing (Category 2 complete)
- ✅ Timeout and error handling for AI analysis (prevents stuck states)
- ✅ One-click AI writing assistance (Improve, Expand, Clarify, Condense, Tone adjustment)
- ✅ Cursor-style AI model selection (openai/auto) with extensible provider system
- ✅ Backend AI service with OpenAI integration
- ✅ AI API endpoints (analyze, action, suggest, models)
- ⏳ Inline AI suggestion indicators (underlines) - TODO
- ⏳ Smart completion system - TODO
- ⏳ AI-powered citation research system - TODO
- ✅ Professional, futuristic editor experience foundation

**Completed**: 
- Backend AI service with Cursor-style model abstraction (supports openai/auto, extensible for more models)
- AI API endpoints for analysis, actions, and suggestions
- Left margin indicator system with color-coded indicators
- Paragraph metadata tracking and hover info banner
- Real-time AI analysis with debounced processing
- One-click AI actions integrated into hover banner
- AI-enhanced editor component that wraps CodeMirror with AI features

**Next Steps**:
- Add inline suggestion underlines (CodeMirror decorations)
- Implement smart completion with context-aware autocomplete
- Add citation research service (Phase 9 backend + Phase 7.5 frontend)

---

### Phase 7.5.c2: Fix AI Analysis Timeout & Complete Category 2 ✅
**Status**: ✅ COMPLETED

**Changes**:
- Fixed "Analyzing..." stuck state by adding 30-second timeout to AI analysis calls
- Improved error handling in `useAIAnalysis` hook to properly reset state on failures
- Ensured paragraph state is always reset even if API call fails or times out
- Category 2 features (Real-Time AI Analysis) marked as complete

**Technical Details**:
- Added `ANALYSIS_TIMEOUT` constant (30 seconds)
- Implemented `Promise.race()` between analysis and timeout
- Enhanced error handling to reset `isAnalyzing` state in all error scenarios
- Fixed state management to prevent paragraphs from staying in analyzing state indefinitely

---

### Phase 7.6: Document Versioning System 📝
**Status**: ✅ COMPLETED

This phase implements delta-based document versioning to efficiently track document changes over time.

#### Version Triggers (What creates a new version):
- **Auto-save**: Periodic saves after inactivity (default: 2 seconds of no typing)
  - Ctrl+S / Cmd+S triggers immediate auto-save (no delay)
- **AI Actions**: When AI improves/expands/clarifies text (creates a new version with changeType: 'ai-action')
- **Future**: Milestone Events (Publish, Submit for Review, etc.) - not yet implemented

#### Implementation:
- [x] **Database Schema**:
  - [x] Create `document_versions` table with delta storage
  - [x] Create `document_version_metadata` table for quick queries
  - [x] Migration for existing documents (create initial version)
  
- [x] **Backend Service**:
  - [x] Version service for creating/retrieving versions
  - [x] Delta calculation using diff-match-patch algorithm
  - [x] Version reconstruction from deltas
  - [x] Snapshot management (every 10 versions)
  - [x] API endpoints for version history (list, get, get content, metadata)
  
- [x] **Frontend Integration**:
  - [x] Auto-save with version creation (changeType: 'auto-save', 2 second delay)
  - [x] Ctrl+S / Cmd+S shortcut triggers immediate auto-save (no delay)
  - [x] Version history UI (modal with version list)
  - [x] Version comparison/diff view (side-by-side comparison)
  - [x] Rollback to previous version functionality
  - [x] AI actions create versions (changeType: 'ai-action')

**Deliverables**:
- ✅ Delta-based versioning system
- ✅ Efficient storage (deltas + periodic snapshots)
- ✅ Version history UI with modal interface
- ✅ Rollback functionality
- ✅ API endpoints for version management
- ✅ Keyboard shortcuts (Ctrl+S / Cmd+S for immediate auto-save)
- ✅ Version comparison view

**Completed**: 
- Backend versioning system with delta-based storage and snapshot management
- Frontend integration with auto-save, manual save, and AI action versioning
- Version history modal UI with version list, content viewing, and comparison
- Rollback functionality to restore previous versions
- All version triggers implemented (auto-save, ai-action)
- Simplified UX: Auto-save only (no manual save button, Ctrl+S triggers immediate auto-save)

---

### Phase 8: Backend API - Export Service ✅
**Status**: Not Started

- [ ] Extended Markdown parser
- [ ] LaTeX converter:
  - [ ] Markdown → LaTeX conversion
  - [ ] Placeholder replacement ({REF}, {CH})
  - [ ] Math support
  - [ ] Image handling
- [ ] PDF generation:
  - [ ] LaTeX compilation integration
  - [ ] Template support (basic)
  - [ ] Error handling
- [ ] Export API endpoint
- [ ] File storage integration (Supabase Storage)

**Deliverables**:
- Export API working
- Can convert Extended Markdown to LaTeX
- Can generate PDF from LaTeX
- Downloads working

---

### Phase 9: Backend API - AI Service ✅
**Status**: Not Started

- [ ] OpenAI integration
- [ ] AI Service structure:
  - [ ] Prompt management
  - [ ] Context building
  - [ ] Response caching (basic)
- [ ] AI endpoints:
  - [ ] Suggest text completion
  - [ ] Expand text
  - [ ] Improve text
  - [ ] Analyze text (quality, sentiment, wordiness, clarity)
  - [ ] Clarify text
  - [ ] Condense text
  - [ ] Adjust tone (formalize/casualize)
- [ ] **Citation Research Service**:
  - [ ] Online research integration (web search API)
  - [ ] Knowledge base search (user's documents)
  - [ ] Source relevance scoring
  - [ ] Citation suggestion generation
  - [ ] Citation format conversion (APA, MLA, Chicago, etc.)
  - [ ] Source document indexing and search
- [ ] Rate limiting
- [ ] Error handling

**Deliverables**:
- AI service working
- OpenAI integration functional
- AI endpoints tested
- Citation research service functional
- Knowledge base search working

---

### Phase 10: Web App - Editor Features ✅
**Status**: Not Started

- [ ] Extended Markdown support
- [ ] Placeholder support ({REF}, {CH})
- [ ] Image upload/insertion
- [ ] Table creation/editing
- [ ] Basic formatting toolbar
- [ ] Find/replace
- [ ] LaTeX preview (optional, basic)

**Deliverables**:
- Extended Markdown features working
- Image insertion working
- Table support
- Formatting toolbar functional

---

### Phase 11: Web App - AI Integration ✅
**Status**: Not Started

- [ ] AI suggestion UI component
- [ ] Inline suggestions (accept with Tab)
- [ ] AI toolbar/menu:
  - [ ] Expand text
  - [ ] Improve text
  - [ ] Suggest completion
- [ ] Loading states
- [ ] Error handling

**Deliverables**:
- AI features in UI
- Inline suggestions working
- AI toolbar functional

---

### Phase 12: Web App - Export UI ✅
**Status**: Not Started

- [ ] Export dialog/modal
- [ ] Export format selection (LaTeX, PDF)
- [ ] Export button/trigger
- [ ] Download handling
- [ ] Export progress indicator
- [ ] Error handling

**Deliverables**:
- Export UI working
- Can export to LaTeX
- Can export to PDF
- Downloads working

---

### Phase 13: Shared Package - API Client ✅
**Status**: Not Started

- [ ] API client setup
- [ ] Authentication handling
- [ ] Document API methods
- [ ] Project API methods
- [ ] Export API methods
- [ ] AI API methods
- [ ] Error handling
- [ ] Type-safe API calls

**Deliverables**:
- API client in shared package
- All API methods implemented
- Type-safe API usage
- Used in web app

---


### Phase 14: Integration & Testing ✅
**Status**: Not Started

- [ ] **Fix and re-enable authentication**:
  - [ ] Fix Supabase session cookie sync between client and server
  - [ ] Re-enable protected route checks in dashboard
  - [ ] Re-enable authentication middleware
  - [ ] Test sign-in/sign-up flow end-to-end
  - [ ] Verify session persistence across page refreshes
- [ ] Integration tests for API endpoints
- [ ] End-to-end testing (optional for MVP)
- [ ] Fix integration issues
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] UI/UX polish
- [ ] Documentation

**Deliverables**:
- ✅ Authentication fully working (sign-in, sign-up, session management)
- All features working together
- MVP functional and tested
- Integration tests passing
- Basic documentation

---

## Technical Stack Decisions

### Confirmed
- **Web**: Next.js 14+ (App Router), React 18, Tailwind CSS
- **Backend**: Node.js, Express/Fastify, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth
- **AI**: OpenAI (GPT-4 or GPT-3.5-turbo)
- **Editor**: CodeMirror 6 or Monaco Editor
- **Monorepo**: pnpm workspaces

### To Decide
- [ ] Express vs Fastify (recommend: Fastify for better performance)
- [ ] CodeMirror vs Monaco (recommend: CodeMirror for lighter weight)
- [ ] State management: Zustand vs React Query (recommend: Zustand + React Query)
- [ ] LaTeX compilation: Local vs API (recommend: Backend service with docker)

---

## File Structure (What We'll Build)

```
code/
├── packages/
│   ├── shared/               # Phase 1, 8, 13
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   ├── editor/
│   │   │   ├── api/
│   │   │   └── constants/
│   │   └── package.json
│   │
│   ├── backend/              # Phase 3, 6, 7
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── api/
│   │   │   ├── services/
│   │   │   ├── db/
│   │   │   └── config/
│   │   └── package.json
│   │
│   └── web/                  # Phase 4-5, 9-12
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── package.json
│
├── package.json              # Root (Phase 0)
├── pnpm-workspace.yaml       # Phase 0
└── tsconfig.json             # Phase 0
```

---

## Development Order

1. **Phase 0**: Foundation (monorepo setup, CI/CD infrastructure)
2. **Phase 1**: Shared types + testing framework setup
3. **Phase 2**: Database schema
4. **Phase 3**: Backend core API (+ unit tests, deployment setup)
5. **Phase 6**: Shared editor logic (needed for Phase 4) (+ unit tests)
6. **Phase 4**: Export service (+ unit tests)
7. **Phase 5**: AI service (+ unit tests)
8. **Phase 13**: API client (needed for Phase 7+)
9. **Phase 7**: Web app setup & auth (+ deployment setup)
10. **Phase 8**: Dashboard
11. **Phase 9**: Basic editor
12. **Phase 10**: Editor features
13. **Phase 11**: AI integration
14. **Phase 12**: Export UI
15. **Phase 14**: Integration & testing (integration tests, E2E)

---

## Dependencies Between Phases

```
Phase 0 (Foundation)
    ↓
Phase 1 (Shared Types)
    ↓
Phase 2 (Database) ──┐
    ↓                │
Phase 3 (Backend Core) ──┐
    ↓                    │
Phase 13 (API Client) ───┤
    ↓                    │
Phase 4 (Web Setup) ─────┤
    ↓                    │
Phase 5 (Dashboard) ─────┤
    ↓                    │
Phase 7 (AI)             │
    ↓                    │
Phase 8 (Editor Logic)    │
    ↓                    │
Phase 9 (Basic Editor) ──┤
    ↓                    │
Phase 10 (Editor Features)┤
    ↓                     │
Phase 11 (AI UI) ─────────┤
    ↓                     │
Phase 6 (Export) ─────────┤
    ↓                     │
Phase 12 (Export UI) ─────┤
    ↓                     │
Phase 14 (Integration) ←──┘
```

---

## Success Criteria

### MVP is Complete When:

1. ✅ Users can sign up and log in
2. ✅ Users can create projects
3. ✅ Users can create/edit/delete documents
4. ✅ Document editor supports Extended Markdown
5. ✅ Placeholder system works ({REF}, {CH})
6. ✅ AI suggestions work (inline, expand, improve)
7. ✅ Can export to LaTeX
8. ✅ Can export to PDF
9. ✅ Documents persist in database
10. ✅ Images can be uploaded and inserted

---

## Notes & Decisions

### Architecture Decisions
- Using Supabase Realtime for future collaboration (not in MVP)
- Backend on Railway for WebSocket support (future) and long-running tasks
- Shared package for code reuse between web and future mobile/desktop

### Technical Debt (Acceptable for MVP)
- Basic error handling (can improve later)
- Simple UI (can polish later)
- No caching layer (can add later)
- Basic AI prompts (can refine later)
- No rate limiting on AI (can add later)
- Simple export templates (can enhance later)

---

## Progress Tracking

**Last Updated**: December 20, 2024

**Current Phase**: Phase 4 - Web App Setup (Auth Temporarily Disabled)

**Next Steps**: 
1. Continue with Phase 5 - Project Dashboard (auth disabled for now)
2. Build out remaining web app features (Phases 5-12)
3. Fix authentication in Phase 14 - Integration & Testing
4. Complete integration testing and polish

---

## Questions to Resolve

- [ ] Express vs Fastify? → **Decision**: Fastify (better performance, TypeScript-first)
- [ ] CodeMirror vs Monaco? → **Decision**: CodeMirror 6 (lighter, extensible)
- [ ] State management? → **Decision**: Zustand + React Query
- [ ] LaTeX compilation method? → **Decision**: Backend service with Docker

