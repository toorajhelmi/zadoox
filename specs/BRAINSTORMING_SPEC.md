# Brainstorming Feature Specification

## Overview

The Brainstorming feature provides a chat-based interface (similar to Cursor's chat) for generating and organizing ideas for document paragraphs and sections. It allows users to have a free-form conversation with an AI assistant to explore different approaches, angles, and content ideas for their selected blocks.

## Goals

- Enable users to brainstorm content ideas through natural conversation
- Automatically extract and organize significant ideas as expandable cards
- Persist brainstorming sessions per paragraph/section (even if block is deleted)
- Generate content from selected ideas with blend/replace options
- Maintain full chat history for context and continuity

---

## Data Structure

### Document Metadata Extension

```typescript
interface DocumentMetadata {
  // ... existing fields
  brainstormingSessions?: Record<string, BrainstormingSession>;
}

interface BrainstormingSession {
  paragraphId: string;        // e.g., "para-0" or "para-5"
  messages: ChatMessage[];     // Full chat history
  ideaCards: IdeaCard[];       // Auto-extracted significant ideas
  createdAt: Date;
  updatedAt: Date;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  ideaCardIds?: string[];     // Links to idea cards extracted from this message
}

interface IdeaCard {
  id: string;
  topic: string;               // Short title/topic (e.g., "Focus on user benefits")
  description: string;         // Expanded description/explanation
  sourceMessageId: string;     // Which message generated this idea
  createdAt: Date;
}
```

### Storage

- Stored in `documents.metadata.brainstormingSessions` (JSONB field)
- Key: `paragraphId` (e.g., `"para-0"`, `"para-5"`)
- Sessions persist even if the paragraph is deleted or modified
- Each session maintains full chat history and idea cards

---

## User Interface

### Panel Layout

```
┌─────────────────────────────────────┐
│ Think Mode                    [✕]  │
├─────────────────────────────────────┤
│ [Brainstorm] [Research] [Fragments] │
├─────────────────────────────────────┤
│ ┌─ Idea Cards (Expandable) ───────┐│
│ │ 💡 Topic 1          [×] [Use]   ││
│ │   └─ Expanded description...    ││
│ │ 💡 Topic 2          [×] [Use]   ││
│ │ 💡 Topic 3          [×] [Use]   ││
│ └──────────────────────────────────┘│
├─────────────────────────────────────┤
│ ┌─ Chat Messages ─────────────────┐│
│ │ User: How can I improve this?   ││
│ │ AI: Here are some ideas...       ││
│ │ User: What about X?              ││
│ │ AI: Consider Y and Z...         ││
│ └──────────────────────────────────┘│
│                                     │
│ [Type message...]            [Send] │
└─────────────────────────────────────┘
```

### Components

1. **Idea Cards Section** (Top)
   - Expandable cards showing extracted ideas
   - Each card shows: topic, description (expandable), delete button, "Use" button
   - Cards ordered by creation date (newest first)
   - No hard limit on number of cards

2. **Chat Messages Section** (Middle)
   - Scrollable list of user and assistant messages
   - Auto-scroll to latest message
   - Messages show timestamp
   - Assistant messages may have linked idea cards

3. **Input Area** (Bottom)
   - Text input for user messages
   - Send button (or Enter key)
   - Loading indicator while AI is processing

---

## User Flows

### Flow 1: Starting a Brainstorming Session

1. User selects a paragraph/section and clicks "T" button
2. Think panel opens on the left
3. User clicks "Brainstorm" tab
4. If session exists: Load chat history and idea cards
5. If no session: Show empty chat with initial prompt suggestion

### Flow 2: Sending a Message

1. User types a message in the input area
2. User clicks "Send" (or presses Enter)
3. User message is added to chat immediately
4. Loading indicator shows
5. System sends to AI with context:
   - Selected block content
   - Section heading (if exists)
   - Section content (if exists - all paragraphs in section including subsections)
   - Previous chat messages (full history)
6. AI responds
7. Assistant message is added to chat
8. **Idea Extraction Check**: System checks if response contains significant new ideas
   - Compares against existing idea cards
   - Only extracts if idea is significantly different
   - Creates new idea cards if applicable
9. Session is saved to document metadata

### Flow 3: Using an Idea Card

1. User clicks "Use" button on an idea card
2. System checks if block has existing content:
   - **If block is empty**: Generate content directly
   - **If block has content**: Show dialog "Blend with existing" or "Replace"
3. User selects option (Blend/Replace)
4. System generates content based on:
   - Selected idea card (topic + description)
   - Block context (section heading, existing content if blending)
   - **If block is a section**: Include all paragraphs in section including subsections
5. Generated content is inserted into editor
6. User can undo if needed

### Flow 4: Managing Idea Cards

1. **Delete**: User clicks "×" button → Card is removed from session
2. **Expand**: User clicks card → Description expands/collapses
3. **View Source**: User can see which message generated the idea (optional feature)

---

## AI Integration

### Context for Chat Messages

When sending a user message to AI, include:

1. **Selected Block Content**
   - The actual text of the paragraph/section being brainstormed
   - If section: includes all content until next heading

2. **Section Context** (if applicable)
   - Section heading (if block is part of a section)
   - All content in the section (including subsections)
   - This helps AI understand the broader context

3. **Chat History**
   - All previous messages in the session
   - Maintains conversation context

4. **Existing Idea Cards**
   - List of current idea cards (topics only)
   - Helps AI avoid repeating ideas

### Idea Extraction Logic

**Trigger**: After each assistant message response

**Process**:
1. Analyze the assistant's response
2. Compare against existing idea cards (topics and descriptions)
3. Use LLM to determine if response contains **significant new ideas** that are:
   - Substantially different from existing ideas
   - Worth capturing as a separate idea card
   - Not just a variation or minor extension

**Prompt for Idea Extraction**:
```
You are analyzing an AI assistant's response to determine if it contains significant new ideas worth capturing.

EXISTING IDEA CARDS:
[list of existing idea topics and descriptions]

ASSISTANT RESPONSE:
[the assistant's latest message]

Determine if the response contains any significant new ideas that are:
1. Substantially different from existing ideas (not just variations)
2. Worth capturing as a separate, actionable idea
3. Distinct enough to warrant its own card

If yes, extract up to 3 new ideas. For each idea, provide:
- A short topic/title (max 50 chars)
- A brief description (1-2 sentences)

If no significant new ideas, return empty array.
```

**Result**:
- If new ideas found: Create idea cards and link to the message
- If no new ideas: Do not create cards (avoid clutter)

---

## Content Generation

### When "Use" is Clicked

1. **Check Block Type**:
   - If block is a section (has heading): Include all paragraphs in section including subsections
   - If block is a regular paragraph: Include only that paragraph

2. **Check Existing Content**:
   - If block is empty: Generate content directly
   - If block has content: Show dialog with options:
     - **Blend**: Merge new content with existing (AI combines both)
     - **Replace**: Replace existing content entirely

3. **Generate Content**:
   - Use selected idea card (topic + description)
   - Include section heading (if exists)
   - Include existing content (if blending)
   - Include all section paragraphs (if section)

4. **Insert into Editor**:
   - Replace or blend content in the editor
   - Maintain section structure
   - Preserve heading if section

### Generation Prompt

```
Generate content for the following block based on the selected idea.

IDEA:
Topic: [ideaCard.topic]
Description: [ideaCard.description]

BLOCK CONTEXT:
Section Heading: [sectionHeading if exists]
Existing Content: [existingContent if blending]
Section Content: [all paragraphs in section if section]

INSTRUCTIONS:
- Generate content that implements the idea
- Match the style and tone of the document
- If blending: Seamlessly integrate with existing content
- If section: Ensure content works with all paragraphs in section
- Maintain markdown formatting
```

---

## API Endpoints

### POST /api/v1/ai/brainstorm/chat

**Request**:
```typescript
{
  paragraphId: string,
  message: string,
  context: {
    blockContent: string,
    sectionHeading?: string,
    sectionContent?: string,  // All paragraphs in section including subsections
  },
  chatHistory: ChatMessage[],
  existingIdeaCards: IdeaCard[],  // For idea extraction comparison
  model?: 'openai' | 'auto'
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    response: string,           // AI chat response
    extractedIdeas?: IdeaCard[] // New ideas extracted (if any significant ones)
  }
}
```

### POST /api/v1/ai/brainstorm/generate

**Request**:
```typescript
{
  paragraphId: string,
  ideaCard: IdeaCard,
  context: {
    blockContent: string,
    sectionHeading?: string,
    sectionContent?: string,  // All paragraphs in section including subsections
  },
  mode: 'blend' | 'replace',
  model?: 'openai' | 'auto'
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    content: string  // Generated content ready to insert
  }
}
```

---

## Technical Implementation

### Frontend Components

1. **BrainstormTab** (`components/editor/brainstorm-tab.tsx`)
   - Main component for brainstorming interface
   - Manages chat state, idea cards, message input
   - Handles session loading/saving

2. **IdeaCard** (`components/editor/idea-card.tsx`)
   - Expandable card component
   - Shows topic, description, actions (delete, use)

3. **ChatMessage** (`components/editor/chat-message.tsx`)
   - Individual message display
   - Shows user/assistant messages with styling

4. **IdeaExtractionService** (`services/idea-extraction.ts`)
   - Logic for determining if response contains significant ideas
   - Compares against existing cards
   - Calls LLM for extraction

### Backend Services

1. **BrainstormService** (`services/ai/brainstorm-service.ts`)
   - Handles chat message processing
   - Manages idea extraction
   - Generates content from ideas

2. **IdeaExtractionProvider** (`services/ai/idea-extraction-provider.ts`)
   - LLM integration for idea extraction
   - Compares ideas against existing cards

### Data Persistence

- Sessions saved to `document.metadata.brainstormingSessions` after each message
- Loaded when panel opens for a paragraph
- Sessions persist across document versions
- Sessions remain even if paragraph is deleted

---

## Edge Cases

1. **Paragraph Deleted**: Session remains in metadata (can be cleaned up later)
2. **Section Structure Changed**: Session still linked to original paragraphId
3. **Long Chat History**: Truncate context sent to LLM if too long (keep last N messages)
4. **No Ideas Extracted**: Normal - not every response needs a card
5. **Multiple Ideas in One Response**: Extract all significant ones (up to 3)
6. **Idea Card Deleted**: Remove from cards array, keep in message history
7. **Content Generation Fails**: Show error, allow retry

---

## Future Enhancements

1. **Idea Card Relationships**: Link related ideas visually
2. **Idea Merging**: Combine multiple idea cards
3. **Export Ideas**: Export idea cards as markdown or JSON
4. **Idea Templates**: Pre-defined idea templates for common scenarios
5. **Collaborative Brainstorming**: Share sessions with team members
6. **Idea Analytics**: Track which ideas are used most often
7. **Voice Input**: Support voice messages for brainstorming

---

## Success Metrics

- Number of brainstorming sessions created
- Average ideas extracted per session
- Percentage of ideas that result in content generation
- User satisfaction with generated content
- Time spent in brainstorming vs. writing mode

---

## Version History

- **v1.0** (Current): Initial implementation with chat-based brainstorming, idea cards, and content generation



