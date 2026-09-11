import * as crypto from 'crypto';

const OPENCODE_API_URL = 'https://opencode.ai/zen/v1/chat/completions';

function generateId(prefix: string): string {
  return prefix + crypto.randomBytes(12).toString('hex');
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'x-opencode-client': 'opencode',
    'x-opencode-session': generateId('ses_'),
    'x-opencode-request': generateId('req_'),
    'User-Agent': 'opencode/1.18.15',
  };
}

const SYSTEM_PROMPT = `You are a document generator. Convert the user's content into valid Typst markup.
Output ONLY the Typst markup, nothing else — no markdown fences, no explanations.
Use proper Typst syntax: = for headings, - for unordered lists, + for ordered lists, $ for math, # for functions.
Structure the document with a title, sections, and proper formatting.
Make it look professional and well-organized.`;

export async function generateTypstFromText(userText: string): Promise<string> {
  const response = await fetch(OPENCODE_API_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: 'big-pickle',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  // Parse SSE stream
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) result += content;
        } catch {}
      }
    }
  }

  return result;
}
