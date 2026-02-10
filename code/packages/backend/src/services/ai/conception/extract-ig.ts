import { z } from 'zod';
import type { AIService, AIModel } from '../ai-service.js';

const ExtractIG = z.object({
  nodes: z
    .array(
      z.object({
        label: z.string().min(1),
        state: z.string().min(1),
        confidence: z.number().min(0).max(1),
        facets: z.array(z.string()).optional().default([]),
      })
    )
    .default([]),
  edges: z
    .array(
      z.object({
        srcLabel: z.string().min(1),
        dstLabel: z.string().min(1),
        confidence: z.number().min(0).max(1),
      })
    )
    .default([]),
});

export async function extractConceptionIg(args: {
  service: AIService;
  message: string;
  dr: unknown;
  model?: AIModel;
}): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  const { service, model } = args;
  const message = String(args.message ?? '').trim();
  if (!message) throw new Error('Message is required');

  const system = `You are extracting a compact IdeaGraph update from a user's message during ideation.

Your job is to extract ONLY high-signal items that the user clearly expressed or clearly cares about.

Rules:
- Prefer short gists (2–6 words) for labels. No full sentences.
- Capture core topic(s), key question(s), constraints/assumptions, and explicit goals.
- Do NOT invent details that are not implied by the user's words.
- Do NOT return "junk" meta labels like: "idea", "discussion", "thoughts", "help", "question".

Hard requirement:
- If the latest user message contains any substantive topic (not just "hi/ok/thanks"), you MUST output at least ONE node for the main topic or main question.
  If you're unsure, output exactly 1 node with state="topic" and confidence=0.55 using the clearest gist from the message.

Examples:
- Message: "I want to write about how ideas become tangible assets"
  Nodes: [{label:"ideas → tangible assets", state:"topic", confidence:0.7, facets:[]}]
- Message: "How do we prevent retrieval from breaking consistency?"
  Nodes: [{label:"retrieval vs consistency", state:"question", confidence:0.7, facets:[]}]

Return JSON only with this exact shape:
{
  "nodes": [
    { "label": "...", "state": "topic|question|constraint|assumption|hypothesis|requirement|example", "confidence": 0.0-1.0, "facets": ["..."] }
  ],
  "edges": [
    { "srcLabel": "...", "dstLabel": "...", "confidence": 0.0-1.0 }
  ]
}`;

  const user = `DR (context, may help avoid repeats):
${JSON.stringify(args.dr ?? {}, null, 2)}

LATEST USER MESSAGE:
${message}

Extract IdeaGraph updates. Return ONLY the JSON.`;

  const raw = await service.chatJson({ system, user, temperature: 0.2 }, model);
  const parsed = ExtractIG.parse(raw);
  return { nodes: parsed.nodes, edges: parsed.edges };
}



