# Zadoox Application Folder Structure

## Proposed Structure

```
code/
├── packages/
│   ├── web/                          # Next.js Web Application
│   │   ├── app/                      # Next.js 13+ App Router
│   │   │   ├── (auth)/               # Auth routes
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (dashboard)/          # Protected routes
│   │   │   │   ├── dashboard/
│   │   │   │   ├── projects/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── editor/   # Document editor
│   │   │   │   │   │   └── settings/
│   │   │   │   │   └── new/
│   │   │   │   └── settings/
│   │   │   ├── api/                  # Next.js API routes (proxy to backend)
│   │   │   └── layout.tsx
│   │   ├── components/               # React components
│   │   │   ├── editor/               # Editor components
│   │   │   │   ├── Editor.tsx        # Main editor component
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   ├── Sidebar.tsx       # Document outline
│   │   │   │   ├── Preview.tsx       # LaTeX preview
│   │   │   │   ├── BottomPanel.tsx   # Formatting toolbar
│   │   │   │   └── CommandPalette.tsx # Backslash commands
│   │   │   ├── ai/                   # AI components
│   │   │   │   ├── AISuggestions.tsx
│   │   │   │   ├── AIAssistant.tsx
│   │   │   │   └── ContentGenerator.tsx
│   │   │   ├── collaboration/        # Real-time collaboration
│   │   │   │   ├── PresenceIndicator.tsx
│   │   │   │   ├── CursorOverlay.tsx
│   │   │   │   └── CommentsPanel.tsx
│   │   │   ├── meta-content/         # Meta content UI
│   │   │   │   ├── MetaContentPanel.tsx
│   │   │   │   ├── IdeationView.tsx
│   │   │   │   └── FragmentView.tsx
│   │   │   ├── code-links/           # Code-doc linking
│   │   │   │   ├── CodeLinkPanel.tsx
│   │   │   │   └── CodeElementSelector.tsx
│   │   │   ├── export/               # Export UI
│   │   │   │   └── ExportDialog.tsx
│   │   │   └── ui/                   # Shared UI components
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       └── ...
│   │   ├── lib/                      # Web-specific utilities
│   │   │   ├── api/                  # Web API client wrapper
│   │   │   ├── websocket/            # WebSocket client wrapper
│   │   │   └── platform/             # Web platform adapters
│   │   │       ├── storage.ts        # Browser storage adapter
│   │   │       └── file-system.ts    # Browser file system adapter
│   │   ├── hooks/                    # React hooks
│   │   │   ├── useDocument.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useAI.ts
│   │   │   └── useCollaboration.ts
│   │   ├── styles/                   # Styles
│   │   ├── types/                    # TypeScript types (re-export from shared)
│   │   ├── public/                   # Static assets
│   │   ├── package.json
│   │   └── next.config.js
│   │
│   ├── mobile/                       # React Native Mobile Application
│   │   ├── src/
│   │   │   ├── app/                  # App navigation (React Navigation)
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── LoginScreen.tsx
│   │   │   │   │   └── SignupScreen.tsx
│   │   │   │   ├── (tabs)/
│   │   │   │   │   ├── DashboardScreen.tsx
│   │   │   │   │   ├── ProjectsScreen.tsx
│   │   │   │   │   ├── EditorScreen.tsx
│   │   │   │   │   └── SettingsScreen.tsx
│   │   │   │   └── navigation.tsx
│   │   │   ├── components/           # React Native components
│   │   │   │   ├── editor/           # Editor components
│   │   │   │   │   ├── Editor.tsx
│   │   │   │   │   ├── Toolbar.tsx
│   │   │   │   │   └── Preview.tsx
│   │   │   │   ├── ai/               # AI components
│   │   │   │   ├── collaboration/    # Collaboration components
│   │   │   │   ├── meta-content/     # Meta content UI
│   │   │   │   └── ui/               # Shared UI components
│   │   │   ├── lib/                  # Mobile-specific utilities
│   │   │   │   ├── api/              # Mobile API client wrapper
│   │   │   │   ├── websocket/        # WebSocket client wrapper
│   │   │   │   └── platform/         # Mobile platform adapters
│   │   │   │       ├── storage.ts    # AsyncStorage adapter
│   │   │   │       ├── file-system.ts # RN FileSystem adapter
│   │   │   │       └── notifications.ts
│   │   │   ├── hooks/                # React Native hooks
│   │   │   │   ├── useDocument.ts
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   └── useAI.ts
│   │   │   ├── store/                # State management (Zustand/Redux)
│   │   │   ├── assets/               # Images, fonts, etc.
│   │   │   ├── types/                # TypeScript types (re-export from shared)
│   │   │   ├── App.tsx
│   │   │   └── index.ts
│   │   ├── ios/                      # iOS native code
│   │   ├── android/                  # Android native code
│   │   ├── package.json
│   │   └── app.json                  # Expo config (if using Expo)
│   │
│   ├── desktop/                      # Electron Desktop Application
│   │   ├── src/
│   │   │   ├── main/                 # Main process (Electron)
│   │   │   │   ├── main.ts           # Main process entry
│   │   │   │   ├── window.ts         # Window management
│   │   │   │   ├── menu.ts           # Application menu
│   │   │   │   └── updater.ts        # Auto-updater
│   │   │   ├── renderer/             # Renderer process (React)
│   │   │   │   ├── app/              # App routes/pages
│   │   │   │   │   ├── Dashboard.tsx
│   │   │   │   │   ├── Editor.tsx
│   │   │   │   │   └── Settings.tsx
│   │   │   │   ├── components/       # React components
│   │   │   │   │   ├── editor/
│   │   │   │   │   ├── ai/
│   │   │   │   │   └── ui/
│   │   │   │   ├── lib/              # Desktop-specific utilities
│   │   │   │   │   ├── api/          # Desktop API client wrapper
│   │   │   │   │   ├── websocket/    # WebSocket client wrapper
│   │   │   │   │   └── platform/     # Desktop platform adapters
│   │   │   │   │       ├── storage.ts # Electron Store
│   │   │   │   │       ├── file-system.ts # Node.js fs access (via Electron)
│   │   │   │   │       └── native.ts  # Native OS APIs (via Electron)
│   │   │   │   ├── hooks/
│   │   │   │   ├── store/
│   │   │   │   └── types/            # TypeScript types (re-export from shared)
│   │   │   ├── preload/              # Preload scripts (Electron)
│   │   │   │   └── preload.ts
│   │   │   └── shared/               # Shared between main/renderer (Electron)
│   │   │       └── types.ts
│   │   ├── resources/                # Resources (icons, etc.)
│   │   ├── package.json
│   │   └── electron-builder.json     # Electron builder config
│   │
│   ├── backend/                      # Node.js Backend Services
│   │   ├── src/
│   │   │   ├── server.ts             # Main server entry
│   │   │   ├── app.ts                # Express app setup
│   │   │   │
│   │   │   ├── api/                  # REST API routes
│   │   │   │   ├── documents/
│   │   │   │   │   ├── routes.ts
│   │   │   │   │   └── handlers.ts
│   │   │   │   ├── meta-content/
│   │   │   │   ├── ai/
│   │   │   │   ├── code/
│   │   │   │   ├── export/
│   │   │   │   ├── styles/
│   │   │   │   ├── templates/
│   │   │   │   ├── projects/
│   │   │   │   └── auth/
│   │   │   │
│   │   │   ├── services/             # Business logic services
│   │   │   │   ├── document/
│   │   │   │   │   ├── DocumentService.ts
│   │   │   │   │   └── DocumentRepository.ts
│   │   │   │   ├── ai/
│   │   │   │   │   ├── AIService.ts
│   │   │   │   │   ├── PromptManager.ts
│   │   │   │   │   └── providers/    # OpenAI, Anthropic, etc.
│   │   │   │   ├── code-analysis/
│   │   │   │   │   ├── CodeAnalysisService.ts
│   │   │   │   │   └── analyzers/    # Language-specific analyzers
│   │   │   │   ├── sync/
│   │   │   │   │   ├── SyncService.ts
│   │   │   │   │   └── ConflictResolver.ts
│   │   │   │   ├── export/
│   │   │   │   │   ├── ExportService.ts
│   │   │   │   │   ├── converters/   # Markdown→LaTeX, etc.
│   │   │   │   │   └── generators/   # PDF generator
│   │   │   │   ├── style/
│   │   │   │   │   └── StyleService.ts
│   │   │   │   ├── template/
│   │   │   │   │   └── TemplateService.ts
│   │   │   │   ├── meta-content/
│   │   │   │   │   └── MetaContentService.ts
│   │   │   │   ├── git/
│   │   │   │   │   └── GitService.ts
│   │   │   │   └── collaboration/
│   │   │   │       └── CollaborationService.ts
│   │   │   │
│   │   │   ├── middleware/           # Express middleware
│   │   │   │   ├── auth.ts
│   │   │   │   ├── error.ts
│   │   │   │   └── validation.ts
│   │   │   │
│   │   │   ├── websocket/            # WebSocket server
│   │   │   │   ├── server.ts
│   │   │   │   ├── handlers/
│   │   │   │   │   ├── document.ts
│   │   │   │   │   ├── collaboration.ts
│   │   │   │   │   └── sync.ts
│   │   │   │   └── rooms.ts          # Room management
│   │   │   │
│   │   │   ├── db/                   # Database layer
│   │   │   │   ├── client.ts         # Supabase client
│   │   │   │   ├── migrations/       # Database migrations
│   │   │   │   └── seeds/            # Seed data
│   │   │   │
│   │   │   ├── storage/              # File storage
│   │   │   │   ├── s3.ts
│   │   │   │   └── local.ts          # For development
│   │   │   │
│   │   │   ├── cache/                # Redis client
│   │   │   │   └── redis.ts
│   │   │   │
│   │   │   ├── vector/               # Vector DB client
│   │   │   │   └── vector.ts
│   │   │   │
│   │   │   ├── utils/                # Utilities
│   │   │   │   ├── logger.ts
│   │   │   │   └── errors.ts
│   │   │   │
│   │   │   └── config/               # Configuration
│   │   │       ├── env.ts
│   │   │       └── constants.ts
│   │   │
│   │   ├── tests/                    # Backend tests
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cursor-extension/             # Cursor/VS Code Extension
│   │   ├── src/
│   │   │   ├── extension.ts          # Extension entry point
│   │   │   ├── commands/             # VS Code commands
│   │   │   │   ├── connect.ts
│   │   │   │   ├── link.ts
│   │   │   │   └── sync.ts
│   │   │   ├── services/
│   │   │   │   ├── CodeAnalyzer.ts
│   │   │   │   ├── SyncClient.ts
│   │   │   │   ├── LinkManager.ts
│   │   │   │   └── DocGenerator.ts
│   │   │   ├── webview/              # Webview panels
│   │   │   │   ├── DocumentPanel.ts
│   │   │   │   └── LinkPanel.ts
│   │   │   ├── tree-sitter/          # Code analysis
│   │   │   │   └── parsers/          # Language parsers
│   │   │   └── types/
│   │   ├── package.json              # VS Code extension manifest
│   │   └── tsconfig.json
│   │
│   └── shared/                       # Shared code across all packages
│       ├── types/                    # Shared TypeScript types
│       │   ├── document.ts
│       │   ├── meta-content.ts
│       │   ├── code-link.ts
│       │   ├── style.ts
│       │   ├── template.ts
│       │   ├── api.ts                # API request/response types
│       │   ├── project.ts
│       │   └── user.ts
│       │
│       ├── api/                      # API client (platform-agnostic)
│       │   ├── client.ts             # Core API client
│       │   ├── endpoints.ts          # API endpoint definitions
│       │   ├── documents.ts          # Document API methods
│       │   ├── meta-content.ts       # Meta content API methods
│       │   ├── ai.ts                 # AI API methods
│       │   ├── export.ts             # Export API methods
│       │   └── adapters/             # Platform-specific adapters
│       │       ├── base.ts           # Base adapter interface
│       │       ├── fetch.ts          # Fetch-based adapter (web)
│       │       ├── react-native.ts   # React Native adapter
│       │       └── electron.ts       # Electron adapter
│       │
│       ├── websocket/                # WebSocket client (platform-agnostic)
│       │   ├── client.ts             # Core WebSocket client
│       │   ├── events.ts             # Event types and handlers
│       │   └── adapters/             # Platform-specific adapters
│       │       ├── base.ts
│       │       ├── native-ws.ts      # Native WebSocket (web)
│       │       ├── react-native.ts   # React Native WebSocket
│       │       └── electron.ts       # Electron WebSocket
│       │
│       ├── editor/                   # Core editor logic (platform-agnostic)
│       │   ├── markdown/             # Markdown processing
│       │   │   ├── parser.ts         # Parse Extended Markdown
│       │   │   ├── renderer.ts       # Render to HTML/React
│       │   │   └── ast.ts            # AST types
│       │   ├── latex/                # LaTeX conversion
│       │   │   ├── converter.ts      # LaTeX ↔ Extended Markdown
│       │   │   ├── parser.ts         # Parse LaTeX syntax
│       │   │   └── generator.ts      # Generate LaTeX
│       │   ├── placeholders/         # Placeholder system
│       │   │   ├── resolver.ts       # Resolve {REF}, {CH}, etc.
│       │   │   ├── replacer.ts       # Replace placeholders
│       │   │   └── validator.ts      # Validate placeholder syntax
│       │   └── normalization/        # Content normalization
│       │       └── normalizer.ts     # Normalize to Extended Markdown
│       │
│       ├── state/                    # Shared state management logic
│       │   ├── document-store.ts     # Document state logic
│       │   ├── project-store.ts      # Project state logic
│       │   ├── collaboration-store.ts # Collaboration state logic
│       │   └── cache/                # Client-side caching logic
│       │       ├── document-cache.ts
│       │       └── meta-content-cache.ts
│       │
│       ├── services/                 # Client-side service logic
│       │   ├── document-service.ts   # Document operations
│       │   ├── meta-content-service.ts # Meta content operations
│       │   ├── export-service.ts     # Export operations
│       │   └── sync-service.ts       # Sync logic (platform-agnostic)
│       │
│       ├── validation/               # Validation logic
│       │   ├── document.ts           # Document validation
│       │   ├── markdown.ts           # Markdown validation
│       │   └── api.ts                # API payload validation
│       │
│       ├── utils/                    # Shared utilities
│       │   ├── string.ts             # String utilities
│       │   ├── date.ts               # Date utilities
│       │   ├── id.ts                 # ID generation
│       │   └── diff.ts               # Diff/merge utilities
│       │
│       ├── constants/                # Shared constants
│       │   ├── placeholders.ts       # {REF}, {CH}, etc.
│       │   ├── markdown.ts           # Markdown constants
│       │   ├── latex.ts              # LaTeX constants
│       │   └── api.ts                # API constants
│       │
│       └── package.json
│
├── infrastructure/                   # Infrastructure as Code
│   ├── docker/
│   │   ├── Dockerfile.web
│   │   ├── Dockerfile.mobile         # For mobile build servers (optional)
│   │   ├── Dockerfile.desktop        # For desktop build servers (optional)
│   │   ├── Dockerfile.backend
│   │   └── docker-compose.yml        # Local development
│   ├── kubernetes/                   # K8s manifests (optional)
│   └── terraform/                    # Cloud infrastructure (optional)
│
├── scripts/                          # Utility scripts
│   ├── setup.sh                      # Initial setup
│   ├── dev.sh                        # Start dev environment
│   └── build.sh                      # Build all packages
│
├── .gitignore
├── package.json                      # Root package.json (monorepo)
├── pnpm-workspace.yaml               # or npm/yarn workspaces
├── tsconfig.json                     # Root TypeScript config
└── README.md                         # Development README

```

## Key Design Decisions

### 1. Monorepo Structure
- **Packages**: Separate packages for web, backend, cursor extension, and shared code
- **Benefits**: Code sharing, unified versioning, easier refactoring
- **Tool**: pnpm workspaces (or npm/yarn workspaces)

### 2. Web Application (packages/web)
- **Framework**: Next.js 13+ with App Router
- **Structure**: App router with route groups for organization
- **Components**: Organized by feature (editor, ai, collaboration, etc.)
- **Platform-specific**: Browser APIs, Next.js routing, web UI components

### 3. Mobile Application (packages/mobile)
- **Framework**: React Native (Expo or bare workflow)
- **Structure**: React Navigation for routing
- **Components**: React Native components (View, Text, etc.)
- **Platform-specific**: Native modules, mobile file system, push notifications

### 4. Desktop Application (packages/desktop)
- **Framework**: Electron
- **Structure**: Main process (Node.js) + renderer process (React)
- **Components**: React components (similar to web)
- **Platform-specific**: Native file system access via Node.js, OS integrations, auto-updater

### 5. Backend Services (packages/backend)
- **Framework**: Express.js (or Fastify)
- **Structure**: 
  - `/api` - REST API routes
  - `/services` - Business logic layer
  - `/db` - Database access layer
  - `/websocket` - WebSocket server for real-time features
- **Services**: Each major feature has its own service class

### 6. Cursor Extension (packages/cursor-extension)
- **Framework**: VS Code Extension API
- **Structure**: Commands, services, and webview panels
- **Code Analysis**: Tree-sitter for AST parsing

### 7. Shared Package (packages/shared)
- **Types**: Shared TypeScript interfaces and types across all platforms
- **API Client**: Platform-agnostic API client with platform adapters
- **Editor Logic**: Core markdown/LaTeX processing (no UI dependencies)
- **State Logic**: Platform-agnostic state management logic
- **Services**: Client-side service logic (document, meta-content, export, sync)
- **Validation**: Validation utilities
- **Benefits**: 
  - Code reuse across web, mobile, and desktop
  - Type safety across all platforms
  - Single source of truth for business logic
  - Platform adapters allow platform-specific implementations (storage, file system, etc.)

## Technology Stack Recommendations

### Web
- **Framework**: Next.js 13+ (App Router)
- **UI**: React 18+
- **Styling**: Tailwind CSS
- **State**: Zustand or React Query (uses shared state logic)
- **Editor**: CodeMirror 6 or Monaco Editor (wraps shared editor logic)
- **Markdown**: Uses shared markdown utilities

### Mobile
- **Framework**: React Native (Expo or bare)
- **UI**: React Native components
- **Navigation**: React Navigation
- **State**: Zustand or Redux (uses shared state logic)
- **Editor**: Custom React Native editor (wraps shared editor logic)
- **Storage**: AsyncStorage or Realm (via shared platform adapter)

### Desktop
- **Framework**: Electron
- **UI**: React 18+ (renderer process)
- **Main Process**: Node.js
- **State**: Zustand or Redux (uses shared state logic)
- **Editor**: CodeMirror 6 or Monaco Editor (wraps shared editor logic)
- **File System**: Node.js fs module (via Electron, shared platform adapter)

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js or Fastify
- **WebSocket**: Socket.io or ws
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis
- **Storage**: AWS S3 / Supabase Storage
- **Vector DB**: Pinecone or Supabase Vector

### Extension
- **Framework**: VS Code Extension API
- **Parser**: Tree-sitter
- **Language**: TypeScript

### Shared
- **Type System**: TypeScript
- **Build**: tsc or esbuild
- **API Client**: Fetch-based with platform adapters
- **Editor Core**: Pure TypeScript (no React/UI dependencies)
- **State**: Platform-agnostic state logic (can be used with any state library)

## Development Workflow

1. **Setup**: Run `pnpm install` in root
2. **Dev**: `pnpm dev` (runs all packages in parallel)
3. **Build**: `pnpm build` (builds all packages)
4. **Test**: `pnpm test` (runs all tests)

## Shared Code Principles

### What Goes in Shared
1. **Business Logic**: Editor processing, markdown/LaTeX conversion, placeholder resolution
2. **API Client**: Core API communication with platform adapters
3. **State Logic**: Document state, project state (UI-agnostic)
4. **Types**: All TypeScript interfaces and types
5. **Validation**: Input validation, document validation
6. **Utilities**: String manipulation, date formatting, ID generation

### What Stays Platform-Specific
1. **UI Components**: React (web), React Native (mobile), React (desktop with platform-specific styling)
2. **Navigation/Routing**: Next.js App Router (web), React Navigation (mobile), custom router (desktop)
3. **Storage**: Browser localStorage (web), AsyncStorage (mobile), Electron Store (desktop)
4. **File System**: Browser File API (web), RN FileSystem (mobile), Node.js fs (desktop)
5. **Platform APIs**: Browser APIs, mobile native modules, desktop native APIs

### Platform Adapters Pattern

Shared code uses adapters for platform-specific functionality:

```typescript
// shared/api/adapters/base.ts
interface ApiAdapter {
  request(url: string, options: RequestOptions): Promise<Response>;
}

// shared/api/client.ts uses adapter
class ApiClient {
  constructor(private adapter: ApiAdapter) {}
  // ... implementation
}

// packages/web/lib/api/adapter.ts
export const webAdapter: ApiAdapter = {
  request: (url, options) => fetch(url, options)
}

// packages/mobile/lib/api/adapter.ts  
export const mobileAdapter: ApiAdapter = {
  request: (url, options) => /* React Native fetch */ 
}
```

## Next Steps

1. Initialize monorepo structure
2. Set up package.json workspaces
3. Create base packages (web, mobile, desktop, backend, shared, cursor-extension)
4. Set up TypeScript configs with proper path mappings
5. Configure build tools (Next.js, React Native, Electron)
6. Set up development environment
7. Implement shared package with platform adapters
8. Build MVP starting with web application

