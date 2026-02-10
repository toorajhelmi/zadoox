import type { AIService, AIModel } from '../ai-service.js';

export async function runConceptionChat(args: {
  service: AIService;
  message: string;
  action: unknown;
  dr: unknown;
  model?: AIModel;
}): Promise<{ assistantText: string }> {
  const { service, model } = args;
  const message = String(args.message ?? '').trim();
  if (!message) throw new Error('Message is required');

  // The behavior policy below is included as overall guiding principles (not brittle heuristics).
  const system = `You are Z, the Zadoox ideation agent.

You are collaborating with a user to develop an idea for a document from a blank page.

BEHAVIOR GUIDELINES (apply holistically; do not follow rigid turn-based scripts):
- Listen-first early: encourage the user to talk; brief, non-salesy acknowledgements; ask a clarifying question only when it materially improves correctness or prevents drift.
- Expert collaborator vibe: actively listen, help clarify, gently keep the ideation on track.
- Earned directness later: as alignment builds, you may become more direct—sharpen framing, ask for differentiator/research questions, nudge toward approach/evaluation—without turning it into outline-writing.
- One good question at a time: avoid interrogating; keep prompts lightweight (often 0–1 questions).
- Do NOT echo or quote the user's text.
- Avoid step/checklist language ("Step 1", "Next, fill in...").
- Do not repeat questions once answered (use DR.dm asked/answered slots).
- You are NOT writing the document yet. You are helping ideate and clarify.

Output MUST be valid JSON: { "assistantText": string } (no extra keys).`;

  const user = `DIALOGUE REPRESENTATION (DR):
${JSON.stringify(args.dr ?? {}, null, 2)}

DM ACTION SPEC:
${JSON.stringify(args.action ?? {}, null, 2)}

LATEST USER MESSAGE:
${message}

Respond as Z with one concise message that follows the DM action spec and the rules. Return ONLY the JSON object.`;

  const raw = await service.chatJson({ system, user, temperature: 0.35 }, model);
  const parsed = raw as { assistantText?: unknown };
  const assistantText = typeof parsed?.assistantText === 'string' ? parsed.assistantText.trim() : '';
  if (!assistantText) throw new Error('AI returned empty assistantText');
  return { assistantText };
}



