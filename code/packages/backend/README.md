# Zadoox Backend API

Backend API service for Zadoox, built with Fastify and TypeScript.

## API Documentation

The API documentation is available in OpenAPI format:

- **Swagger UI**: http://localhost:3001/docs (interactive documentation)
- **OpenAPI JSON**: http://localhost:3001/openapi.json (machine-readable spec)

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables (see `code/implementation/BACKEND_SETUP.md`)
cp .env.example .env

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

The server will start on `http://localhost:3001`.

## Authentication

All API endpoints (except `/health` and `/docs`) require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Get a JWT token from Supabase Auth (see `code/implementation/API_TESTING.md` for details).

## Endpoints

### Projects
- `GET /api/v1/projects` - List all projects
- `GET /api/v1/projects/:id` - Get project by ID
- `POST /api/v1/projects` - Create project
- `PUT /api/v1/projects/:id` - Update project
- `DELETE /api/v1/projects/:id` - Delete project

### Documents
- `GET /api/v1/projects/:projectId/documents` - List documents in project
- `GET /api/v1/documents/:id` - Get document by ID
- `POST /api/v1/documents` - Create document
- `PUT /api/v1/documents/:id` - Update document
- `DELETE /api/v1/documents/:id` - Delete document

## Testing

See `code/implementation/API_TESTING.md` for detailed testing instructions and curl examples.

## Development

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Type check
pnpm type-check

# Lint
pnpm lint

# Build
pnpm build
```

## More Information

- Setup instructions: `code/implementation/BACKEND_SETUP.md`
- API testing guide: `code/implementation/API_TESTING.md`
- Database migrations: `code/supabase/README.md`

