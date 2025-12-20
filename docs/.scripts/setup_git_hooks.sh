#!/bin/bash
# Setup git hooks for automatic chapter number management

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
GIT_DIR="$DOCS_DIR/../.git"

if [ ! -d "$GIT_DIR" ]; then
    echo "Error: Not a git repository. Run 'git init' first."
    exit 1
fi

HOOKS_DIR="$GIT_DIR/hooks"
UPDATE_SCRIPT="$SCRIPT_DIR/update_chapter_numbers.sh"

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Pre-push hook: Replace {CH} with numbers before push
cat > "$HOOKS_DIR/pre-push" << 'HOOK_EOF'
#!/bin/bash
# Pre-push hook: Replace {CH} placeholders with actual numbers before push

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../docs/.scripts" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTENT_DIR="$DOCS_DIR/content"

# Check if any chapter files are being pushed
if git diff --cached --name-only | grep -q "^docs/content/chapter"; then
    echo "Updating chapter numbers before push..."
    "$SCRIPT_DIR/update_chapter_numbers.sh"
    
    # Stage the updated files
    git add "$CONTENT_DIR"/chapter*/*.md 2>/dev/null || true
    
    # Amend the commit if we're on the last commit
    if git diff --cached --quiet; then
        echo "No changes to stage"
    else
        echo "Staging updated chapter numbers..."
    fi
fi
HOOK_EOF

# Post-push hook: Restore {CH} placeholders after push
cat > "$HOOKS_DIR/post-push" << 'HOOK_EOF'
#!/bin/bash
# Post-push hook: Restore {CH} placeholders after push

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../docs/.scripts" && pwd)"

# Restore placeholders in local files
"$SCRIPT_DIR/update_chapter_numbers.sh" --restore
HOOK_EOF

# Post-merge hook: Restore {CH} placeholders after pull/merge
cat > "$HOOKS_DIR/post-merge" << 'HOOK_EOF'
#!/bin/bash
# Post-merge hook: Restore {CH} placeholders after pull/merge

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../docs/.scripts" && pwd)"

# Restore placeholders in local files
"$SCRIPT_DIR/update_chapter_numbers.sh" --restore
HOOK_EOF

# Make hooks executable
chmod +x "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/post-push"
chmod +x "$HOOKS_DIR/post-merge"

echo "✓ Git hooks installed:"
echo "  - pre-push: Replaces {CH} with numbers before push"
echo "  - post-push: Restores {CH} placeholders after push"
echo "  - post-merge: Restores {CH} placeholders after pull/merge"
