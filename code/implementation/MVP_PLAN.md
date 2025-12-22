# Zadoox MVP Development Plan

## Overview

This document outlines the MVP development plan for Zadoox. It will be updated as we progress through implementation.

**MVP Scope**: Core document editor with basic AI features, document management, and LaTeX export.

**Target Timeline**: Focus on getting a working MVP with core features.

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
   - Basic AI service (OpenAI integration)
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

5. **Basic AI Features**
   - Inline writing suggestions
   - Text expansion
   - Basic grammar/improvements
   - OpenAI integration

### ❌ Out of Scope (Future Phases)

- Real-time collaboration (WebSocket)
- Code-doc linking
- Cursor extension
- Meta content system (ideation, fragments)
- Advanced AI features (references, translation)
- Git integration
- Mobile/Desktop apps
- Style/Template system
- Vector search

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
**Status**: Partially Complete (Auth Temporarily Disabled)

- [x] Initialize Next.js app
- [x] Set up Tailwind CSS
- [x] Configure Supabase client (client-side and server-side)
- [x] Authentication pages:
  - [x] Login page
  - [x] Signup page
  - [x] Auth state management (useAuth hook)
- [x] Protected route middleware
- [x] User session handling
- [ ] Set up web app deployment (Vercel GitHub integration)
- [ ] **Fix authentication cookie sync issue** (moved to Phase 14)

**Deliverables**:
- ✅ Next.js app running (already initialized)
- ✅ Authentication UI pages implemented (login/signup)
- ⚠️ Authentication temporarily disabled due to cookie sync issues
- ✅ Protected routes middleware structure in place (disabled for now)
- ⏳ Web app deployment configured (Vercel) - TODO

**Note**: Authentication is currently disabled to allow dashboard development. The sign-in/sign-up pages are implemented but session cookies are not syncing properly between client and server. This will be fixed in Phase 14.

---

### Phase 5: Web App - Project Dashboard ✅
**Status**: Not Started

- [ ] Dashboard layout
- [ ] Project list view
- [ ] Create project modal/form
- [ ] Project card component
- [ ] Project settings page
- [ ] Navigation structure
- [ ] API integration (fetch projects)

**Deliverables**:
- Dashboard page working
- Can create/view projects
- Navigation functional

---

### Phase 6: Backend API - Export Service ✅
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

### Phase 7: Backend API - AI Service ✅
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
- [ ] Rate limiting
- [ ] Error handling

**Deliverables**:
- AI service working
- OpenAI integration functional
- AI endpoints tested

---

### Phase 8: Shared Package - Editor Logic ✅
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

### Phase 9: Web App - Document Editor (Basic) ✅
**Status**: Not Started

- [ ] Editor layout (sidebar, main, toolbar)
- [ ] CodeMirror/Monaco integration
- [ ] Markdown syntax highlighting
- [ ] Basic text editing
- [ ] Editor toolbar (basic buttons)
- [ ] Document outline/sidebar
- [ ] Auto-save functionality
- [ ] Document state management

**Deliverables**:
- Editor page working
- Can edit documents
- Markdown highlighting working
- Auto-save functional

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

