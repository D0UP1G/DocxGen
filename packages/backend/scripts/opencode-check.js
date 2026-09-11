// Быстрая проверка, что ИИ-провайдер из .env отвечает: один короткий запрос, время ответа и текст.
import { env } from '../src/config/env.js';
import { createAiProvider } from '../src/ai/provider.js';

const provider = createAiProvider(env);
const started = Date.now();
console.log(`Провайдер: ${provider.name}. Жду ответ…`);
try {
  const answer = await provider.complete([
    { role: 'system', content: 'Ответь только JSON-объектом.' },
    { role: 'user', content: 'Верни {"ok": true, "text": "<исправь: превет мир>"}' },
  ]);
  console.log(`Ответ за ${Date.now() - started} мс:\n${answer}`);
} catch (err) {
  console.error(`Ошибка за ${Date.now() - started} мс: ${err.message}`);
  process.exitCode = 1;
}
