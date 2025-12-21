# Testing Strategy for Zadoox MVP

## Overview

We'll use **Vitest** as our testing framework because:
- Fast (built on Vite)
- Great TypeScript support
- Compatible with Jest API (easy migration)
- Works well in monorepos
- Built-in coverage support

## Testing Approach

### 1. Unit Tests (Write as you build)

**When**: As you implement features in each phase

**What to test**:
- ✅ Utilities (ID generation, validation) - **Phase 1**
- ✅ Editor logic (markdown/LaTeX conversion, placeholders) - **Phase 6**
- ✅ Services (Document, Project, Export, AI services) - **Phase 3, 4, 5**
- ✅ Shared business logic

**Where**: 
- `packages/shared/src/utils/__tests__/`
- `packages/shared/src/editor/__tests__/`
- `packages/backend/src/services/__tests__/`

### 2. Integration Tests (Later phases)

**When**: Phase 14 (Integration & Testing)

**What to test**:
- API endpoints (end-to-end API tests)
- Database operations
- Service integrations

**Where**: 
- `packages/backend/tests/integration/`

### 3. End-to-End Tests (Optional for MVP)

**When**: Phase 14 (optional)

**What to test**:
- Critical user flows (if needed)
- Can use Playwright or Cypress

**Note**: For MVP, we'll focus on unit and integration tests. E2E can be added later.

## Test Structure

```
packages/
├── shared/
│   ├── src/
│   │   ├── utils/
│   │   │   ├── id.ts
│   │   │   └── __tests__/
│   │   │       └── id.test.ts
│   │   └── editor/
│   │       └── __tests__/
│   │
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   └── document/
│   │   │       ├── DocumentService.ts
│   │   │       └── __tests__/
│   │   │           └── DocumentService.test.ts
│   │   └── api/
│   │       └── documents/
│   │           └── __tests__/
│   └── tests/
│       └── integration/
│
└── web/
    └── (Component tests optional for MVP)
```

## Test Coverage Goals

**MVP Goals**:
- ✅ 80%+ coverage for utilities and shared logic
- ✅ 70%+ coverage for services
- ✅ Integration tests for critical API endpoints
- ⏳ Component tests (optional for MVP)

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in specific package
pnpm --filter shared test
pnpm --filter backend test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## When to Write Tests

**Best Practice**: Write tests as you build (TDD approach when possible)

1. **Phase 1.5**: Set up testing infrastructure
2. **Phase 1**: Add tests for utilities after implementing them
3. **Phase 3-6**: Add tests for services/logic as you build
4. **Phase 14**: Add integration tests for complete flows

## Example Test Structure

```typescript
// packages/shared/src/utils/__tests__/id.test.ts
import { describe, it, expect } from 'vitest';
import { generateId, isValidId } from '../id';

describe('ID generation', () => {
  it('should generate a valid UUID', () => {
    const id = generateId();
    expect(isValidId(id)).toBe(true);
  });
  
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});
```

