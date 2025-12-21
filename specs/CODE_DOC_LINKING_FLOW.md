# Zadoox Code-Doc Linking Flow
## Brief User Flow: Web App → Cursor Integration

## Overview

This flow shows how users connect their code in Cursor to documentation in the Zadoox web app, creating bidirectional links between code and docs.

---

## Flow 1: Initial Setup & Connection

```
┌─────────────────┐
│   Web App       │
│   (zadoox.com)  │
└────────┬────────┘
         │
         │ User: Settings → Integrations
         │
         ▼
┌─────────────────────────────┐
│ "Connect Cursor"            │
│ - Shows install instructions│
│ - Provides extension link   │
└────────┬────────────────────┘
         │
         │ User: Clicks "Install Extension"
         │
         ▼
┌─────────────────┐
│   Cursor IDE    │
│   Extension     │
└────────┬────────┘
         │
         │ User: Installs Zadoox extension
         │
         ▼
┌─────────────────────────────┐
│ Extension: "Connect Account"│
│ Opens browser → zadoox.com  │
└────────┬────────────────────┘
         │
         │ User: Authorizes connection
         │
         ▼
┌─────────────────────────────┐
│ ✅ Connection Established    │
│ - Web app: "Cursor connected"│
│ - Cursor: "Connected to Zadoox"
└─────────────────────────────┘
```

---

## Flow 2: Create Document in Web App → Link to Code

```
┌─────────────────────────────────────┐
│  Web App: Create New Document       │
│  - User writes documentation        │
│  - Mentions code: "The calculateTotal│
│    function processes..."           │
└──────────────┬──────────────────────┘
               │
               │ User: Clicks "Link to Code"
               │
               ▼
┌─────────────────────────────────────┐
│  Code Browser Opens                 │
│  - Shows Cursor workspace structure │
│  - Lists files, functions, classes  │
│  - Search: "calculateTotal"          │
└──────────────┬──────────────────────┘
               │
               │ User: Selects function
               │
               ▼
┌─────────────────────────────────────┐
│  Link Created                       │
│  ✅ Document shows code snippet     │
│  ✅ Code in Cursor shows doc badge  │
│  ✅ Bidirectional link established  │
└─────────────────────────────────────┘
```

**Result:**
- **In Web App**: Document displays code snippet with "View in Cursor" button
- **In Cursor**: Function shows 📄 badge; clicking opens documentation

---

## Flow 3: Generate Docs from Code in Cursor

```
┌─────────────────────────────────────┐
│  Cursor: Developer editing code     │
│  - Right-clicks on function/class   │
│  - Selects "Document with Zadoox"   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Zadoox Panel Opens in Cursor      │
│  - Shows function signature         │
│  - AI suggests documentation        │
│  - Quick doc template               │
└──────────────┬──────────────────────┘
               │
               │ Developer: Writes/edits doc
               │
               ▼
┌─────────────────────────────────────┐
│  Save Documentation                 │
│  - Saves to Zadoox project          │
│  - Creates link to code element     │
│  - Syncs to web app immediately     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ✅ Documentation Linked           │
│  - Code shows 📄 badge              │
│  - Web app shows new document       │
│  - Click badge → Opens full doc     │
└─────────────────────────────────────┘
```

**Result:**
- **In Cursor**: Code element has documentation badge
- **In Web App**: New document created, linked to code
- **Bidirectional**: Click code badge → view doc; click doc → view code

---

## Flow 4: Code Changes → Doc Updates

```
┌─────────────────────────────────────┐
│  Cursor: Developer modifies code   │
│  - Changes function signature      │
│  - Updates logic                   │
└──────────────┬──────────────────────┘
               │
               │ Extension detects change
               │
               ▼
┌─────────────────────────────────────┐
│  Notification in Cursor             │
│  "Linked documentation may need     │
│   update"                           │
│  - Highlights changed function      │
└──────────────┬──────────────────────┘
               │
               │ Developer: Clicks notification
               │
               ▼
┌─────────────────────────────────────┐
│  Diff View Opens                    │
│  - Shows code changes               │
│  - Shows current documentation      │
│  - AI suggests doc updates          │
└──────────────┬──────────────────────┘
               │
               │ Developer: Reviews & accepts
               │
               ▼
┌─────────────────────────────────────┐
│  Documentation Updated              │
│  - Doc synced to web app            │
│  - Link maintained                  │
│  - Version history preserved        │
└─────────────────────────────────────┘
```

**Result:**
- Documentation stays in sync with code changes
- AI helps update docs automatically
- Version history tracks both code and doc changes

---

## Flow 5: View & Navigate Between Code & Docs

### 5.1 From Web App to Code

```
┌─────────────────────────────────────┐
│  Web App: User reading document    │
│  - Sees code snippet with link     │
│  - Clicks "View in Cursor"          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Cursor Opens (if not open)        │
│  - Navigates to linked function    │
│  - Highlights code element         │
│  - Shows doc reference badge        │
└─────────────────────────────────────┘
```

### 5.2 From Cursor to Docs

```
┌─────────────────────────────────────┐
│  Cursor: Developer hovers over code │
│  - Sees 📄 badge on function        │
│  - Clicks badge                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Zadoox Panel in Cursor             │
│  - Shows full documentation         │
│  - Highlights code-doc links        │
│  - "Edit in Web App" button         │
└──────────────┬──────────────────────┘
               │
               │ User: Clicks "Edit in Web App"
               │
               ▼
┌─────────────────────────────────────┐
│  Web App Opens                      │
│  - Opens document editor            │
│  - Navigates to linked section      │
│  - Ready to edit                    │
└─────────────────────────────────────┘
```

---

## Flow 6: Bulk Code-Doc Generation

```
┌─────────────────────────────────────┐
│  Cursor: Command Palette            │
│  "Zadoox: Generate Docs"            │
└──────────────┬──────────────────────┘
               │
               │ Developer: Selects scope
               │ - Current file
               │ - Entire workspace
               │ - Selected code
               │
               ▼
┌─────────────────────────────────────┐
│  AI Analysis                        │
│  - Scans code structure             │
│  - Identifies functions/classes     │
│  - Understands relationships        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Documentation Generated            │
│  - Creates doc structure            │
│  - Generates descriptions           │
│  - Adds code examples               │
│  - Links all code elements          │
└──────────────┬──────────────────────┘
               │
               │ Developer: Reviews & edits
               │
               ▼
┌─────────────────────────────────────┐
│  Save to Zadoox                     │
│  - Creates documents in web app     │
│  - Links all code elements          │
│  - Syncs immediately                │
└─────────────────────────────────────┘
```

**Result:**
- Multiple documents created in web app
- All code elements linked
- Ready for further editing and collaboration

---

## Key Interactions Summary

### Web App → Cursor
1. **Link Creation**: User links doc to code from web app
2. **Code Navigation**: Click "View in Cursor" → Opens code in Cursor
3. **Sync**: Changes in web app sync to Cursor extension

### Cursor → Web App
1. **Doc Generation**: Generate docs from code in Cursor
2. **Doc Updates**: Code changes trigger doc update suggestions
3. **Doc Viewing**: View full docs from code badges
4. **Doc Editing**: "Edit in Web App" opens full editor

### Bidirectional
1. **Real-time Sync**: Changes sync both ways
2. **Link Maintenance**: Links persist across edits
3. **Version History**: Both code and doc versions tracked
4. **Navigation**: Seamless navigation between code and docs

---

## User Benefits

✅ **Write docs in web app** → Automatically link to code  
✅ **Generate docs from code** → Automatically sync to web app  
✅ **Code changes** → Docs update automatically  
✅ **Navigate seamlessly** → Between code and docs  
✅ **Collaborate** → Team edits docs while code evolves  
✅ **Version control** → Track both code and doc changes together

