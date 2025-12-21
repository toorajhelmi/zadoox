# API Testing Guide

This guide explains how to test the Zadoox backend API endpoints.

## Prerequisites

1. Backend server running: `pnpm --filter backend dev`
2. Supabase project set up with database migrations applied
3. A valid JWT token from Supabase Auth

## Getting an Authentication Token

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to Authentication → Users
3. Create a test user or use an existing one
4. Copy the user's JWT token (or use the Auth API to get a fresh token)

### Option 2: Using Supabase Auth API

```bash
# Sign up a new user
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Sign in to get access token
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Copy the `access_token` from the response.

## Testing Endpoints

Set the token as an environment variable:

```bash
export TOKEN="your-jwt-token-here"
export API_URL="http://localhost:3001"
```

### Health Check

```bash
curl $API_URL/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "zadoox-backend"
}
```

### Projects API

#### List Projects

```bash
curl -X GET "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN"
```

#### Create Project

```bash
curl -X POST "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Project",
    "description": "A test project",
    "type": "academic",
    "settings": {
      "defaultFormat": "latex",
      "chapterNumbering": true,
      "autoSync": true
    }
  }'
```

#### Get Project

```bash
export PROJECT_ID="project-uuid-here"
curl -X GET "$API_URL/api/v1/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

#### Update Project

```bash
curl -X PUT "$API_URL/api/v1/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Project Name",
    "description": "Updated description"
  }'
```

#### Delete Project

```bash
curl -X DELETE "$API_URL/api/v1/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Documents API

#### List Documents in Project

```bash
curl -X GET "$API_URL/api/v1/projects/$PROJECT_ID/documents" \
  -H "Authorization: Bearer $TOKEN"
```

#### Create Document

```bash
curl -X POST "$API_URL/api/v1/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "title": "My First Document",
    "content": "# Introduction\n\nThis is my document content.",
    "metadata": {
      "type": "chapter",
      "chapterNumber": 1,
      "order": 0
    }
  }'
```

#### Get Document

```bash
export DOCUMENT_ID="document-uuid-here"
curl -X GET "$API_URL/api/v1/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

#### Update Document

```bash
curl -X PUT "$API_URL/api/v1/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Document Title",
    "content": "# Updated Content\n\nNew content here."
  }'
```

#### Delete Document

```bash
curl -X DELETE "$API_URL/api/v1/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Missing or invalid authentication token
- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Server error

## Example Test Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

API_URL="${API_URL:-http://localhost:3001}"
TOKEN="${TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "Error: TOKEN environment variable not set"
  echo "Get a token from Supabase Auth and set: export TOKEN=your-token"
  exit 1
fi

echo "Testing Zadoox API at $API_URL"
echo ""

# Health check
echo "1. Health check:"
curl -s "$API_URL/health" | jq
echo ""

# Create project
echo "2. Creating project:"
PROJECT=$(curl -s -X POST "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "type": "academic"
  }' | jq)

echo "$PROJECT" | jq
PROJECT_ID=$(echo "$PROJECT" | jq -r '.data.id')
echo ""

# List projects
echo "3. Listing projects:"
curl -s -X GET "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

# Create document
echo "4. Creating document:"
DOCUMENT=$(curl -s -X POST "$API_URL/api/v1/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"title\": \"Test Document\",
    \"content\": \"# Test\n\nContent here.\"
  }" | jq)

echo "$DOCUMENT" | jq
DOCUMENT_ID=$(echo "$DOCUMENT" | jq -r '.data.id')
echo ""

# List documents
echo "5. Listing documents:"
curl -s -X GET "$API_URL/api/v1/projects/$PROJECT_ID/documents" \
  -H "Authorization: Bearer $TOKEN" | jq
echo ""

echo "Test completed!"
echo "Project ID: $PROJECT_ID"
echo "Document ID: $DOCUMENT_ID"
```

Make it executable and run:
```bash
chmod +x test-api.sh
export TOKEN="your-token"
./test-api.sh
```

