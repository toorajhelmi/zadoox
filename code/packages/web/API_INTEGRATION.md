# API Integration Guide

## Overview

The frontend is fully integrated with the backend API for project management. All API calls are handled through the type-safe API client.

## API Client

**Location**: `lib/api/client.ts`

**Features**:
- Automatic authentication (Supabase JWT token)
- Type-safe API calls using shared types
- Error handling with custom `ApiError` class
- All CRUD operations for projects

## Environment Variables

Set the following environment variable for the API URL:

```bash
# .env.local (for local development)
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Production (Vercel)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1
```

**Default**: If not set, defaults to `http://localhost:3001/api/v1`

## Available API Methods

### Projects

```typescript
import { api } from '@/lib/api/client';

// List all projects
const projects = await api.projects.list();

// Get a single project
const project = await api.projects.get(projectId);

// Create a project
const newProject = await api.projects.create({
  name: 'My Project',
  description: 'Description',
  type: 'academic',
});

// Update a project
const updated = await api.projects.update(projectId, {
  name: 'Updated Name',
});

// Delete a project
await api.projects.delete(projectId);
```

## Authentication

The API client automatically:
1. Gets the Supabase session token
2. Adds it to the `Authorization: Bearer <token>` header
3. Handles authentication errors

## Error Handling

```typescript
import { api, ApiError } from '@/lib/api/client';

try {
  const projects = await api.projects.list();
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message);
    console.error('Code:', error.code);
    console.error('Status:', error.status);
  }
}
```

## Backend API Endpoints

All endpoints are available at `/api/v1`:

- `GET /api/v1/projects` - List projects
- `GET /api/v1/projects/:id` - Get project
- `POST /api/v1/projects` - Create project
- `PUT /api/v1/projects/:id` - Update project
- `DELETE /api/v1/projects/:id` - Delete project

See backend documentation for full API details.

