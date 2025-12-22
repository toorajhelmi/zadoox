# Zadoox Codebase

This is the main codebase for Zadoox - an AI-powered documentation platform.

## Structure

This is a monorepo using pnpm workspaces:

```
code/
├── packages/
│   ├── shared/     # Shared types, utilities, and logic
│   ├── backend/    # Backend API server
│   └── web/        # Next.js web application
├── package.json    # Root package.json
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
pnpm install
```

### Development

Run all packages in development mode:

```bash
pnpm dev
```

Run a specific package:

```bash
pnpm --filter web dev
pnpm --filter backend dev
```

### Build

Build all packages:

```bash
pnpm build
```

### Type Checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
```

## Packages

### `packages/shared`

Shared TypeScript types, utilities, and business logic used across all platforms.

### `packages/backend`

Backend API server (Node.js/Express) providing REST API endpoints.

### `packages/web`

Next.js web application (React) for the Zadoox platform.

## Development Workflow

See [MVP_PLAN.md](./MVP_PLAN.md) for the development plan and current progress.

## Documentation

- [Folder Structure](./FOLDER_STRUCTURE.md) - Detailed folder structure
- [Infrastructure](./INFRASTRUCTURE.md) - Infrastructure and deployment setup
- [MVP Plan](./MVP_PLAN.md) - MVP development plan and progress


