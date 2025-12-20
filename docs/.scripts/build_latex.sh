#!/bin/bash
# Build LaTeX PDF from Markdown sources
# Creates temporary copies, replaces {CH} placeholders, builds PDF

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTENT_DIR="$DOCS_DIR/content"
LATEX_DIR="$DOCS_DIR/latex"
BUILD_DIR="$DOCS_DIR/_build/latex"
TEMP_DIR=$(mktemp -d)

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "Building LaTeX PDF..."
echo "Content: $CONTENT_DIR"
echo "LaTeX: $LATEX_DIR"
echo "Build: $BUILD_DIR"
echo ""

# Create build directory
mkdir -p "$BUILD_DIR/chapters"

# Copy LaTeX template files
echo "Copying LaTeX template files..."
cp "$LATEX_DIR/main.tex" "$BUILD_DIR/"
cp "$LATEX_DIR/preamble.tex" "$BUILD_DIR/"
if [ -f "$LATEX_DIR/bibliography.bib" ]; then
    cp "$LATEX_DIR/bibliography.bib" "$BUILD_DIR/"
fi

# Copy content to temp directory
echo "Copying content files..."
cp -r "$CONTENT_DIR" "$TEMP_DIR/content"

# Replace {CH} placeholders in temp directory
echo "Replacing chapter number placeholders..."
"$SCRIPT_DIR/update_chapter_numbers.sh" --temp-dir "$TEMP_DIR/content"

# Convert Markdown to LaTeX
echo "Converting Markdown to LaTeX..."

# Convert abstract if exists
if [ -f "$TEMP_DIR/content/README.md" ]; then
    # Extract abstract section (everything before first ---)
    awk '/^---/{exit} {print}' "$TEMP_DIR/content/README.md" > "$TEMP_DIR/abstract.md" || true
    if [ -s "$TEMP_DIR/abstract.md" ]; then
        pandoc "$TEMP_DIR/abstract.md" -f markdown -t latex -o "$BUILD_DIR/chapters/abstract.tex" || true
    fi
fi

# Convert each chapter
for chapter_dir in "$TEMP_DIR/content"/chapter*/; do
    if [ -d "$chapter_dir" ]; then
        chapter_name=$(basename "$chapter_dir")
        chapter_num=$(echo "$chapter_name" | sed 's/chapter//')
        
        if [ -f "$chapter_dir/README.md" ]; then
            echo "  Converting $chapter_name..."
            mkdir -p "$BUILD_DIR/chapters/$chapter_name"
            pandoc "$chapter_dir/README.md" -f markdown -t latex \
                --wrap=none \
                -o "$BUILD_DIR/chapters/$chapter_name/README.tex" || {
                echo "Warning: Failed to convert $chapter_name, creating empty file"
                echo "% Chapter $chapter_num" > "$BUILD_DIR/chapters/$chapter_name/README.tex"
            }
        fi
    fi
done

# Convert other markdown files (introduction, methodology, etc.)
for md_file in "$TEMP_DIR/content"/*.md; do
    if [ -f "$md_file" ]; then
        base_name=$(basename "$md_file" .md)
        if [ "$base_name" != "README" ] && [ "$base_name" != "SUMMARY" ]; then
            echo "  Converting $base_name.md..."
            pandoc "$md_file" -f markdown -t latex --wrap=none \
                -o "$BUILD_DIR/chapters/$base_name.tex" || true
        fi
    fi
done

# Build LaTeX document
echo ""
echo "Building LaTeX document..."
cd "$BUILD_DIR"

# Run pdflatex multiple times for references
pdflatex -interaction=nonstopmode main.tex > /dev/null || true
pdflatex -interaction=nonstopmode main.tex > /dev/null || true

# Build bibliography if it exists
if [ -f "bibliography.bib" ]; then
    bibtex main > /dev/null || true
    pdflatex -interaction=nonstopmode main.tex > /dev/null || true
    pdflatex -interaction=nonstopmode main.tex > /dev/null || true
fi

echo ""
if [ -f "main.pdf" ]; then
    echo "✓ PDF built successfully: $BUILD_DIR/main.pdf"
else
    echo "✗ PDF build failed. Check $BUILD_DIR/main.log for errors."
    exit 1
fi
