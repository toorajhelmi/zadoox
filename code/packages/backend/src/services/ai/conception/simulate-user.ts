import type { AIService, AIModel } from '../ai-service.js';

export async function simulateConceptionUserMessage(args: {
  service: AIService;
  dr: unknown;
  model?: AIModel;
}): Promise<{ message: string }> {
  const { service, model } = args;

  const system = `You are simulating the USER in an ideation chat with an assistant named Z.

Goal: produce ONE realistic next user message that continues the conversation naturally.

Rules:
- Do NOT mention that you are simulated.
- Keep it 1–3 sentences.
- If Z asked a direct question most recently, answer it.
- Otherwise, add one concrete detail or preference that advances the ideation.
- Do not derail into a new unrelated topic.
- No meta-commentary about prompts, LLMs, or the system.

Return ONLY JSON: { "message": string }`;

  const user = `DIALOGUE REPRESENTATION (DR):
${JSON.stringify(args.dr ?? {}, null, 2)}

Generate the next user message as JSON only.`;

  const raw = await service.chatJson({ system, user, temperature: 0.6 }, model);
  const parsed = raw as { message?: unknown };
  const message = typeof parsed?.message === 'string' ? parsed.message.trim() : '';
  if (!message) throw new Error('AI returned empty simulated user message');
  return { message };
}



