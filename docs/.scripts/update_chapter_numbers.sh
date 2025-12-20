#!/bin/bash
# Update chapter numbers: replace {CH} with actual numbers or restore placeholders
# Usage:
#   ./update_chapter_numbers.sh          # Replace {CH} with numbers
#   ./update_chapter_numbers.sh --restore # Restore {CH} placeholders
#   ./update_chapter_numbers.sh --temp-dir DIR  # Work on temp directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Determine target directory
if [ "$1" = "--temp-dir" ] && [ -n "$2" ]; then
    TARGET_DIR="$2"
    RESTORE=false
elif [ "$1" = "--restore" ]; then
    TARGET_DIR="$DOCS_DIR/content"
    RESTORE=true
else
    TARGET_DIR="$DOCS_DIR/content"
    RESTORE=false
fi

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory not found: $TARGET_DIR"
    exit 1
fi

# Function to get chapter number from directory name
get_chapter_num() {
    local dir_name="$1"
    echo "$dir_name" | sed 's/chapter//' | sed 's/[^0-9]//g'
}

# Function to replace {CH} with number
replace_placeholders() {
    local file="$1"
    local chapter_num="$2"
    
    if [ -f "$file" ]; then
        # Use sed to replace {CH} with chapter number
        # Handle different patterns: {CH}, {CH}.1, etc.
        sed -i.bak \
            -e "s/{CH}\\./${chapter_num}./g" \
            -e "s/{CH}/${chapter_num}/g" \
            "$file"
        rm -f "$file.bak"
    fi
}

# Function to restore {CH} placeholders
restore_placeholders() {
    local file="$1"
    local chapter_num="$2"
    
    if [ -f "$file" ]; then
        # Replace chapter number patterns back to {CH}
        # More specific patterns first
        sed -i.bak \
            -e "s/${chapter_num}\\./{CH}./g" \
            -e "s/\b${chapter_num}\b/{CH}/g" \
            "$file"
        rm -f "$file.bak"
    fi
}

# Process all chapter directories
for chapter_dir in "$TARGET_DIR"/chapter*/; do
    if [ -d "$chapter_dir" ]; then
        chapter_name=$(basename "$chapter_dir")
        chapter_num=$(get_chapter_num "$chapter_name")
        
        if [ -n "$chapter_num" ]; then
            echo "Processing $chapter_name (number: $chapter_num)..."
            
            # Process README.md in chapter directory
            if [ -f "$chapter_dir/README.md" ]; then
                if [ "$RESTORE" = true ]; then
                    restore_placeholders "$chapter_dir/README.md" "$chapter_num"
                else
                    replace_placeholders "$chapter_dir/README.md" "$chapter_num"
                fi
            fi
            
            # Process any other .md files in chapter directory
            for md_file in "$chapter_dir"/*.md; do
                if [ -f "$md_file" ] && [ "$(basename "$md_file")" != "README.md" ]; then
                    if [ "$RESTORE" = true ]; then
                        restore_placeholders "$md_file" "$chapter_num"
                    else
                        replace_placeholders "$md_file" "$chapter_num"
                    fi
                fi
            done
        fi
    fi
done

if [ "$RESTORE" = true ]; then
    echo "✓ Restored {CH} placeholders"
else
    echo "✓ Replaced {CH} with chapter numbers"
fi
