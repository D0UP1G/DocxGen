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

      const fields = {};
      const fieldLines = systemMsg.match(/- ([a-zA-Z][\w-]*):/g) || [];
      for (const line of fieldLines) {
        const key = line.slice(2, -1);
        const label = key === 'addressee' ? /(?:кому|адресат)\s*:\s*([^.!?\n]+)/i.exec(draft)?.[1] : null;
        fields[key] = label ? { value: label.trim(), quote: label.trim() } : null;
      }

      return JSON.stringify({
        title: paragraphs[0] ? `О ${paragraphs[0].replace(/[.!?].*$/, '').slice(0, 120).toLowerCase()}` : null,
        body: paragraphs.length > 0 ? paragraphs : ['(пустой черновик)'],
        fields,
        changes: paragraphs.length > 0 ? [] : ['Черновик пуст'],
      });
    },
  };
}
