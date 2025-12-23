# Text Unit Metadata & AI Insights UX Design

## Overview
Display metadata (edit time, editor, AI analysis) and actions for text units (paragraphs, sections) in a VS Code-inspired editor.

## Requirements

### Metadata to Display
- **Last edit time** (timestamp)
- **Edited by** (multi-user collaboration)
- **AI Analysis**:
  - Sentiment
  - Quality score
  - Wordiness
  - Clarity
- **Quick Actions**:
  - AI Improve
  - AI Expand
  - AI Clarify
  - Fix issues

### Scope
- Paragraph-level metadata
- Section/subsection-level metadata
- Real-time AI suggestions as user types

---

## ⭐ RECOMMENDED: Hybrid Left Indicators + Hover Interactions

### Layout
```
┌──────┬─────────────────────────────────────────────┐
│  42  │ This is a paragraph with some text.        │
│  🔴  │                                            │ ← Red = Error/Issue
│      │                                            │
├──────┼─────────────────────────────────────────────┤
│  43  │ Another paragraph here that might need    │
│  🟡  │ some improvement.                         │ ← Yellow = Suggestion
│      │                                            │
├──────┼─────────────────────────────────────────────┤
│  44  │ Great paragraph with good quality!        │
│  🟢  │                                            │ ← Green = Good/OK
│      │                                            │
└──────┴─────────────────────────────────────────────┘
```

### Two-Tier Interaction System

#### 1. Left Indicator Column (Always Visible)
- **Color-coded bars/dots** in the left margin (next to line numbers)
- **Types**:
  - 🔴 **Red**: Error/Critical issue
  - 🟡 **Yellow**: Suggestion/Needs improvement
  - 🟢 **Green**: Good quality
  - 🔵 **Blue**: AI suggestion available
  - ⚪ **Gray**: Neutral/No analysis yet

#### 2. Hover on Indicator → Action Menu
```
Hover over 🔴 indicator:
┌─────────────────────────────┐
│ Quick Actions                │
├─────────────────────────────┤
│ 🔧 Auto-fix                  │
│ ✏️ Improve with AI          │
│ 🔍 View details             │
└─────────────────────────────┘
```

#### 3. Hover on Paragraph/Section → Info Banner
```
┌─────────────────────────────────────────────────────────┐
│  42  │ This is a paragraph with some text.        │
│  🔴  │ [Highlighted background on hover]          │
│      │                                            │
│      │ ┌─────────────────────────────────────┐   │ ← Appears at top
│      │ │ 2m ago • @JD • Quality: 65% • 🔴   │   │   of paragraph
│      │ │ [Improve] [Expand] [View Details]   │   │
│      │ └─────────────────────────────────────┘   │
│      │                                            │
└──────┴─────────────────────────────────────────────┘
```

### Visual Design Details

#### Indicator Column
- **Width**: 4-6px vertical bar OR 8px circular dot
- **Position**: Left margin, aligned with paragraph start
- **Stacking**: Multiple indicators can stack vertically if multiple issues/suggestions exist for same paragraph
- **Colors**:
  - Red: `#f48771` (error red)
  - Yellow: `#dcdcaa` (warning yellow)
  - Green: `#4ec9b0` (success green)
  - Blue: `#569cd6` (info blue)
  - Gray: `#858585` (neutral gray)

**Multiple Indicators Example:**
```
┌──────┬─────────────────────────────┐
│  42  │ 🔴 Error indicator         │
│      │ 🟡 Warning indicator       │ ← Stacked indicators
│      │ 🔵 AI suggestion           │
│      │                            │
└──────┴─────────────────────────────┘
```

#### Paragraph Hover Effect
- **Background highlight**: Subtle color change (e.g., `rgba(255, 255, 255, 0.05)`)
- **Info banner**: Appears at top of paragraph block
  - Shows: timestamp, editor, quality score, status
  - Action buttons: Improve, Expand, View Details
  - Auto-hide after 2-3 seconds if no interaction

#### Section Hover Effect
- Similar to paragraph but:
  - Highlight entire section
  - Show aggregated metrics (avg quality, contributors, etc.)
  - Section-level actions

### Implementation Example

```
┌─────────────────────────────────────────────────────────────┐
│ Line │ Indicator │ Content                                  │
├──────┼───────────┼──────────────────────────────────────────┤
│  42  │ 🔴        │ This paragraph has a critical issue.     │
│      │           │ [Paragraph hover shows info banner]      │
│      │           │                                          │
├──────┼───────────┼──────────────────────────────────────────┤
│  43  │ 🟡        │ This paragraph could be improved.        │
│      │           │                                          │
├──────┼───────────┼──────────────────────────────────────────┤
│  44  │ 🟢        │ ## Section Title                         │
│      │           │                                          │
│  45  │ 🟢        │ Great paragraph here!                    │
│      │           │                                          │
└──────┴───────────┴──────────────────────────────────────────┘

On hover over 🟡 indicator:
┌─────────────────────────────┐
│ Quick Actions                │
├─────────────────────────────┤
│ ✏️ Improve with AI          │
│ 🔍 View analysis            │
│ ❌ Dismiss suggestion       │
└─────────────────────────────┘

On hover over paragraph:
┌─────────────────────────────────────────────┐
│  43  │ 🟡 This paragraph could...          │
│      │ [Background highlight]              │
│      │ ┌─────────────────────────────┐     │
│      │ │ 5m ago • @AH • Quality: 72% │     │
│      │ │ [Improve] [Expand] [Details]│     │
│      │ └─────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

### Benefits
✅ Clean, minimal indicators (no clutter)
✅ Contextual information on demand
✅ Familiar hover patterns
✅ Works for paragraphs and sections
✅ Quick actions readily available
✅ Real-time status visible at a glance

---

## Option 1: Inline Indicators (VS Code .NET Style)

### Layout
```
┌─────────────────────────────────────────────────────────┐
│ [Line] │ Content                    │ [Meta] │ [AI]    │
├─────────────────────────────────────────────────────────┤
│   42   │ This is a paragraph with   │ 2m ago │ ⚠️ 💡   │
│        │ some text.                 │ @user  │         │
│        │                            │ 75% ✓  │         │
├─────────────────────────────────────────────────────────┤
│   43   │ Another paragraph here.    │ 5m ago │         │
│        │                            │ @user2 │         │
│        │                            │ 90% ✓  │         │
└─────────────────────────────────────────────────────────┘
```

### Implementation
- **Left column**: Line numbers (existing)
- **Content area**: Editor text
- **Right gutter** (like VS Code problems panel):
  - Small icons/badges for metadata
  - Color-coded indicators:
    - 🟢 Green: Good quality
    - 🟡 Yellow: Needs attention
    - 🔴 Red: Issues detected
  - Hover shows tooltip with details
  - Click opens detailed panel

### Pros
✅ Familiar pattern (VS Code diagnostics)
✅ Doesn't interfere with editing
✅ Always visible context
✅ Clean, scannable
✅ Works well with existing line numbers

### Cons
❌ Right gutter takes some horizontal space
❌ Small icons might be hard to see at a glance

### Visual Design
```
Editor:
┌──────┬────────────────────────────┬──────┬──────┐
│  42  │ This paragraph has issues  │ 2m   │ ⚠️   │ ← Yellow warning
│      │                            │ @JD  │ 💡   │ ← AI suggestion available
│      │                            │ 65%  │      │
├──────┼────────────────────────────┼──────┼──────┤
│  43  │ Great paragraph here!      │ 5m   │ ✓    │ ← Green check
│      │                            │ @AH  │      │
│      │                            │ 92%  │      │
└──────┴────────────────────────────┴──────┴──────┘
```

**Gutter indicators:**
- **Quality score**: `92%` (color-coded)
- **Edit info**: `2m @JD` (timestamp + user initial)
- **Status icons**: 
  - ✓ Good
  - ⚠️ Needs improvement
  - 💡 AI suggestion
  - 🔧 Auto-fix available

---

## Option 2: Left Margin Column (Paragraph-Aligned)

### Layout
```
┌──────┬─────────────────────────────────────────────┐
│ P1   │ This is the first paragraph...              │
│ 2m   │                                             │
│ @JD  │                                             │
│ 75%  │                                             │
├──────┼─────────────────────────────────────────────┤
│ P2   │ Another paragraph here...                   │
│ 5m   │                                             │
│ @AH  │                                             │
│ 92%  │                                             │
└──────┴─────────────────────────────────────────────┘
```

### Implementation
- Narrow column between line numbers and content
- Aligned with paragraph blocks
- Shows: timestamp, user, quality, action buttons

### Pros
✅ Clear paragraph association
✅ Organized vertically
✅ Good for scanning

### Cons
❌ Takes vertical space
❌ Awkward with long paragraphs
❌ Doesn't work well with mixed content (lists, headings)

---

## Option 3: Inline with Small Font (Minimal)

### Layout
```
┌─────────────────────────────────────────────────────┐
│ This is a paragraph with text. [2m @JD 75% ⚠️]     │
│                                                      │
│ Another paragraph here. [5m @AH 92% ✓]              │
└─────────────────────────────────────────────────────┘
```

### Implementation
- Small gray text inline at end of paragraph
- On hover: expand to show actions

### Pros
✅ No extra space needed
✅ Contextual placement

### Cons
❌ Clutters the text
❌ Can be distracting while editing
❌ Hard to scan
❌ Doesn't scale to larger units

---

## Option 4: Side Panel (Right Side)

### Layout
```
┌──────────────────┬──────────────────┬──────────────┐
│ Editor           │ Preview          │ Metadata     │
│                  │                  │              │
│ Paragraph 1...   │ Rendered...      │ P1:          │
│                  │                  │ - 2m ago     │
│ Paragraph 2...   │ Rendered...      │ - @JD        │
│                  │                  │ - 75%        │
│                  │                  │ - [Improve]  │
└──────────────────┴──────────────────┴──────────────┘
```

### Pros
✅ Rich information display
✅ Doesn't interfere with editing
✅ Can show detailed analysis

### Cons
❌ Takes horizontal space
❌ Far from content (context loss)
❌ Needs to switch between preview/metadata
❌ Not always visible

---

## Alternative: Right Gutter Approach

### Primary: Right Gutter Indicators (Option 1)
- Small, color-coded icons/badges
- Quick visual scan
- Always visible

### Secondary: Hover/Click for Details
- Hover over indicator → Tooltip with metadata
- Click indicator → Side panel opens with:
  - Full metadata
  - AI analysis details
  - Action buttons (Improve, Expand, Clarify)

### Real-Time AI Indicators
- **Underline/wavy lines** (like VS Code diagnostics):
  - Yellow wavy: Needs improvement
  - Blue underline: AI suggestion available
  - Red underline: Error/issue
- **Inline tooltips** on hover over underlined text

---

## Detailed Design: Hybrid Left Indicators (RECOMMENDED)

### Indicator States

1. **🔴 Red** - Critical Issue
   - Error in content
   - Quality < 60%
   - Must be fixed
   - Hover actions: Auto-fix, Improve, View error

2. **🟡 Yellow** - Needs Improvement
   - Quality 60-80%
   - Wordy or unclear
   - Recommended to improve
   - Hover actions: Improve, Expand, Clarify

3. **🟢 Green** - Good Quality
   - Quality > 80%
   - No issues detected
   - Hover actions: View details (optional)

4. **🔵 Blue** - AI Suggestion Available
   - AI has enhancement suggestion
   - Optional improvement
   - Hover actions: Apply suggestion, View suggestion

5. **⚪ Gray** - Pending Analysis
   - Not yet analyzed
   - Real-time analysis in progress

### Paragraph Hover Info Banner

**Appearance:**
- Slides in from top of paragraph
- Semi-transparent overlay
- VS Code-style colors
- Auto-dismiss after 3 seconds

**Content:**
```
┌──────────────────────────────────────────────────┐
│ 5m ago  •  @AH  •  Quality: 72%  •  🟡         │
│ [Improve] [Expand] [Clarify] [View Details]     │
└──────────────────────────────────────────────────┘
```

**Actions:**
- **Improve**: AI improves the paragraph
- **Expand**: AI expands/adds content
- **Clarify**: AI improves clarity
- **View Details**: Opens side panel with full analysis

### Section Hover Info Banner

For headings/sections, show aggregated info:
```
┌──────────────────────────────────────────────────┐
│ Section 1.2: Background                          │
│ Last updated: 10m ago  •  Avg Quality: 82%      │
│ Contributors: @JD, @AH  •  3 paragraphs         │
│ [Analyze Section] [Improve All] [View Details]  │
└──────────────────────────────────────────────────┘
```

---

## Detailed Design: Right Gutter Alternative

### Gutter Column Width
- **60-80px wide** (adjustable)
- Matches VS Code problems panel width

### Indicator Types

#### 1. Quality Score Badge
```
┌────┐
│ 75%│ ← Color: Red (<70%), Yellow (70-85%), Green (>85%)
└────┘
```

#### 2. Edit Info Badge
```
┌────────┐
│ 2m @JD │ ← Timestamp + User initials
└────────┘
```

#### 3. Status Icons
- ✓ **Check** (Green): Good quality, no issues
- ⚠️ **Warning** (Yellow): Needs attention
- 💡 **Lightbulb** (Blue): AI suggestion available
- 🔧 **Wrench** (Gray): Auto-fix available
- 🔄 **Sync** (Orange): Being analyzed

### Hover Tooltip
```
┌─────────────────────────────┐
│ Paragraph 1                 │
├─────────────────────────────┤
│ Last edited: 2 minutes ago  │
│ Edited by: John Doe         │
│ Quality: 75%                │
│                             │
│ AI Analysis:                │
│ • Sentiment: Neutral        │
│ • Wordiness: Moderate       │
│ • Clarity: Good             │
│                             │
│ [Improve] [Expand] [Clarify]│
└─────────────────────────────┘
```

### Section-Level Metadata
For headings/sections, show aggregated metadata:
```
┌──────────────────────────────────────────┐
│ ## Section 1.2                          │
│ Last updated: 5m ago | Avg Quality: 82% │
│ Contributors: @JD, @AH                  │
│ [Analyze Section] [Improve All]         │
└──────────────────────────────────────────┘
```

### Real-Time AI Indicators
- As user types → AI analyzes
- Underline appears with delay (2-3 seconds)
- Color indicates severity:
  - **Blue**: Suggestion (optional improvement)
  - **Yellow**: Recommendation (should improve)
  - **Red**: Error (must fix)

---

## Implementation Phases

### Phase 1: Basic Gutter (MVP)
- Right gutter column
- Quality score badge
- Edit time/user badge
- Hover tooltip with basic info

### Phase 2: AI Indicators
- Real-time underline indicators
- Status icons (💡, ⚠️, ✓)
- Click to show AI panel

### Phase 3: Rich Metadata
- Full AI analysis display
- Action buttons
- Section-level aggregation

### Phase 4: Collaboration
- Multi-user indicators
- Conflict resolution UI
- Presence indicators

---

## Alternative: Simplified MVP Approach

For initial implementation, start with **minimal indicators**:

1. **Right gutter**: Single icon per paragraph
   - Color indicates quality (red/yellow/green)
   - Shows edit time on hover

2. **Inline indicators**: Only show when AI has suggestions
   - Blue wavy underline
   - Hover shows suggestion
   - Click accepts/improves

3. **Toolbar button**: "Analyze Document" 
   - Runs full analysis
   - Shows results in side panel

This can evolve into the full gutter system later.

---

## Final Recommendation Summary

✅ **Hybrid Left Indicators + Hover Interactions**

### Key Features:
1. **Left margin indicators** - Color-coded (🔴🟡🟢🔵) always visible
2. **Hover on indicator** - Shows quick action menu
3. **Hover on paragraph** - Background highlight + info banner at top
4. **Real-time updates** - Indicators update as user types
5. **Section support** - Works for paragraphs and sections

### Benefits:
- Minimal visual clutter
- Contextual information on demand
- Familiar interaction patterns
- Scales from MVP to full-featured
- Maintains VS Code aesthetic

## Next Steps

1. Create `IndicatorColumn` component
2. Create `ParagraphInfoBanner` component  
3. Create `IndicatorActionMenu` component
4. Integrate with CodeMirror (gutter + decorations)
5. Implement paragraph detection and tracking
6. Add hover event handlers
7. Connect to AI analysis service

