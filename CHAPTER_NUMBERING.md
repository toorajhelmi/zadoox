# Chapter Numbering System

This documentation uses a placeholder-based system for chapter numbers to make renumbering chapters easier.

## How It Works

**Your local source files always use `{CH}` placeholders** - this makes it easy to move/renumber chapters. The placeholders are automatically replaced with actual numbers only when:
- Generating LaTeX PDF (uses temporary copies)
- Pushing to git (replaces in place, commits, then restores placeholders locally)

Instead of hardcoding chapter numbers like `# Chapter 4 — Title` or `## 4.1 Section`, we use placeholders:

- `# Chapter {CH} — Title`
- `## {CH}.1 Section`
- `### {CH}.2.1 Subsection`
- `Figure {CH}.1 — Title`
- `Table {CH}.1 — Title`
- etc.

The `{CH}` placeholder is automatically replaced with the actual chapter number based on the directory name (e.g., `chapter4/` → `4`).

## Examples

### Chapter Title
```markdown
# Chapter {CH} — Introduction
```
In git/LaTeX: `# Chapter 1 — Introduction`  
In your local file: Always `# Chapter {CH} — Introduction`

### Section Header
```markdown
## {CH}.1 Main Section
```
In git/LaTeX: `## 1.1 Main Section`  
In your local file: Always `## {CH}.1 Main Section`

### Figure/Table References
```markdown
**Figure {CH}.1 — Conceptual Diagram**
## Table {CH}.1 — Data Summary
```
In git/LaTeX: `**Figure 2.1 — Conceptual Diagram**`  
In your local file: Always `**Figure {CH}.1 — Conceptual Diagram**`

## Important Notes

- **Your local files always use `{CH}` placeholders** - this makes renumbering easy
- **Git repository has actual numbers** - so GitBook and other tools display correctly
- **LaTeX builds use temporary copies** - your source files are never modified
- **Git hooks handle everything automatically** - you just edit with placeholders and push/build normally
- References to other chapters in text should still use actual numbers (e.g., "as discussed in Chapter 2")

## Troubleshooting

If placeholders aren't being restored after push:
```bash
./docs/.scripts/update_chapter_numbers.sh --restore
```
