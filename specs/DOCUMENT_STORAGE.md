# Zadoox Document Storage Format

## Overview

Zadoox stores documents in an extended Markdown format that supports all LaTeX features while remaining human-readable and AI-friendly.

---

## File Structure

### Document File Format
```
docs/
├── content/
│   ├── README.md              # Main document (abstract, etc.)
│   ├── chapter1/
│   │   └── README.md          # Chapter content
│   ├── chapter2/
│   │   └── README.md
│   ├── assets/                # Images, figures
│   │   ├── fig1.png
│   │   └── diagram.svg
│   └── SUMMARY.md             # Optional summary
└── metadata/
    ├── project.yaml           # Project metadata
    ├── chapters.yaml          # Chapter structure & numbering
    └── code-links.yaml        # Code-documentation links
```

---

## Document Format

### YAML Frontmatter
Every document starts with YAML frontmatter for metadata:

```yaml
---
title: "Chapter Title"
chapter: 1
section: null
type: chapter  # chapter | section | standalone
order: 1
labels:
  - sec:background
  - fig:diagram
codeLinks:
  - file: src/utils/helpers.py
    element: calculateTotal
    type: function
    lines: [45, 67]
    bidirectional: true
customCommands:
  - name: todo
    definition: \textcolor{red}{TODO: #1}
bibliography: references.bib
created: 2024-01-15T10:30:00Z
updated: 2024-01-20T14:22:00Z
author: user@example.com
version: 3
---
```

### Content Body
Markdown content with extended syntax:

```markdown
# Chapter {REF} — Introduction

## {REF}.1 Background {#sec:background}

This section discusses the background. As shown by Smith [@smith2024], 
the problem is complex.

### {REF}.1.1 Motivation

The motivation stems from several factors:

1. Factor one
2. Factor two
3. Factor three

## {REF}.2 Methodology

We use the following approach:

$$
E = mc^2
$$

See Figure @fig:diagram for a visual representation.

![System Diagram](assets/diagram.png){#fig:diagram label="Figure {REF}.1"}

### Code Reference

The `calculateTotal` function processes the data:

```python
def calculateTotal(items):
    return sum(item.price for item in items)
```
{#code:calculateTotal file="src/utils/helpers.py" lines="45-67"}

## {REF}.3 Results

Table @tbl:results shows our findings.

| Metric | Value | Unit |
|--------|-------|------|
| Accuracy | 95.2% | % |
| Speed | 120 | ms |
{#tbl:results label="Table {REF}.1"}

## {REF}.4 Conclusion

In conclusion, we have demonstrated...
```

---

## Extended Markdown Syntax

### 1. Placeholders

**Generic `{REF}` placeholder:**
- Context-aware replacement based on document structure
- `{REF}` in chapter title → Chapter number
- `{REF}` in section → Section number
- `{REF}` in figure/table label → Sequential number within chapter

**Examples:**
```markdown
# Chapter {REF} — Title          → # Chapter 1 — Title
## {REF}.1 Section               → ## 1.1 Section
### {REF}.1.1 Subsection         → ### 1.1.1 Subsection
Figure {REF}.1                   → Figure 2.1 (in chapter 2)
Table {REF}.2                    → Table 3.2 (in chapter 3)
```

### 2. Citations

```markdown
Single: [@smith2024]
Multiple: [@smith2024; @jones2023; @brown2022]
Page reference: [@smith2024, p. 42]
Author-year: [Smith 2024]
```

### 3. Cross-References

```markdown
Figure: See Figure @fig:diagram
Section: As discussed in Section @sec:background
Table: Table @tbl:results shows...
Equation: Equation @eq:einstein shows...
Code: The @code:calculateTotal function...
```

### 4. Figures

```markdown
Basic:
![Caption text](assets/image.png)

With label and numbering:
![Caption text](assets/image.png){#fig:diagram label="Figure {REF}.1"}

With placement:
![Caption](image.png){#fig:label float="h" placement="top"}

With width:
![Caption](image.png){#fig:label width="80%"}
```

### 5. Tables

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
{#tbl:results label="Table {REF}.1" caption="Results Summary"}
```

### 6. Math

```markdown
Inline: $E = mc^2$

Block:
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

Labeled equation:
$$
E = mc^2
$${#eq:einstein label="Equation {REF}.1"}
```

### 7. Code Blocks with Links

```markdown
```python
def calculateTotal(items):
    return sum(item.price for item in items)
```
{#code:calculateTotal file="src/utils/helpers.py" lines="45-67" link="true"}
```

### 8. Environments

```markdown
:::{.theorem}
This is a theorem statement.
:::

:::{.proof}
Proof goes here.
:::

:::{.algorithm}
Step 1: Initialize
Step 2: Process
Step 3: Output
:::

:::{.definition}
A definition of a term.
:::
```

### 9. Footnotes

```markdown
This is text[^1] with a footnote reference.

[^1]: Footnote content appears here.
```

### 10. Multi-column Layout

```markdown
:::{.columns}
::: {.column width="50%"}
Left column content here.
:::
::: {.column width="50%"}
Right column content here.
:::
:::
```

### 11. Page Breaks

```markdown
\newpage
```

### 12. Custom Commands

Defined in frontmatter or inline:
```markdown
\todo{This needs to be completed}
\highlight{Important text}
\code{functionName}
```

---

## Metadata Files

### project.yaml
```yaml
name: "My Research Project"
type: academic  # academic | industry | code-docs
author: "John Doe"
institution: "University Name"
settings:
  defaultFormat: latex
  chapterNumbering: true
  autoSync: true
  bibliographyStyle: apa
integrations:
  cursor: true
  git:
    enabled: true
    repo: "https://github.com/user/repo"
    branch: main
```

### chapters.yaml
```yaml
structure:
  - id: chapter1
    title: "Introduction"
    order: 1
    path: "content/chapter1/README.md"
    sections:
      - id: sec:background
        title: "Background"
        order: 1
  - id: chapter2
    title: "Methodology"
    order: 2
    path: "content/chapter2/README.md"
```

### code-links.yaml
```yaml
links:
  - id: link1
    documentId: chapter1
    documentPath: "content/chapter1/README.md"
    codeElement:
      file: "src/utils/helpers.py"
      type: function
      name: calculateTotal
      lines: [45, 67]
    bidirectional: true
    createdAt: 2024-01-15T10:30:00Z
```

---

## Storage Backend

### Database Schema (PostgreSQL)

**documents table:**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  title TEXT,
  content TEXT,  -- Markdown content
  frontmatter JSONB,  -- YAML frontmatter as JSON
  path TEXT,  -- File path
  type TEXT,  -- chapter | section | standalone
  order INTEGER,
  version INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  author_id UUID
);
```

**code_links table:**
```sql
CREATE TABLE code_links (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  code_element JSONB,  -- File, function, lines, etc.
  bidirectional BOOLEAN,
  created_at TIMESTAMP
);
```

### File System Storage

- **Primary**: Database (for versioning, search, collaboration)
- **Secondary**: File system (for Git integration, backup)
- **Sync**: Changes sync between DB and files

---

## Version Control

### Git Integration

1. **Local files** use `{REF}` placeholders
2. **Git repository** has actual numbers (for display)
3. **Pre-push hook** replaces `{REF}` → numbers
4. **Post-pull hook** restores `{REF}` placeholders

### Version History

Each document version stored with:
- Content snapshot
- Metadata snapshot
- Change diff
- Author
- Timestamp
- Commit hash (if synced to Git)

---

## Conversion Pipeline

### Markdown → LaTeX

1. Parse YAML frontmatter
2. Replace `{REF}` placeholders with actual numbers
3. Convert extended Markdown syntax to LaTeX
4. Process code links
5. Generate LaTeX document
6. Compile to PDF

### Markdown → HTML/Markdown (for GitBook, etc.)

1. Parse YAML frontmatter
2. Replace `{REF}` placeholders
3. Convert to standard Markdown/HTML
4. Process code links as HTML links
5. Generate output

---

## Benefits

✅ **Human-readable**: Easy to edit in any text editor  
✅ **AI-friendly**: LLMs understand Markdown well  
✅ **Version control**: Readable diffs  
✅ **Flexible**: Supports all LaTeX features  
✅ **Structured**: Metadata separate from content  
✅ **Linkable**: Code-doc links preserved  
✅ **Convertible**: Easy conversion to multiple formats

