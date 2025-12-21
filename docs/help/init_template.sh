#!/bin/bash
# Initialize Zadoox with project name and author

set -e

PROJECT_NAME="${1:-My Project}"
AUTHOR_NAME="${2:-Your Name}"

echo "Initializing Zadoox..."
echo "Project: $PROJECT_NAME"
echo "Author: $AUTHOR_NAME"
echo ""

# Update main.tex
if [ -f "docs/latex/main.tex" ]; then
    sed -i.bak "s/\\title{.*}/\\title{$PROJECT_NAME}/" docs/latex/main.tex
    sed -i.bak "s/\\author{.*}/\\author{$AUTHOR_NAME}/" docs/latex/main.tex
    rm -f docs/latex/main.tex.bak
    echo "✓ Updated docs/latex/main.tex"
fi

# Update content/README.md
if [ -f "docs/content/README.md" ]; then
    # Create a backup and update title
    sed -i.bak "1s/.*/# $PROJECT_NAME/" docs/content/README.md
    sed -i.bak "s/\*\*Author:\*\*.*/\*\*Author:\*\* $AUTHOR_NAME/" docs/content/README.md
    rm -f docs/content/README.md.bak
    echo "✓ Updated docs/content/README.md"
fi

# Make scripts executable
chmod +x docs/.scripts/*.sh 2>/dev/null || true
echo "✓ Made scripts executable"

# Setup git hooks
if [ -d ".git" ]; then
    ./docs/.scripts/setup_git_hooks.sh
    echo "✓ Installed git hooks"
else
    echo "⚠ No .git directory found. Run 'git init' first, then:"
    echo "  ./docs/.scripts/setup_git_hooks.sh"
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    cat > .gitignore << 'EOF'
# Documentation build outputs
docs/_build/
docs/texput.log

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
EOF
    echo "✓ Created .gitignore"
fi

echo ""
echo "✓ Zadoox initialized!"
echo ""
echo "Next steps:"
echo "1. Edit docs/content/README.md for your abstract"
echo "2. Edit docs/content/chapter1/README.md to start writing"
echo "3. Run './docs/.scripts/build_latex.sh' to build PDF"
echo "4. Use {CH} placeholders for chapter numbers"

