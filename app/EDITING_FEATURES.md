# Zadoox Editing Features
## Extended Markdown Editor with LaTeX Input Support

## Overview

Zadoox provides an intelligent editor that supports **dual input modes**:
- **Extended Markdown** - Type in extended Markdown syntax
- **LaTeX** - Type in LaTeX syntax directly

**Important**: Regardless of input format, all content is **stored in Extended Markdown format**. The editor automatically converts LaTeX syntax to Extended Markdown for storage, while preserving LaTeX commands within the Extended Markdown structure.

The editor makes it easy to insert elements through:
1. **Backslash commands** - Type `\` to trigger command palette
2. **Bottom panel** - Visual toolbar (can be hidden/shown)
3. **AI assistance** - Context-aware suggestions

---

## Editor Interface

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  [AI Assistant] [Style: Academic ▼] [Template ▼] [Settings]│
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────────────────┐  ┌───────────┐  │
│  │ Outline  │  │   Editor (MD)       │  │   Preview │  │
│  │          │  │                     │  │  (LaTeX)  │  │
│  │ Chapter 1│  │ # Chapter {REF} ... │  │           │  │
│  │  Section │  │                     │  │  Rendered │  │
│  │          │  │ [Cursor here]       │  │  preview  │  │
│  └──────────┘  └──────────────────────┘  └───────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  [Bottom Panel - Hide/Show]                        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Input Format Support

### Dual Input Modes

Users can type in either format:

**Extended Markdown Input**
```markdown
# Chapter {REF} — Title
## {REF}.1 Section
![Figure](image.png){#fig:label}
```

**LaTeX Input**
```latex
\chapter{Title}
\section{Section}
\begin{figure}
  \includegraphics{image.png}
  \caption{Figure}
  \label{fig:label}
\end{figure}
```

### Storage Format

**All content is stored in Extended Markdown format**, regardless of input:

- LaTeX input is automatically converted to Extended Markdown
- LaTeX commands are preserved within Extended Markdown syntax
- Mixed LaTeX/Markdown input is normalized to Extended Markdown
- Conversion happens transparently during editing

### Conversion Examples

**LaTeX Input → Extended Markdown Storage**

Input (LaTeX):
```latex
\section{Background}
This is text with \textbf{bold} and $E = mc^2$.
```

Stored (Extended Markdown):
```markdown
## Background {#sec:background}
This is text with **bold** and $E = mc^2$.
```

**Mixed Input → Extended Markdown Storage**

Input (Mixed):
```markdown
# Chapter Title
\section{Introduction}
Some text with \emph{emphasis}.
```

Stored (Extended Markdown):
```markdown
# Chapter {REF} — Title
## Introduction {#sec:introduction}
Some text with *emphasis*.
```

### Editor Behavior

- **Syntax highlighting** - Supports both LaTeX and Markdown syntax
- **Auto-conversion** - LaTeX syntax converted on-the-fly
- **Preview** - Shows rendered output regardless of input format
- **Export** - Extended Markdown converted to target format (LaTeX, PDF, etc.)

---

## 2. Backslash Commands

### How It Works

User types `\` → Command palette appears with autocomplete

### Available Commands

#### Citations
```
\cite → [@]
\cite[smith2024] → [@smith2024]
\cite[smith2024; jones2023] → [@smith2024; @jones2023]
```

#### Cross-References
```
\ref → @
\ref[fig:diagram] → @fig:diagram
\ref[sec:background] → @sec:background
\ref[tbl:results] → @tbl:results
\ref[eq:einstein] → @eq:einstein
```

#### Figures
```
\fig → ![Caption](path/to/image.png){#fig:label label="Figure {REF}.1"}
\fig[diagram] → ![Diagram](assets/diagram.png){#fig:diagram label="Figure {REF}.1"}
\fig[diagram, caption="My Diagram"] → ![My Diagram](assets/diagram.png){#fig:diagram label="Figure {REF}.1"}
```

#### Tables
```
\table → Inserts table template
\table[3x4] → 3 columns, 4 rows template
\table[results] → Table with label {#tbl:results label="Table {REF}.1"}
```

#### Math
```
\math → $inline math$
\math[block] → $$block math$$
\math[eq:einstein] → $$E = mc^2$${#eq:einstein label="Equation {REF}.1"}
```

#### Code Blocks
```
\code → ```language\ncode\n```
\code[python] → ```python\n\n```
\code[calculateTotal] → Code block with link to function
```

#### Environments
```
\env → :::\n{.environment}\n\n:::
\env[theorem] → :::\n{.theorem}\n\n:::
\env[proof] → :::\n{.proof}\n\n:::
\env[algorithm] → :::\n{.algorithm}\n\n:::
```

#### Sections
```
\sec → ## Section {REF}.1
\sec[background] → ## Background {#sec:background}
\subsec → ### Subsection {REF}.1.1
```

#### Placeholders
```
\ref → {REF}
\ch → Chapter {REF}
\fignum → Figure {REF}.1
\tabnum → Table {REF}.1
```

#### Special Elements
```
\newpage → \newpage
\footnote → [^1] (with footnote definition)
\columns → Multi-column layout
\todo → \todo{text}
\highlight → \highlight{text}
```

### Command Palette Behavior

1. **Type `\`** → Palette opens
2. **Start typing** → Filtered suggestions appear
3. **Arrow keys** → Navigate suggestions
4. **Tab/Enter** → Insert selected command
5. **Esc** → Close palette

**Example:**
```
User types: \fig[d
↓
Suggestions:
  - \fig[diagram]
  - \fig[data-flow]
  - \fig[architecture]
↓
User selects: \fig[diagram]
↓
Inserts: ![Diagram](assets/diagram.png){#fig:diagram label="Figure {REF}.1"}
```

---

## 3. Bottom Panel

### Panel Layout

```
┌─────────────────────────────────────────┐
│  [Hide/Show Panel]                     │
├─────────────────────────────────────────┤
│  📝 Text          🔢 Math               │
│  ┌─────────┐     ┌─────────┐            │
│  │ Heading │     │ Inline  │            │
│  │ Section │     │ Block   │            │
│  │ Bold    │     │ Labeled │            │
│  │ Italic  │     └─────────┘            │
│  └─────────┘                             │
│                                         │
│  📊 Structure      🖼️ Media             │
│  ┌─────────┐     ┌─────────┐            │
│  │ Chapter │     │ Figure  │            │
│  │ Section │     │ Table   │            │
│  │ List    │     │ Image   │            │
│  └─────────┘     └─────────┘            │
│                                         │
│  🔗 References    💻 Code               │
│  ┌─────────┐     ┌─────────┐            │
│  │ Cite    │     │ Block   │            │
│  │ Ref     │     │ Inline  │            │
│  │ Link    │     │ Link    │            │
│  └─────────┘     └─────────┘            │
│                                         │
│  📐 LaTeX         🎨 Format             │
│  ┌─────────┐     ┌─────────┐            │
│  │ Env     │     │ Columns │            │
│  │ Command │     │ Page Br │            │
│  │ Custom  │     │ Footnote│            │
│  └─────────┘     └─────────┘            │
└─────────────────────────────────────────┘
```

### Element Categories

#### Style & Template
- **Style** - Apply document style (academic, whitepaper, etc.)
- **Template** - Apply document template
- **Style Settings** - Configure style options
- **Template Variables** - Fill template variables

#### Text Formatting
- **Heading** (H1, H2, H3) - Inserts heading with {REF} if in chapter
- **Bold** - `**text**`
- **Italic** - `*text*`
- **Strikethrough** - `~~text~~`
- **Code inline** - `` `code` ``

#### Math
- **Inline Math** - `$math$`
- **Block Math** - `$$math$$`
- **Labeled Equation** - Block with label

#### Structure
- **Chapter** - `# Chapter {REF} — Title`
- **Section** - `## {REF}.1 Section`
- **Subsection** - `### {REF}.1.1 Subsection`
- **List** (Bullet, Numbered)
- **Quote** - `> quote`

#### Media
- **Figure** - Opens image picker, inserts figure syntax
- **Table** - Inserts table template
- **Image** - Simple image (no label)

#### References
- **Citation** - Opens citation picker
- **Cross-Reference** - Opens ref picker (figures, sections, etc.)
- **Link** - `[text](url)`
- **Code Link** - Link to code element

#### Code
- **Code Block** - ```language block```
- **Code with Link** - Code block linked to function/class
- **Inline Code** - `` `code` ``

#### LaTeX
- **Environment** - Opens environment picker (theorem, proof, etc.)
- **Custom Command** - Insert custom LaTeX command
- **Page Break** - `\newpage`

#### Format
- **Multi-column** - Column layout
- **Footnote** - `[^1]` with definition
- **Horizontal Rule** - `---`

### Button Behavior

1. **Click button** → Opens relevant dialog/picker
2. **Fill in details** → Inserts formatted syntax
3. **Smart defaults** → Auto-fills {REF}, labels, etc.

**Example: Figure Button**
```
User clicks "Figure" button
↓
Dialog opens:
  - Image picker
  - Caption input
  - Label input (auto-suggests: fig:diagram)
  - Placement options
↓
User fills in:
  - Image: assets/diagram.png
  - Caption: System Architecture
  - Label: fig:architecture
↓
Inserts: ![System Architecture](assets/diagram.png){#fig:architecture label="Figure {REF}.1"}
```

---

## 2.5 Styles and Templates

### Styles

Styles define the overall formatting and presentation of documents (academic, whitepaper, technical documentation, etc.). They control citation formats, heading styles, figure placement, and other document-level formatting.

#### Available Styles

**Academic**
- APA/MLA/Chicago citation styles
- Numbered headings
- Formal formatting
- Standard academic margins and spacing

**Whitepaper**
- Professional formatting
- Executive summary structure
- Business-focused styling
- Clean, modern layout

**Technical Documentation**
- Code-friendly formatting
- API documentation structure
- Technical terminology support
- Developer-focused styling

**Blog/Article**
- Casual formatting
- Readable typography
- Social media friendly
- Engaging layout

**Custom Styles**
- Users can create custom styles
- Save and reuse across projects
- Share with team members

#### Applying Styles

**From Document Settings**
```
Document Settings → Style → Select Style
```

**From Editor**
```
Click "Style" dropdown in toolbar
→ Select style
→ Style applied immediately
→ Preview updates
```

**Style Settings**
- Citation format (APA, MLA, Chicago, IEEE, etc.)
- Heading style (numbered, unnumbered, mixed)
- Figure placement (inline, floating, end)
- Table style (simple, grid, booktabs)
- Font family and size
- Line spacing and margins
- Page size (A4, Letter, custom)

#### Style Format Support

Styles can support multiple output formats:
- **LaTeX** - Full style support
- **Markdown** - Basic style support
- **HTML** - Web-optimized styling
- **PDF** - Print-ready formatting

Some styles are format-specific (e.g., LaTeX-only academic styles).

### Templates

Templates are format-specific template files that define the structure and formatting for exports. Each format has its own template system:
- **LaTeX templates** - `.tex` template files (e.g., article, report, book classes)
- **Markdown templates** - `.md` template files (e.g., GitBook, GitHub)
- **HTML templates** - `.html` template files (e.g., web publishing)

Templates are linked to documents, and the export service uses them when generating output in that format.

#### Template Types

**LaTeX Templates**
- LaTeX document classes and templates
- `.tex` template files
- Examples: `article.tex`, `report.tex`, `book.tex`, custom academic templates
- Applied during LaTeX/PDF export

**Markdown Templates**
- Markdown template files
- `.md` template files
- Examples: GitBook templates, GitHub README templates
- Applied during Markdown export

**HTML Templates**
- HTML template files
- `.html` template files
- Examples: Web publishing templates, documentation site templates
- Applied during HTML export

#### Available Templates

**Academic Templates**
- Research Paper
- Thesis/Dissertation
- Conference Paper
- Literature Review

**Industry Templates**
- Whitepaper
- Technical Report
- Product Documentation
- Case Study

**Technical Templates**
- API Documentation
- Code Documentation
- Architecture Document
- User Guide

#### Linking Templates

**To Existing Document**
```
Document Settings → Template → Select Template → Link
```

**Template Selection**
- Select format (LaTeX, Markdown, HTML)
- Browse available templates for that format
- Link template to document
- Template is used during export in that format

**Template Variables**
Some templates may support variables for substitution:
- `{title}` - Document title
- `{author}` - Author name
- `{date}` - Date
- Custom variables defined in template
- Variables are substituted during export

#### How Templates Work

1. **Template Linking** - Link a format-specific template to your document
2. **Export Time** - When exporting to that format, the export service:
   - Uses the linked template file
   - Applies document content to template
   - Substitutes variables
   - Generates output in that format

**Example: LaTeX Export**
- Document has LaTeX template linked (e.g., `academic-paper.tex`)
- Export to LaTeX/PDF
- Export service uses `academic-paper.tex` template
- Document content is inserted into template structure
- LaTeX compilation uses template formatting

#### Custom Templates

Users can:
- Upload custom template files (`.tex`, `.md`, `.html`)
- Create template entries that reference template files
- Share templates with team
- Use system-provided templates (LaTeX classes, etc.)

---

## 4. AI Assistance

### Overview

Zadoox provides multiple AI assistance modes that help users write, refine, and enhance their documents. AI actions can be applied to specific portions of documents, and special writing modes allow users to work in different styles (ideation, fragments, drafts) that are preserved and linked to the main document.

---

### 3.1 AI Actions (Portion-Specific)

These actions can be applied to selected text or specific document portions:

#### Refinement Actions

**Refine**
- Improves clarity, grammar, and flow
- Maintains original meaning
- Suggests word choice improvements
- Example: "The results show that..." → "The results demonstrate that..."

**Clarify**
- Simplifies complex sentences
- Removes ambiguity
- Improves readability
- Example: Technical jargon → Clearer explanation

**Expand**
- Adds more detail and depth
- Provides additional context
- Elaborates on key points
- Example: Brief statement → Detailed explanation

**Condense**
- Summarizes lengthy text
- Removes redundancy
- Keeps essential information
- Example: Long paragraph → Concise summary

#### Style Actions

**Change Tone**
- Formal → Informal (or vice versa)
- Academic → Industry
- Technical → Accessible
- Preserves content while adjusting tone

**Improve Flow**
- Better transitions between sentences
- Improved paragraph structure
- Enhanced coherence

**Enhance Vocabulary**
- Suggests more precise terms
- Academic terminology
- Technical accuracy

#### Content Actions

**Find References**
- Searches academic databases
- Finds relevant citations
- Suggests papers/articles
- Auto-formats citations

**Add Examples**
- Generates relevant examples
- Code examples for technical docs
- Case studies for academic papers

**Add Counterarguments**
- Suggests opposing viewpoints
- Strengthens argumentation
- Academic rigor

**Translate**
- Translates to different languages
- Preserves technical terms
- Maintains formatting

#### Structure Actions

**Restructure**
- Reorganizes paragraphs
- Improves logical flow
- Better section organization

**Add Missing Elements**
- Suggests figures, tables
- Identifies gaps in content
- Proposes structure improvements

---

### 3.2 Writing Modes

The **Main Document** is the primary content that gets exported and published. Writing modes are special areas that allow users to work in different styles (ideation, fragments, drafts) that are preserved and linked to the main document.

#### Main Document

**Main Document**
- The primary document content
- No specific tone requirement (can be formal, informal, technical, etc.)
- This is the main content that gets exported/published
- Can be refined and styled as needed

#### Writing Modes (Meta Content)

**1. Ideation Mode**
- Brainstorming and free-form thinking
- No strict formatting
- Allows incomplete thoughts
- Encourages creativity
- Linked to sections of the main document
- Use case: Initial ideas, brainstorming sessions

**2. Fragment Mode**
- Quick notes and fragments
- Bullet points, snippets
- Unstructured content
- Later refinement into main document content
- Linked to sections of the main document
- Use case: Quick notes, research snippets

**3. Draft Mode**
- Rough draft writing
- Allows informal language
- Can be messy
- Focus on content over form
- Can be refined into main document content
- Linked to sections or entire main document
- Use case: First drafts, quick writing

#### Mode Interface

```
┌─────────────────────────────────────────────────────────┐
│  Editor                                                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ [Main]  [Ideation] [Fragment] [Draft]              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  [Main Document Content Area]                           │
│  # Section Title                                         │
│  Main document content here...                          │
│                                                          │
│  [📝 Show Ideation] [📋 Show Fragments] [📄 Show Draft]│
│  └─ Linked meta content (ideation/fragments/draft)     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Mode Switching

- **Main document** - The primary content (no specific tone/style requirement)
- **Switch to modes** - Create ideation/fragments/draft linked to sections
- **Mode indicators** - Visual indicators show linked meta content
- **Mode-specific AI** - AI adapts suggestions based on mode context

---

### 3.3 Mode Storage & Linking

#### How Modes Are Stored

The main document is stored as the primary content. Writing modes create **linked meta content**:

```yaml
---
# Main Document
content: |
  # Main document content (refined, publishable)
  This is the primary document content...
  
# Meta Content (linked to main document)
metaContent:
  ideation:
    content: |
      # Raw ideation notes
      - Idea 1: ...
      - Idea 2: ...
    linkedTo: ["section:1", "section:2"]
    createdAt: 2024-01-15T10:30:00Z
  
  fragments:
    content: |
      - Quick note about X
      - Reference to Y
    linkedTo: ["section:1"]
    createdAt: 2024-01-15T11:00:00Z
  
  draft:
    content: |
      # Rough draft version
      Informal writing here...
    linkedTo: ["section:1"]
    createdAt: 2024-01-15T12:00:00Z
---
```

#### Visual Linking

In the editor, the main document content is primary, with linked meta content accessible:

```
┌─────────────────────────────────────────┐
│  # Section Title                        │
│  Main document content here...          │
│  (Main document - always visible)       │
│                                         │
│  [📝 Show Ideation] [📋 Show Fragments] │
│  [📄 Show Draft]                        │
│  └─ Linked meta content (toggleable)   │
└─────────────────────────────────────────┘
```

#### Accessing Mode Content

**Show/Hide Toggle**
- Click button to show/hide mode content
- Expandable sections
- Side-by-side view option

**Mode History**
- View evolution from ideation → draft → main document
- Compare versions
- Restore previous mode content
- See how meta content influenced final main document content

**Export Options**
- Include/exclude mode content in exports
- Show ideation notes in appendix
- Export mode content separately

---

### 3.4 AI Action Workflow

#### Applying Actions

**Step 1: Select Text**
```
User selects portion of document
```

**Step 2: Choose Action**
```
AI menu appears with available actions:
- Refine
- Clarify
- Expand
- Find References
- Change Tone
- etc.
```

**Step 3: AI Processing**
```
AI analyzes:
- Selected text
- Document context
- Writing mode
- User preferences
```

**Step 4: Show Results**
```
AI shows:
- Original text
- Suggested changes
- Side-by-side comparison
- Option to accept/reject/modify
```

**Step 5: Apply Changes**
```
User can:
- Accept all changes
- Accept selective changes
- Modify and accept
- Reject and try different action
```

#### Action History

All AI actions are tracked:
- What action was applied
- When it was applied
- Original vs. modified content
- Can revert actions

---

### 3.5 Mode-Specific Features

#### Main Document Features

- **Citation checking** - Ensures proper citations (if needed)
- **Style flexibility** - No enforced style/tone
- **Structure validation** - Checks document structure
- **Export ready** - This is the content that gets exported/published
- **AI assistance** - Can apply any tone/style as needed

#### Ideation Mode Features

- **Free-form writing** - No formatting constraints
- **Idea capture** - Quick capture of thoughts
- **Mind mapping** - Visual idea organization
- **Later refinement** - Convert to main document content later

#### Fragment Mode Features

- **Quick notes** - Fast note-taking
- **Bullet points** - Unstructured lists
- **Snippets** - Code snippets, quotes
- **Tagging** - Tag fragments for organization

#### Draft Mode Features

- **Rough writing** - Focus on content
- **Informal language** - Allowed
- **Quick editing** - Fast iteration
- **Auto-refinement** - AI suggests improvements

---

### 3.6 AI Command Integration

#### Backslash Commands

```
\ai[refine] → Apply refine action to selection
\ai[clarify] → Apply clarify action
\ai[expand] → Expand selected text
\ai[ideate] → Create ideation mode content
\ai[fragment] → Create fragment mode content
\ai[draft] → Create draft mode content
\ai[references] → Find references for selection
\ai[tone:formal] → Change tone to formal
\ai[tone:casual] → Change tone to casual

#### Style & Template Commands
\style → Open style selector
\style[academic] → Apply academic style
\template → Open template selector
\template[research-paper] → Apply research paper template
```

#### Bottom Panel Actions

- **Quick Actions** - One-click AI actions
- **Mode Switcher** - Switch writing modes
- **Action History** - View recent actions
- **Mode Content** - Show/hide mode content

---

### 3.7 AI Suggestions Panel

#### Panel Layout

```
┌─────────────────────────────────────────┐
│  AI Suggestions                         │
├─────────────────────────────────────────┤
│  [Refine] [Clarify] [Expand] [Tone]   │
│                                         │
│  Suggestions:                           │
│  ┌───────────────────────────────────┐ │
│  │ Original: "The results show..."    │ │
│  │ Suggested: "The results demonstrate│ │
│  │            that..."                │ │
│  │ [Accept] [Modify] [Reject]        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Mode Content:                         │
│  [Show Ideation] [Show Fragments]      │
└─────────────────────────────────────────┘
```

---

### 3.8 Benefits

✅ **Flexible writing** - Main document with linked meta content  
✅ **Preserved context** - Ideation and fragments linked to main document  
✅ **Targeted improvements** - Apply specific actions to portions  
✅ **Writing evolution** - Track from ideation/draft to final main document  
✅ **Multiple styles** - Main document with ideation/fragments/draft linked  
✅ **AI-powered** - Context-aware suggestions  
✅ **Reversible** - Can revert actions and show original meta content  
✅ **Clear separation** - Main document vs. meta content (modes)  
✅ **Tone flexibility** - Main document has no enforced tone/style  
✅ **Style system** - Apply document styles (academic, whitepaper, etc.)  
✅ **Template system** - Use common or format-specific templates  
✅ **Format flexibility** - Styles and templates work across LaTeX, Markdown, HTML

---

## 4. Smart Features

### Auto-Numbering

- **Placeholders** - `{REF}` auto-replaced based on context
- **Labels** - Auto-suggested based on content
- **References** - Auto-update when structure changes

### Code Integration

- **Link detection** - When mentioning function names, suggests linking
- **Code snippets** - Auto-format code blocks
- **Syntax highlighting** - In editor and preview

### Citation Management

- **Citation picker** - Search bibliography
- **Auto-format** - Formats citations correctly
- **Reference list** - Auto-generates bibliography

### Table Editor

- **Visual table editor** - WYSIWYG table editing
- **Export to Markdown** - Converts to Markdown table syntax
- **LaTeX conversion** - Handles complex tables

---

## 6. Keyboard Shortcuts

### General
- `Ctrl/Cmd + S` - Save
- `Ctrl/Cmd + K` - Command palette
- `Ctrl/Cmd + /` - Toggle comment
- `Ctrl/Cmd + B` - Bold
- `Ctrl/Cmd + I` - Italic
- `Ctrl/Cmd + \` - Toggle bottom panel

### Navigation
- `Ctrl/Cmd + G` - Go to line
- `Ctrl/Cmd + F` - Find
- `Ctrl/Cmd + H` - Replace
- `Ctrl/Cmd + P` - Quick open

### Insertion
- `Ctrl/Cmd + M` - Insert math
- `Ctrl/Cmd + Shift + M` - Insert math block
- `Ctrl/Cmd + I` - Insert image
- `Ctrl/Cmd + T` - Insert table
- `Ctrl/Cmd + L` - Insert link

### LaTeX
- `Ctrl/Cmd + Shift + C` - Insert citation
- `Ctrl/Cmd + Shift + R` - Insert reference
- `Ctrl/Cmd + Shift + E` - Insert environment
- `Ctrl/Cmd + Enter` - Insert page break

---

## 7. Preview Features

### Live Preview
- **Side-by-side** - Editor and preview side-by-side
- **Sync scroll** - Preview scrolls with editor
- **Click to edit** - Click in preview to jump to editor position

### Preview Modes
- **Markdown** - Standard Markdown rendering
- **LaTeX** - LaTeX-compiled preview
- **PDF** - Rendered PDF preview

### Preview Actions
- **Export** - Export from preview
- **Print** - Print preview
- **Fullscreen** - Fullscreen preview mode

---

## 8. Collaboration Features

### Real-Time Editing
- **Presence indicators** - See who's editing
- **Live cursors** - See other users' cursors
- **Conflict resolution** - AI-assisted merge suggestions

### Comments
- **Inline comments** - Comment on specific lines
- **Threaded discussions** - Reply to comments
- **Resolve** - Mark comments as resolved

---

## 9. Mobile/Tablet Support

### Touch-Friendly
- **Larger buttons** - Bottom panel optimized for touch
- **Swipe gestures** - Swipe to insert common elements
- **Voice input** - Voice-to-text for content

### Limited Features
- **Read mode** - Optimized reading view
- **Quick edits** - Basic editing capabilities
- **Full editing** - Redirects to web app

---

## Benefits

✅ **Fast insertion** - Backslash commands for power users  
✅ **Visual editing** - Bottom panel for beginners  
✅ **AI-powered** - Context-aware assistance  
✅ **LaTeX support** - Full LaTeX capability  
✅ **Code integration** - Easy code-doc linking  
✅ **Collaborative** - Real-time editing  
✅ **Multi-platform** - Web, desktop, mobile

