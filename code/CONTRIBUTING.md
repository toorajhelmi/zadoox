# Contributing to Zadoox

## Branch Protection

The `main` branch is protected. All changes must be made through pull requests.

## Development Workflow

### 1. Create a Feature Branch

Always create a branch from `main` for your work:

```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Or for bug fixes:
git checkout -b fix/bug-description
```

**Branch naming convention:**
- `feature/` - New features (e.g., `feature/add-user-auth`)
- `fix/` - Bug fixes (e.g., `fix/export-error`)
- `refactor/` - Code refactoring (e.g., `refactor/api-structure`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)

### 2. Make Your Changes

Work on your branch, commit frequently:

```bash
git add .
git commit -m "Descriptive commit message"
```

### 3. Push Your Branch

Push your branch to GitHub:

```bash
git push origin feature/your-feature-name
```

### 4. Create a Pull Request

1. Go to https://github.com/toorajhelmi/zadoox
2. Click "Compare & pull request"
3. Fill in the PR description
4. Wait for CI checks to pass
5. Request review if needed
6. Merge when approved

### 5. CI Checks Must Pass

All CI checks must pass before merging:
- ✅ Type checking
- ✅ Linting
- ✅ Build
- ✅ Tests

### 6. Merge PR

Once approved and CI passes:
- Squash and merge (recommended) or
- Create a merge commit
- Delete the branch after merging

## Branch Protection Rules

The `main` branch has the following protection rules (configured in GitHub Settings → Branches):

- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
  - Build and test checks must pass
- ✅ Require branches to be up to date before merging
- ✅ Include administrators (optional)

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: Add user authentication
fix: Fix export PDF generation error
refactor: Simplify document service structure
docs: Update README with setup instructions
test: Add unit tests for validation utilities
```

## Questions?

If you have questions about the workflow, open an issue or contact the maintainers.

