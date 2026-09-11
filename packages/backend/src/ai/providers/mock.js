/**
 * Mock AI provider for local testing without an external AI service.
 *
 * Extracts the draft from the user message and the doc type from the system prompt,
 * then returns a deterministic JSON response that satisfies AiResultSchema.
 */
export function createMockProvider() {
  return {
    name: 'mock',

    /**
     * @param {Array<{role: string, content: string}>} messages
     * @returns {Promise<string>} JSON string matching AiResultSchema
     */
    async complete(messages) {
      const lastMsg = messages[messages.length - 1]?.content || '';
      const draftMatch = lastMsg.match(/<draft>([\s\S]*?)<\/draft>/);
      const draft = draftMatch ? draftMatch[1].trim() : lastMsg.trim();

      // Extract doc type name from system prompt «...»
      const systemMsg = messages[0]?.content || '';
      const typeMatch = systemMsg.match(/«(.+?)»/);
      const docTypeName = typeMatch ? typeMatch[1] : 'документ';

      const paragraphs = draft.split('\n').filter(p => p.trim());

      return JSON.stringify({
        title: `О ${docTypeName.toLowerCase()}`,
        body: paragraphs.length > 0 ? paragraphs : ['(пустой черновик)'],
        fields: {},
        changes: ['Текст обработан (мок-режим)'],
      });
    },
  };
}
