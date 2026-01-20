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
    const systemPrompt = `You are a creative brainstorming assistant helping a writer develop content ideas for a specific document block.

Your job is not just to list ideas — you must help the user decide.

Rules:
- Always keep the response anchored to the provided block/section context.
- When you propose multiple ideas/options, explicitly compare them:
  - How they differ
  - When/why to use each
  - What outcome each produces (tone, structure, depth, focus)
- If the user asks for "summarize"/"summarization", propose 3–5 distinct summarization approaches and explain the tradeoffs.
- Prefer actionable, card-worthy ideas (clear title + 1–2 sentence description), but still respond conversationally.
- Ask 1 clarifying question only if it materially changes the direction; otherwise make reasonable assumptions.

Output style:
- Start with a 1–2 sentence overview of what you’re going to do.
- Then present options as a short list, each with “Why use it” (and what it emphasizes).
- End with a quick recommendation (“If you want X, pick option Y.”).`;

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
      ? `CRITICAL: Seamlessly blend the new content based on the idea with the existing content below. You must include BOTH the existing content AND the new content, integrated smoothly. Return the COMPLETE blended result, not just the new content.`
      : 'Replace the existing content entirely with new content based on the idea. Return only the new content.';

    const prompt = `Generate content for the following block based on the selected idea.

IDEA:
Topic: ${idea.topic}
Description: ${idea.description}

BLOCK CONTEXT:
${context.sectionHeading ? `Section Heading: ${context.sectionHeading}\n` : ''}${context.sectionContent ? `Section Content:\n${context.sectionContent}\n` : ''}${mode === 'blend' ? `EXISTING CONTENT (must be preserved and blended with new content):\n${context.blockContent}\n` : ''}

INSTRUCTIONS:
- Generate content that implements the idea
- Match the style and tone of the document
- ${modeInstruction}
- If section: Ensure content works with all paragraphs in section
- Maintain markdown formatting
- Provide only the ${mode === 'blend' ? 'complete blended content' : 'generated content'}, no explanations`;

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

  async transformDraft(
    draftText: string,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace' = 'replace'
  ): Promise<string> {
    const modeInstruction = mode === 'blend'
      ? `CRITICAL: Blend the transformed draft content with the existing content below. You must include BOTH the existing content AND the transformed draft content, integrated smoothly. Return the COMPLETE blended result, not just the transformed draft.`
      : 'Transform the draft text into polished, professional content. Replace the existing content entirely if present.';

    const prompt = `Transform the following draft text into polished, well-written content suitable for a document.

DRAFT TEXT TO TRANSFORM:
${draftText}

BLOCK CONTEXT:
${context.sectionHeading ? `Section Heading: ${context.sectionHeading}\n` : ''}${context.sectionContent ? `Section Content:\n${context.sectionContent}\n` : ''}${mode === 'blend' && context.blockContent.trim() ? `EXISTING CONTENT (must be preserved and blended with transformed draft):\n${context.blockContent}\n` : context.blockContent.trim() ? `Existing Block Content:\n${context.blockContent}\n` : ''}

INSTRUCTIONS:
- Transform the draft text into polished, professional content
- Improve grammar, clarity, and flow
- Maintain the core meaning and ideas from the draft
- Match the style and tone appropriate for the document context
- Ensure proper formatting and structure
- Remove any obvious errors, typos, or inconsistencies
- Make it ready for publication
- Preserve important details and information from the draft
- Use markdown formatting where appropriate
- ${modeInstruction}
- Provide only the ${mode === 'blend' ? 'complete blended content' : 'transformed content'}, no explanations or meta-commentary`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing editor. Transform rough draft text into polished, publication-ready content while preserving the original meaning and ideas.',
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

  async generateFromPrompt(
    prompt: string,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace' | 'extend'
  ): Promise<string> {
    const systemPrompt = `You are an expert writing assistant.

Return ONLY the generated content. Do not include explanations.

Preserve Markdown formatting and, when relevant, Zadoox extended Markdown patterns (citations like [@smith2024], cross-refs like @fig:diagram, labels like {#fig:... label="Figure {REF}.1"}).`;

    const modeInstruction =
      mode === 'blend'
        ? 'Blend your new content with the existing block content and return the COMPLETE blended result.'
        : mode === 'extend'
          ? 'Extend the existing block content by appending new relevant content. Return ONLY the newly added content (not the original).'
          : 'Replace the existing block content entirely. Return ONLY the new content.';

    const userPrompt = `REQUEST:
${prompt}

INSTRUCTIONS:
${modeInstruction}

CURRENT BLOCK:
${context.blockContent}

${context.sectionHeading ? `SECTION HEADING: ${context.sectionHeading}\n` : ''}${context.sectionContent ? `SECTION CONTEXT:\n${context.sectionContent}\n` : ''}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  async generateInlineEditPlan(
    prompt: string,
    params: {
      mode: 'update' | 'insert';
      blocks: Array<{
        id: string;
        text: string;
        kind?: 'heading' | 'paragraph' | 'list' | 'code' | 'blank' | 'other';
        start: number;
        end: number;
      }>;
      cursorBlockId?: string;
    }
  ): Promise<string> {
    const systemPrompt = `You are an inline editor for a Markdown document.

Return a JSON object with ONLY an "operations" array (no other keys).

Each operation MUST be one of:
- {"type":"replace_range","startBlockId":"...","endBlockId":"...","content":"..."}
- {"type":"insert_before","anchorBlockId":"...","content":"..."}
- {"type":"insert_after","anchorBlockId":"...","content":"..."}

Rules:
- Use only block IDs provided.
- Keep edits minimal and scoped to the relevant blocks.
- Content must be valid Markdown (and may include Zadoox extended Markdown).`;

    const userPrompt = `USER REQUEST:
${prompt}

MODE: ${params.mode}
CURSOR_BLOCK_ID: ${params.cursorBlockId || ''}

BLOCKS (JSON):
${JSON.stringify(params.blocks, null, 2)}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    return response.choices[0]?.message?.content?.trim() || '{"operations":[]}';
  }

  async generateComponentEditPlan(
    prompt: string,
    params: {
      kind: string;
      context?: unknown;
    }
  ): Promise<string> {
    const systemPrompt = `You are a component editor for Zadoox.

Return ONLY a single JSON object (no markdown, no prose).

You must return exactly one of:

1) Clarification (when the request cannot be represented with the provided capabilities):
{"type":"clarify","question":"...","suggestions":["..."]}

2) Update (when you can apply a valid change):
{"type":"update","updatedXmd":"<updated component XMD>","summary":"<what changed>","confirmationQuestion":"Apply these changes?"}

Rules (generic):
- Only edit the provided component source.
- Only change fields/values that are allowed by CAPABILITIES_JSON.
- Respect any constraints in CAPABILITIES_JSON (e.g. allowRemove/allowAdd/allowReorder).
- Preserve stable identifiers/labels if present (e.g. "#fig:...") unless explicitly asked to change/remove them.
- Do NOT change media URLs/src unless CAPABILITIES_JSON explicitly allows it.
- Keep the component syntactically valid in XMD.
- If you return type="clarify", your suggestions MUST be derived from CAPABILITIES_JSON (only offer supported changes).

Output requirements:
- updatedXmd must be ONLY the updated component source (no extra text).
- If CAPABILITIES_JSON.output is present, updatedXmd MUST conform to it (it defines the required output shape/constraints).
- If you cannot produce an updatedXmd that conforms to CAPABILITIES_JSON, return type="clarify" instead.
- summary must be a user-friendly, specific description of what you changed.`;

    const userPrompt = `COMPONENT_KIND: ${params.kind}

USER_REQUEST:
${prompt}

CONTEXT_JSON:
${JSON.stringify(params.context ?? {}, null, 2)}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    return (
      response.choices[0]?.message?.content?.trim() ||
      '{"type":"clarify","question":"What should I change?","suggestions":[]}'
    );
  }

  async generateImage(
    prompt: string,
    options?: {
      size?: '256x256' | '512x512' | '1024x1024';
    }
  ): Promise<{ b64: string; mimeType: string }> {
    const size = options?.size || '512x512';

    // OpenAI Images API.
    // Some deployments/models reject `response_format` (e.g. "Unknown parameter: 'response_format'"),
    // so we attempt base64 first, then fall back gracefully.
    const makeRequest = async (includeResponseFormat: boolean) => {
      return this.client.images.generate({
        // Keep in sync with our API/UI which supports 256/512/1024 sizes.
        model: 'dall-e-2',
        prompt,
        size,
        ...(includeResponseFormat ? { response_format: 'b64_json' as const } : {}),
      });
    };

    let response: Awaited<ReturnType<typeof makeRequest>>;
    try {
      response = await makeRequest(true);
    } catch (err: unknown) {
      const anyErr = err as { message?: string; param?: string; code?: string };
      const isResponseFormatError =
        anyErr?.param === 'response_format' ||
        anyErr?.code === 'unknown_parameter' ||
        (typeof anyErr?.message === 'string' && anyErr.message.includes("response_format"));
      if (!isResponseFormatError) throw err;
      response = await makeRequest(false);
    }

    const first = response.data?.[0] as { b64_json?: string; url?: string } | undefined;
    if (first?.b64_json) {
      return { b64: first.b64_json, mimeType: 'image/png' };
    }

    // Fallback: if the API returns a URL, fetch and convert to base64.
    if (first?.url) {
      const res = await fetch(first.url);
      if (!res.ok) {
        throw new Error(`Failed to fetch generated image (${res.status})`);
      }
      const mimeType = res.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await res.arrayBuffer());
      return { b64: buf.toString('base64'), mimeType };
    }

    throw new Error('No image returned from OpenAI');
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

  async embedTexts(texts: string[]): Promise<number[][]> {
    const input = Array.isArray(texts) ? texts.map((t) => String(t ?? '')) : [];
    if (input.length === 0) return [];

    // Use a small, cheap embedding model. Can be overridden later via env if needed.
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input,
    });

    const data = (response?.data ?? []) as Array<{ embedding?: number[] }>;
    return data.map((d) => (Array.isArray(d.embedding) ? d.embedding : []));
  }

  async chatJson(params: { system: string; user: string; temperature?: number }): Promise<unknown> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      response_format: { type: 'json_object' },
      temperature: typeof params.temperature === 'number' ? params.temperature : 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');
    try {
      return JSON.parse(content);
    } catch {
      throw new Error('Failed to parse AI JSON response');
    }
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

