# Zadoox UX Guidelines

## Core UX Principles

### 1. Prefer Inline/Tabs Over Popups/Modals

**Principle**: Avoid popups and modals whenever possible. Use inline views, tabs, or sidebars instead.

**Rationale**:
- Better user flow - no context switching
- More screen real estate for content
- Feels more integrated and native
- Less jarring user experience
- Works better on smaller screens

**Implementation Guidelines**:
- ✅ **Use tabs** for switching between related views (e.g., Edit/Preview/Split, Version History)
- ✅ **Use sidebars** for secondary information (e.g., document outline, version list)
- ✅ **Use inline panels** that slide in/out or expand/collapse
- ✅ **Use dropdowns** for simple selections (not complex forms)
- ❌ **Avoid modals** for content viewing/editing
- ❌ **Avoid popups** for information display
- ⚠️ **Use modals only** for:
  - Critical confirmations (delete, destructive actions)
  - Short forms (create project, quick settings)
  - Error messages that block workflow

**Examples**:
- Version History: Use a sidebar or tab panel, not a modal
- Settings: Use a sidebar panel, not a modal
- Document comparison: Use split view or tabs, not a modal
- Create forms: Can use modal for quick actions, but prefer inline forms for complex workflows

### 2. Progressive Disclosure

Show information progressively - don't overwhelm users with all options at once.

### 3. Consistent Navigation

- Use breadcrumbs for hierarchical navigation
- Keep navigation elements in consistent locations
- Use familiar patterns (VS Code-inspired for this project)

### 4. Keyboard-First

- Support keyboard shortcuts for common actions
- Don't require mouse for primary workflows
- Show keyboard shortcuts in tooltips/hints

### 5. Visual Feedback

- Show loading states clearly
- Provide immediate feedback for actions
- Use subtle animations for state changes
- Don't hide important status information

### 6. Error Handling

- Show errors inline when possible
- Use toast notifications for non-blocking errors
- Only use modals for critical errors that block workflow

## Component Patterns

### Sidebars
- Collapsible sidebars for secondary content
- Use icons + labels for clarity
- Support keyboard shortcuts to toggle

### Tabs
- Use tabs for switching between related views
- Keep tab state persistent when possible
- Show active tab clearly

### Inline Panels
- Slide-in panels from sides
- Expandable/collapsible sections
- Don't block main content when open

### Forms
- Inline forms when part of main workflow
- Modal forms only for quick actions
- Multi-step forms should be inline with progress indicators

## Implementation Checklist

When adding new features, ask:
- [ ] Can this be inline instead of a popup?
- [ ] Can this use tabs instead of a modal?
- [ ] Can this be a sidebar panel?
- [ ] Is a modal truly necessary (destructive action, critical confirmation)?
- [ ] Does this follow VS Code-inspired patterns?
- [ ] Are keyboard shortcuts supported?

## Examples in Codebase

### ✅ Good Examples
- Editor view modes (Edit/Preview/Split) - tabs
- Document outline - sidebar
- Formatting toolbar - inline

### ❌ To Refactor
- Version history - currently modal, should be sidebar/tab
- Settings - if modal, should be sidebar

---

**Last Updated**: December 22, 2024
**Status**: Active Guidelines - Apply to all new features




