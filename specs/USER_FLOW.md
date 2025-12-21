# Zadoox User Flow - Hybrid Model
## Web App + Cursor Integration

## Overview

Zadoox operates as a hybrid platform:
- **Web App**: Full-featured documentation editor with AI assistance
- **Cursor Integration**: Code-doc linking and inline documentation features
- **Sync**: Seamless synchronization between web and editor

---

## 1. Onboarding Flow

### 1.1 New User Signup

```
User visits zadoox.com
    ↓
[Landing Page]
- "AI-powered documentation that understands your code"
- Demo video
- Pricing tiers
    ↓
User clicks "Get Started" / "Try Free"
    ↓
[Signup Screen]
- Email/Password or OAuth (GitHub, Google)
- Choose plan: Free / Pro / Enterprise
    ↓
[Welcome Screen]
- Quick tour option
- "Create your first project" CTA
    ↓
[Project Creation]
- Project name
- Project type: Academic / Industry / Code Documentation
- Initialize from:
  * Empty project
  * Import from Git repo
  * Import from Overleaf
  * Template library
    ↓
[Onboarding Complete]
- Redirect to Web App Dashboard
```

### 1.2 Cursor Integration Setup

```
User in Web App Dashboard
    ↓
[Settings → Integrations]
- "Connect Cursor" button
    ↓
[Installation Instructions]
- Install Zadoox Cursor extension
- Link: marketplace or direct install
    ↓
User installs extension in Cursor
    ↓
[Extension Activation]
- Extension prompts: "Connect to Zadoox account"
- Opens browser to authorize
- User logs in / authorizes
    ↓
[Connection Established]
- Extension shows "Connected to Zadoox"
- Web app shows "Cursor connected"
    ↓
[First Sync]
- Extension scans workspace
- Detects code structure
- Syncs with web app project
```

---

## 2. Web App - Core Writing Flow

### 2.1 Creating a New Document

```
User in Dashboard
    ↓
[Click "New Document"]
    ↓
[Document Creation Modal]
- Document name
- Document type: Chapter / Section / Standalone
- Template: Academic Paper / Technical Doc / Code Docs
- Link to code? (if Cursor connected)
    ↓
[Document Editor Opens]
- Markdown editor with AI sidebar
- Left: Document outline
- Center: Editor with LaTeX preview
- Right: AI assistant panel
    ↓
User starts writing
```

### 2.2 AI-Assisted Writing Flow

```
User types in editor
    ↓
[AI Context Awareness]
- Analyzes current section
- Understands document structure
- Detects writing style
    ↓
[AI Suggestions Appear]
- Inline suggestions (gray text)
- Sidebar: "AI Suggestions" panel
    ↓
User can:
  A) Accept suggestion (Tab / Click)
  B) Ignore suggestion
  C) Request more options
    ↓
[AI Features Available]
- "Expand this section"
- "Add references"
- "Improve clarity"
- "Add code example"
- "Generate figure description"
    ↓
User clicks "Expand this section"
    ↓
[AI Processing]
- Analyzes context
- Generates expanded content
- Shows in suggestion panel
    ↓
User reviews and accepts/rejects
```

### 2.3 Adding References

```
User types: "Recent studies show..."
    ↓
[AI Detects Reference Need]
- Highlights text
- Shows: "Add reference?"
    ↓
User clicks "Add reference"
    ↓
[Reference Search]
- AI searches academic databases
- Shows relevant papers
- User selects papers
    ↓
[Auto-Format]
- Adds to bibliography
- Formats citation (LaTeX/BibTeX)
- Updates in-text citation
    ↓
[Reference Appears]
- In-text: \cite{author2024}
- Bibliography: Auto-added entry
```

### 2.4 Code-Doc Linking (Web App)

```
User in document editor
    ↓
[Click "Link to Code"]
    ↓
[Code Browser Opens]
- Shows connected Cursor workspace
- File tree navigation
- Function/class list
    ↓
User selects code element
- Function: `calculateTotal()`
- Class: `UserManager`
- File: `src/utils/helpers.py`
    ↓
[Link Creation]
- Creates bidirectional link
- Adds code snippet to doc
- Adds doc reference in code
    ↓
[Link Display]
- In doc: Shows code snippet with "View in Cursor" button
- In Cursor: Shows doc reference badge
```

---

## 3. Cursor Integration Flow

### 3.1 Inline Documentation Writing

```
Developer in Cursor editing code
    ↓
[Right-click on function/class]
- Context menu appears
- Option: "Document with Zadoox"
    ↓
[Zadoox Panel Opens]
- Shows function signature
- AI suggests documentation
- Quick doc template
    ↓
Developer writes/edits doc
- Uses AI suggestions
- Adds examples
- Links to related code
    ↓
[Save Documentation]
- Saves to Zadoox project
- Syncs to web app
- Optionally: Adds to code comments
    ↓
[Documentation Linked]
- Code shows "📄" badge
- Click badge → Opens full doc in web app
```

### 3.2 Code-Doc Sync

```
Developer modifies code function
    ↓
[Zadoox Extension Detects Change]
- Monitors file changes
- Detects linked functions
    ↓
[Change Notification]
- Shows in Cursor: "Linked documentation may need update"
- Highlights changed function
    ↓
Developer clicks notification
    ↓
[Diff View Opens]
- Shows code changes
- Shows current documentation
- AI suggests doc updates
    ↓
Developer reviews suggestions
    ↓
[Update Documentation]
- Accepts AI suggestions
- Or manually edits
    ↓
[Sync Complete]
- Doc updated in web app
- Version history maintained
```

### 3.3 Generate Documentation from Code

```
Developer in Cursor
    ↓
[Command Palette: "Zadoox: Generate Docs"]
    ↓
[Selection Options]
- Current file
- Current function/class
- Entire workspace
- Selected code
    ↓
Developer selects "Current file"
    ↓
[AI Analysis]
- Scans code structure
- Identifies functions, classes, modules
- Understands code relationships
    ↓
[Documentation Generated]
- Creates doc structure
- Generates descriptions
- Adds code examples
- Links code elements
    ↓
[Preview in Cursor]
- Shows generated doc
- Developer can edit
    ↓
[Save to Zadoox]
- Creates new document in web app
- Links all code elements
- Syncs immediately
```

### 3.4 View Documentation in Cursor

```
Developer hovers over code element
    ↓
[Zadoox Tooltip]
- Shows brief doc summary
- "View full doc" link
    ↓
Developer clicks "View full doc"
    ↓
[Zadoox Panel Opens]
- Shows full documentation
- Code-doc links highlighted
- "Edit in Web App" button
    ↓
Developer can:
- Read documentation
- Navigate to linked code
- Edit (opens web app)
- Export section
```

---

## 4. Collaboration Flow

### 4.1 Real-Time Collaboration (Web App)

```
User A editing document
    ↓
User B opens same document
    ↓
[Collaboration Mode]
- Shows User B's cursor
- Live edits appear
- User presence indicators
    ↓
[AI-Assisted Collaboration]
- AI detects conflicts
- Suggests merge strategies
- Tracks changes by user
    ↓
[Comments & Suggestions]
- Users can comment
- AI can suggest improvements
- Review mode available
```

### 4.2 Review & Approval Flow

```
Author completes document
    ↓
[Click "Request Review"]
    ↓
[Review Assignment]
- Select reviewers
- Set deadline
- Add review notes
    ↓
[Reviewers Notified]
- Email notification
- In-app notification
    ↓
Reviewer opens document
    ↓
[Review Mode]
- Can add comments
- Can suggest edits
- AI highlights potential issues
    ↓
[Review Complete]
- Reviewer submits feedback
- Author notified
    ↓
[Author Reviews Feedback]
- Accepts/rejects suggestions
- AI helps resolve conflicts
    ↓
[Final Approval]
- Document approved
- Ready for export
```

---

## 5. Export & Publishing Flow

### 5.1 Multi-Format Export

```
User in document editor
    ↓
[Click "Export"]
    ↓
[Export Options]
- Format: LaTeX PDF / Markdown / HTML / Word
- Include: All chapters / Selected / Current
- Options: Bibliography / Figures / Code snippets
    ↓
User selects "LaTeX PDF"
    ↓
[Export Processing]
- Converts Markdown to LaTeX
- Processes {CH} placeholders
- Compiles PDF
    ↓
[Export Complete]
- Download PDF
- Or: Push to Git
- Or: Publish to web
```

### 5.2 Git Integration

```
User in document editor
    ↓
[Click "Push to Git"]
    ↓
[Git Options]
- Repository: Select/Connect
- Branch: Select branch
- Commit message: Auto-generated or custom
    ↓
[Pre-Push Processing]
- Replaces {CH} placeholders
- Formats for Git
- Validates structure
    ↓
[Git Push]
- Commits changes
- Pushes to remote
- Restores {CH} placeholders locally
    ↓
[Sync Complete]
- Web app shows "Synced"
- Cursor extension updates
```

### 5.3 Publishing to Web

```
User in document editor
    ↓
[Click "Publish"]
    ↓
[Publishing Options]
- Platform: GitBook / GitHub Pages / Custom
- Visibility: Public / Private / Team
    ↓
User selects "GitBook"
    ↓
[Publishing Process]
- Formats for GitBook
- Uploads to connected account
- Updates automatically
    ↓
[Published]
- Live URL provided
- Auto-updates on changes
```

---

## 6. Advanced AI Features Flow

### 6.1 Document Enhancement

```
User selects document section
    ↓
[AI Menu Appears]
- "Enhance this section"
- "Add more detail"
- "Improve clarity"
- "Add examples"
    ↓
User clicks "Enhance this section"
    ↓
[AI Analysis]
- Analyzes content
- Identifies improvement areas
- Generates enhanced version
    ↓
[Side-by-Side Comparison]
- Original | Enhanced
- User can accept/reject changes
    ↓
User accepts changes
    ↓
[Document Updated]
```

### 6.2 Style Refinement

```
User in document editor
    ↓
[Click "AI Style Refinement"]
    ↓
[Style Options]
- Academic formal
- Technical documentation
- Industry report
- Custom style guide
    ↓
User selects "Academic formal"
    ↓
[AI Processing]
- Analyzes entire document
- Suggests style improvements
- Highlights changes
    ↓
[Review Changes]
- User reviews each suggestion
- Can accept all / selective
    ↓
[Apply Changes]
- Document updated
- Style guide saved
```

### 6.3 Multi-Language Support

```
User writing in English
    ↓
[Select text]
    ↓
[AI Menu: "Translate"]
    ↓
[Translation Options]
- Target language
- Preserve technical terms
- Maintain formatting
    ↓
User selects "Spanish"
    ↓
[Translation Generated]
- Shows translated version
- Highlights technical terms
- Preserves LaTeX/Markdown
    ↓
[User Reviews]
- Can edit translation
- Can accept/reject
    ↓
[Translation Applied]
- Document updated
- Original preserved in version history
```

---

## 7. Project Management Flow

### 7.1 Organizing Documents

```
User in Dashboard
    ↓
[Project View]
- Shows all documents
- Chapter structure
- Code links overview
    ↓
[Document Organization]
- Drag & drop to reorder
- Create folders/sections
- Link documents
    ↓
[Chapter Numbering]
- Auto-numbering based on structure
- {CH} placeholders maintained
- Updates on reorganization
```

### 7.2 Version Control

```
User in document editor
    ↓
[Version History Panel]
- Shows all versions
- Timeline view
- Change highlights
    ↓
User clicks on version
    ↓
[Version Preview]
- Shows document at that time
- Highlights changes
    ↓
[Version Actions]
- Restore this version
- Compare with current
- Create branch
    ↓
User selects "Restore"
    ↓
[Restoration Confirmation]
- Shows diff
- User confirms
    ↓
[Version Restored]
- Document reverted
- New version created
```

---

## 8. Search & Discovery Flow

### 8.1 Global Search

```
User in any view
    ↓
[Press Cmd/Ctrl + K]
    ↓
[Search Interface Opens]
- Global search bar
- Recent documents
- Quick actions
    ↓
User types search query
    ↓
[Search Results]
- Documents matching query
- Code elements (if linked)
- AI suggestions
    ↓
User selects result
    ↓
[Navigates to location]
- Opens document
- Highlights match
- Shows context
```

### 8.2 Code-Doc Cross-Reference

```
User in document
    ↓
[Mentions code element]
- Types: "The calculateTotal function..."
    ↓
[AI Detects Code Reference]
- Highlights text
- Shows: "Link to code?"
    ↓
User clicks "Link"
    ↓
[Code Search]
- Searches connected workspace
- Shows matching functions
    ↓
User selects function
    ↓
[Link Created]
- Bidirectional link established
- Code shows doc reference
- Doc shows code link
```

---

## 9. Mobile/Tablet Flow

### 9.1 Mobile Reading

```
User opens Zadoox mobile app
    ↓
[Document Library]
- Shows all documents
- Recent documents
- Offline access
    ↓
User opens document
    ↓
[Reading View]
- Optimized for mobile
- Can highlight/annotate
- Share options
    ↓
[Limited Editing]
- Can add comments
- Can make quick edits
- Full editing in web app
```

---

## 10. Error Handling & Edge Cases

### 10.1 Sync Conflicts

```
User A edits in web app
User B edits in Cursor
    ↓
[Both save simultaneously]
    ↓
[Conflict Detection]
- System detects conflict
- Shows both versions
    ↓
[Conflict Resolution]
- AI suggests merge
- User can choose version
- Manual merge option
    ↓
[Resolution Applied]
- Document synced
- Both users notified
```

### 10.2 Offline Mode

```
User loses internet connection
    ↓
[Offline Mode Activated]
- Local editing continues
- Changes queued
    ↓
[Connection Restored]
- Auto-sync queued changes
- Resolves conflicts if any
    ↓
[Sync Complete]
- All changes synced
- User notified
```

---

## Key User Personas & Flows

### Persona 1: Academic Researcher
- Primary: Web app for writing papers
- Secondary: Cursor for code-related sections
- Flow: Write → AI enhance → Add references → Export LaTeX PDF

### Persona 2: Software Developer
- Primary: Cursor integration for code docs
- Secondary: Web app for comprehensive docs
- Flow: Code → Generate docs → Link → Sync → Publish

### Persona 3: Technical Writer
- Primary: Web app for writing
- Secondary: Cursor for code examples
- Flow: Write → Collaborate → Review → Publish multi-format

### Persona 4: Team Lead
- Primary: Web app for project management
- Secondary: Review and approval
- Flow: Assign → Review → Approve → Publish

---

## Success Metrics

### Engagement Metrics
- Daily active users (web + Cursor)
- Documents created per user
- AI suggestions accepted rate
- Code-doc links created

### Quality Metrics
- Document completion rate
- Export success rate
- Collaboration activity
- User satisfaction scores

### Business Metrics
- Free → Pro conversion
- Pro → Enterprise upgrade
- Churn rate
- Feature adoption rates

