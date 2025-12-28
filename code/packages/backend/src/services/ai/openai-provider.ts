/**
 * OpenAI Provider
 * Implementation of AIProvider using OpenAI API
 */

import type { AIProvider, AIAnalysisResult, AIModelInfo } from './ai-provider.js';

// Lazy load OpenAI to avoid module loading issues
// Use createRequire for ESM compatibility
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOpenAI(): any {
  try {
    return require('openai');
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenAI package is not installed. Run: pnpm install openai. Error: ${errorMsg}`);
  }
}

export class OpenAIProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    const OpenAI = getOpenAI();
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async analyzeText(text: string, context?: string): Promise<AIAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(text, context);
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing analyst. Analyze text and provide structured feedback in JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      const analysis = JSON.parse(content);
      return {
        quality: Math.max(0, Math.min(100, analysis.quality || 70)),
        sentiment: analysis.sentiment || 'neutral',
        wordiness: Math.max(0, Math.min(100, analysis.wordiness || 50)),
        clarity: Math.max(0, Math.min(100, analysis.clarity || 70)),
        suggestions: analysis.suggestions || [],
      };
    } catch (error) {
      throw new Error('Failed to parse AI analysis response');
    }
  }

  async improveText(text: string, context?: string): Promise<string> {
    const prompt = `Improve the following text while maintaining its meaning and style:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the improved text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Improve text while preserving meaning and style.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async expandText(text: string, context?: string): Promise<string> {
    const prompt = `Expand the following text by adding more detail, examples, or explanation while maintaining the original meaning:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the expanded text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Expand text with relevant details while preserving the core message.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async clarifyText(text: string, context?: string): Promise<string> {
    const prompt = `Clarify the following text to make it more understandable and clear:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the clarified text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Clarify text to improve understanding while keeping the original meaning.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.6,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async condenseText(text: string, context?: string): Promise<string> {
    const prompt = `Condense the following text to be more concise while preserving all key information:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the condensed text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Condense text to reduce wordiness while keeping all essential information.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async adjustTone(text: string, tone: 'formal' | 'casual', context?: string): Promise<string> {
    const toneInstruction = tone === 'formal' 
      ? 'Make the text more formal and professional'
      : 'Make the text more casual and conversational';
    
    const prompt = `${toneInstruction}:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the adjusted text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert writing assistant. Adjust text tone to be more ${tone} while preserving meaning.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async suggestCompletion(text: string, context?: string): Promise<string> {
    const prompt = `Complete the following text in a natural way:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the completion, continuing from where the text ends.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Provide natural text completions that match the style and context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  async brainstormChat(
    message: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    }
  ): Promise<string> {
    const systemPrompt = `You are a creative brainstorming assistant helping a writer develop content ideas for a document block.

Your role is to:
- Engage in natural, conversational brainstorming
- Suggest creative approaches, angles, and ideas
- Ask clarifying questions when needed
- Build on previous conversation context
- Provide thoughtful, actionable suggestions

Be conversational, helpful, and creative.`;

    const contextPrompt = `BLOCK TO BRAINSTORM:
${context.blockContent}

${context.sectionHeading ? `SECTION HEADING: ${context.sectionHeading}\n` : ''}${context.sectionContent ? `SECTION CONTEXT:\n${context.sectionContent}\n` : ''}`;

    // Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Only include context prompt if this is the first message (no chat history)
    if (chatHistory.length === 0) {
      messages.push({ role: 'user', content: contextPrompt });
    }

    // Add chat history (filter out any invalid entries)
    const validHistory = chatHistory
      .filter(msg => msg && msg.role && msg.content && typeof msg.content === 'string')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: String(msg.content).trim(),
      }))
      .filter(msg => msg.content.length > 0);

    messages.push(...validHistory);

    // Add current message
    messages.push({ role: 'user', content: message.trim() });

    // Validate messages before sending
    if (messages.length < 2) {
      throw new Error('Invalid message structure: need at least system and user messages');
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.8,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  async extractIdeas(
    assistantResponse: string,
    existingIdeas: Array<{ topic: string; description: string }>
  ): Promise<Array<{ topic: string; description: string }>> {
    const existingIdeasText = existingIdeas.length > 0
      ? existingIdeas.map((idea, i) => `${i + 1}. Topic: ${idea.topic}\n   Description: ${idea.description}`).join('\n\n')
      : 'None';

    const prompt = `You are analyzing an AI assistant's brainstorming response to extract significant, actionable ideas.

EXISTING IDEA CARDS:
${existingIdeasText}

ASSISTANT RESPONSE:
${assistantResponse}

Extract all significant ideas from the response. An idea is significant if it:
1. Represents a distinct, actionable concept or approach that can be used to generate content
2. ${existingIdeas.length > 0 ? 'Adds new value beyond existing ideas (can be related but should be a distinct angle, theme, or approach)' : 'Is worth capturing as a separate, actionable idea'}
3. Is specific enough to be useful for content generation

IMPORTANT: Even if ideas are related to existing ones, extract them if they represent:
- A different angle or perspective
- A new theme or concept
- A distinct approach or method
- A specific story element, character concept, or narrative direction

For each idea, provide:
- A short topic/title (max 50 chars) - be specific and descriptive
- A brief description (1-2 sentences) - explain what the idea is about

Examples of good ideas:
- "Quantum communication story concept" - A sci-fi story about quantum technology
- "Parallel universe warning theme" - Explore consequences of choices across realities
- "Character-driven narrative approach" - Focus on character development over plot
- "Opening scene with quantum lab" - Specific scene setting with physicist character
- "Alternate reality warning conflict" - Central conflict involving parallel universe messages

Return your response as a JSON object with an "ideas" array:
{
  "ideas": [
    {
      "topic": "short topic",
      "description": "brief description"
    }
  ]
}

Only return an empty array if the response is just a question, acknowledgment, or doesn't contain any extractable concepts.`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert at identifying and extracting significant, distinct ideas from text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    try {
      // Try to parse as JSON object first (in case it's wrapped)
      const parsed = JSON.parse(content);
      // Handle both { ideas: [...] } and [...] formats
      const ideas = Array.isArray(parsed) ? parsed : (parsed.ideas || parsed.ideasArray || []);
      
      if (!Array.isArray(ideas)) {
        return [];
      }

      return ideas
        .filter((idea: { topic?: unknown; description?: unknown }) => idea.topic && idea.description)
        .map((idea: { topic: unknown; description: unknown }) => ({
          topic: String(idea.topic).substring(0, 50),
          description: String(idea.description),
        }));
    } catch {
      // If parsing fails, return empty array
      return [];
    }
  }

  async generateFromIdea(
    idea: { topic: string; description: string },
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace'
  ): Promise<string> {
    const modeInstruction = mode === 'blend'
      ? 'Seamlessly blend the new content with the existing content, maintaining continuity and flow.'
      : 'Replace the existing content entirely with new content based on the idea.';

    const prompt = `Generate content for the following block based on the selected idea.

IDEA:
Topic: ${idea.topic}
Description: ${idea.description}

BLOCK CONTEXT:
${context.sectionHeading ? `Section Heading: ${context.sectionHeading}\n` : ''}${context.sectionContent ? `Section Content:\n${context.sectionContent}\n` : ''}${mode === 'blend' ? `Existing Content:\n${context.blockContent}\n` : ''}

INSTRUCTIONS:
- Generate content that implements the idea
- Match the style and tone of the document
- ${modeInstruction}
- If section: Ensure content works with all paragraphs in section
- Maintain markdown formatting
- Provide only the generated content, no explanations`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Generate high-quality content based on ideas and context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  async researchChat(
    query: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    documentStyle: 'academic' | 'whitepaper' | 'technical-docs' | 'blog' | 'other',
    existingSources: Array<{ id: string; title: string; url?: string }>,
    sourceType?: 'academic' | 'web'
  ): Promise<{
    response: string;
    sources: Array<{
      title: string;
      authors?: string[];
      venue?: string;
      year?: number;
      url?: string;
      summary: string;
      sourceType: 'academic' | 'web';
      relevanceScore: number;
    }>;
  }> {
    const sourceTypeFilter = sourceType || 'all';
    
    const systemPrompt = `You are a research assistant helping find relevant sources for a document.

CRITICAL REQUIREMENTS - NO HALLUCINATION:
- You MUST only suggest REAL, ACTUAL sources that exist
- ALL URLs MUST be real, valid links - NEVER use placeholder URLs like "https://example.com"
- ALL author names MUST be real people - NEVER make up author names
- ALL titles MUST be real publication titles - NEVER invent titles
- If you do not know a real URL for a source, OMIT the URL field entirely - DO NOT make one up
- If you do not know real authors, OMIT the authors field - DO NOT invent author names
- Only suggest sources you are confident are real and verifiable

Your role is to:
- Find and suggest relevant, credible, REAL sources based on the user's query
- Consider the document style and source type filter when suggesting sources
- Provide accurate summaries of sources
- Avoid suggesting sources that are already in the existing sources list
- Be conversational and helpful

Source types:
- Academic/Journal/Conference: Peer-reviewed journals, academic conferences, research papers
- All: Any relevant source type

Current filter: ${sourceTypeFilter === 'academic' ? 'Journal/Conference' : 'All Sources'}`;

    const contextPrompt = `BLOCK TO RESEARCH:
${context.blockContent}

${context.sectionHeading ? `SECTION HEADING: ${context.sectionHeading}\n` : ''}${context.sectionContent ? `SECTION CONTEXT:\n${context.sectionContent}\n` : ''}DOCUMENT STYLE: ${documentStyle}

${existingSources.length > 0 ? `EXISTING SOURCES (do not suggest duplicates):\n${existingSources.map(s => `- ${s.title}${s.url ? ` (${s.url})` : ''}`).join('\n')}\n` : ''}`;

    // Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Only include context prompt if this is the first message (no chat history)
    if (chatHistory.length === 0) {
      messages.push({ role: 'user', content: contextPrompt });
    }

    // Add chat history (filter out any invalid entries)
    const validHistory = chatHistory
      .filter(msg => msg && msg.role && msg.content && typeof msg.content === 'string')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: String(msg.content).trim(),
      }))
      .filter(msg => msg.content.length > 0);

    messages.push(...validHistory);

    // Add current query
    messages.push({ role: 'user', content: query.trim() });

    // Get assistant response
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.7,
    });

    const assistantResponse = response.choices[0]?.message?.content?.trim() || '';

    // Now extract sources from the response
    // For now, we'll use AI to extract and format sources
    // TODO: Replace with actual API calls (Google Scholar, web search, etc.)
    const sourcesPrompt = `Based on the following research query and assistant response, extract and format relevant sources.

QUERY: ${query}
DOCUMENT STYLE: ${documentStyle}
ASSISTANT RESPONSE: ${assistantResponse}

${existingSources.length > 0 ? `EXISTING SOURCES (do not duplicate):\n${existingSources.map(s => `- ${s.title}`).join('\n')}\n` : ''}

CRITICAL: Extract ONLY REAL sources - NO HALLUCINATION:
- ALL sources MUST be real, existing publications
- ALL URLs MUST be valid, working links - NEVER use placeholder URLs
- ALL authors MUST be real people - NEVER invent author names
- If you don't know a real URL, OMIT the url field - DO NOT make one up
- If you don't know real authors, OMIT the authors field - DO NOT invent names

Extract 3-5 relevant, REAL sources. For each source, provide:
- title: Full title (MUST be a real publication title)
- authors: Array of REAL author names (ONLY if you know them - omit if unknown, NEVER invent)
- venue: Journal, conference, website, or publication name (MUST be real)
- year: Publication year (if known)
- url: Source URL (ONLY if you know a REAL, valid URL - NEVER use placeholder URLs. If you don't have a real URL, omit this field entirely)
- summary: 1-2 sentence summary of the source's relevance
- sourceType: "${sourceTypeFilter === 'academic' ? 'academic' : 'web'}" (academic for Journal/Conference, web for other sources)
- relevanceScore: Number 0-100 indicating relevance

CRITICAL: For each source, you MUST find a position in the block content where this citation should be inserted. The position should be the character index (0-based) where the citation should be placed.

RULES FOR FINDING CITATION LOCATION:
1. Analyze the block content carefully to find text that relates to the source's topic, summary, or content
2. Look for sentences or phrases that discuss concepts, findings, or topics mentioned in the source's summary
3. The citation should be placed at the END of the relevant sentence or phrase (after the period, comma, or end of the phrase)
4. If you find multiple relevant locations, choose the MOST RELEVANT one (highest semantic match)
5. If you cannot find a semantically relevant location, place it at the end of the last sentence in the block
6. For citationContext, provide 3-7 words that appear IMMEDIATELY BEFORE where the citation should be inserted
7. The citationContext should be exact words from the block content (case-sensitive match)

BLOCK CONTENT:
${context.blockContent}

Return as JSON object with "sources" array, where each source includes a "citationContext" field:
{
  "sources": [
    {
      "title": "Source Title",
      "authors": ["Author Name"],
      "venue": "Journal/Conference/Website",
      "year": 2024,
      "url": "https://example.com/source",
      "summary": "Brief summary",
      "sourceType": "academic",
      "relevanceScore": 85,
      "citationContext": "probabilities. Physical systems are"
    }
  ]
}

The citationContext MUST be:
- A string containing 3-7 words from the block content that appear immediately before where the citation should be inserted
- Exact words from the block (case-sensitive, including punctuation)
- If the citation should go at the end of a sentence, include the period: e.g., "probabilities."
- If the citation should go after a comma, include the comma: e.g., "wavefunction, a"
- NEVER empty or null

Only include sources that are relevant and credible. If no good sources can be extracted, return {"sources": []}.`;

    const sourcesResponse = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a source extraction assistant. Extract and format research sources from text.' },
        { role: 'user', content: sourcesPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    let sources: Array<{
      title: string;
      authors?: string[];
      venue?: string;
      year?: number;
      url?: string;
      summary: string;
      sourceType: 'academic' | 'web';
      relevanceScore: number;
      citationContext?: string;
    }> = [];

    try {
      const sourcesData = JSON.parse(sourcesResponse.choices[0]?.message?.content || '{}');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'openai-provider.ts:575',message:'LLM response parsed',data:{sourcesCount:sourcesData.sources?.length||0,blockContentLength:context.blockContent.length,blockContentPreview:context.blockContent.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (sourcesData.sources && Array.isArray(sourcesData.sources)) {
        sources = sourcesData.sources
          .filter((source: any) => source.title && source.summary)
          .map((source: any) => {
            // Extract citationContext (3-7 words before citation location)
            const citationContext = source.citationContext ? String(source.citationContext).trim() : undefined;
            
            if (!citationContext) {
              console.warn('Source missing citationContext:', {
                title: source.title?.substring(0, 50),
              });
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'openai-provider.ts:595',message:'Source citationContext extracted',data:{title:source.title?.substring(0,50),citationContext,blockLength:context.blockContent.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            console.log('Extracted source with citationContext:', {
              title: source.title?.substring(0, 50),
              citationContext,
              blockLength: context.blockContent.length,
            });
            
            return {
              title: String(source.title).substring(0, 200),
              authors: source.authors && Array.isArray(source.authors) ? source.authors.map((a: any) => String(a)) : undefined,
              venue: source.venue ? String(source.venue).substring(0, 100) : undefined,
              year: source.year ? Number(source.year) : undefined,
              url: source.url && !source.url.includes('example.com') ? String(source.url) : undefined,
              summary: String(source.summary).substring(0, 500),
              sourceType: (source.sourceType === 'academic' || source.sourceType === 'web')
                ? source.sourceType
                : 'web',
              relevanceScore: source.relevanceScore ? Math.max(0, Math.min(100, Number(source.relevanceScore))) : 50,
              citationContext, // 3-7 words from block content before citation location
            };
          });
      }
    } catch (error) {
      console.error('Failed to parse sources from AI response:', error);
    }

    return {
      response: assistantResponse,
      sources,
    };
  }

  async findCitationPositions(
    blockContent: string,
    sources: Array<{
      id: string;
      title: string;
      authors?: string[];
      summary: string;
    }>
  ): Promise<Array<{
    sourceId: string;
    position: number | null;
    relevantText?: string;
  }>> {
    const prompt = `You are analyzing a text block to find the best positions to insert citations for research sources.

Text block:
${blockContent}

Sources to cite:
${sources.map((s, i) => `${i + 1}. ${s.title}${s.authors ? ` by ${s.authors.join(', ')}` : ''}\n   Summary: ${s.summary}`).join('\n\n')}

For each source, find the most relevant sentence or phrase in the text block where this citation should be inserted. If no relevant text is found for a source, return null for that position.

Return a JSON object with this structure:
{
  "positions": [
    {
      "sourceId": "<source id>",
      "position": <character position in text (0-based), or null if no relevant text>,
      "relevantText": "<the sentence or phrase where citation should be inserted, if position is not null>"
    }
  ]
}

The position should be the character index where the citation should be inserted (typically at the end of the relevant sentence or phrase). If you cannot find relevant text for a source, set position to null.

Provide only valid JSON, no additional text.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing academic and technical writing to find appropriate citation positions. Return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const data = JSON.parse(content);
      
      if (data.positions && Array.isArray(data.positions)) {
        return data.positions.map((p: any) => ({
          sourceId: String(p.sourceId || ''),
          position: p.position !== null && p.position !== undefined ? Number(p.position) : null,
          relevantText: p.relevantText ? String(p.relevantText) : undefined,
        }));
      }

      return sources.map(s => ({ sourceId: s.id, position: null }));
    } catch (error) {
      console.error('Failed to find citation positions:', error);
      // Return null positions for all sources on error
      return sources.map(s => ({ sourceId: s.id, position: null }));
    }
  }

  getModelInfo(): AIModelInfo {
    return {
      id: this.model,
      name: `OpenAI ${this.model}`,
      provider: 'openai',
      maxTokens: 16384, // Approximate for gpt-4o-mini
      supportsStreaming: true,
    };
  }

  private buildAnalysisPrompt(text: string, context?: string): string {
    return `Analyze the following text and provide a JSON response with this structure:
{
  "quality": <number 0-100, overall writing quality>,
  "sentiment": <"positive" | "neutral" | "negative">,
  "wordiness": <number 0-100, where 100 is very wordy>,
  "clarity": <number 0-100, where 100 is very clear>,
  "suggestions": [
    {
      "type": <"error" | "warning" | "suggestion">,
      "text": <exact text with issue>,
      "message": <description of issue>,
      "replacement": <suggested replacement, optional>
    }
  ]
}

Text to analyze:
${text}

${context ? `Context: ${context}\n\n` : ''}Provide only valid JSON, no additional text.`;
  }
}

