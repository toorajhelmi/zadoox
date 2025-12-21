# Git Hooks

This repository includes git hooks to ensure code quality before pushing.

## Pre-push Hook

**Location**: `.git/hooks/pre-push`

**Purpose**: Runs TypeScript type-checking before allowing a push to proceed.

**What it does**:
1. Builds the shared package (required for type resolution)
2. Runs `pnpm type-check` on all packages
3. Blocks the push if type-check fails
4. Allows the push if type-check passes

**To disable temporarily** (not recommended):
```bash
git push --no-verify
```

**To reinstall** (if the hook is lost):
```bash
# The hook is committed to .git/hooks/pre-push
# Just ensure it's executable:
chmod +x .git/hooks/pre-push
```

**Note**: This hook requires `pnpm` to be installed and available in your PATH.

