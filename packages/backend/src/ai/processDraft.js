import { buildMessages } from './prompt.js';
import { extractJson, AiResultSchema } from './schema.js';
import { checkGrounding, checkDerivedGrounding } from '../validation/grounding.js';
import { AiUnavailableError, AiInvalidResponseError } from '../core/errors.js';

/**
 * Process a draft through the AI pipeline.
 *
 * Flow:
 * 1. Check fault injection → maybe throw
 * 2. Build messages from draft + docType
 * 3. Call AI provider → parse JSON response
 * 4. Validate with Zod schema
 * 5. Grounding check on extract + derived fields
 * 6. Return normalized result with groundedFields list
 *
 * Retry policy: on first JSON parse failure, rebuild messages with stronger instruction.
 * After two failures → AiInvalidResponseError.
 *
 * @param {{ draft: string, docType: object, userFields: object, provider: object, log?: object, faultManager?: object, ownerKey?: string }} params
 * @returns {{ title: string|null, body: string[], aiFields: object, changes: string[], warnings: object[], groundedFields: Array<{key: string, reason: string}> }}
 */
export async function processDraft({ draft, docType, userFields, provider, log, faultManager, ownerKey }) {
  const warnings = [];
  const groundedFields = [];

  // Step 0: Fault injection check
  if (faultManager && ownerKey && faultManager.shouldFault(ownerKey)) {
    // retryable: false — иначе очередь повторит задание и пользователь не увидит ошибку (сценарий 6)
    throw new AiUnavailableError('AI fault injected', { retryable: false });
  }

  // Step 1: Build messages and call AI
  const messages = buildMessages({ draft, docType });

  log?.debug({
    provider: provider.name,
    draftLength: draft.length,
    docType: docType?.id ?? docType,
    promptChars: messages.reduce((sum, m) => sum + m.content.length, 0),
  }, 'запрос к ИИ отправлен');

  let raw;
  const aiStartedAt = Date.now();
  try {
    raw = await provider.complete(messages);
  } catch (err) {
    log?.warn({ provider: provider.name, ms: Date.now() - aiStartedAt, error: err.message }, 'вызов ИИ не удался');
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError(`AI call failed: ${err.message}`);
  }

  log?.debug({ provider: provider.name, ms: Date.now() - aiStartedAt, rawLength: raw.length, raw }, 'ответ ИИ получен');

  // Step 2: Parse JSON (with one retry — rebuild messages with stronger instruction)
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (err) {
    log?.warn({ error: err.message }, 'ai_json_parse_failed, retrying');
    // H6: Rebuild messages with stronger system instruction instead of appending user message
    const retryMessages = [
      { role: 'system', content: messages[0].content + '\n\nВАЖНО: Отвечай ТОЛЬКО валидным JSON-объектом. Никакого текста до или после JSON. Никаких markdown-обёрток.' },
      { role: 'user', content: messages[1].content },
    ];
    try {
      raw = await provider.complete(retryMessages);
      parsed = extractJson(raw);
    } catch (err2) {
      throw new AiInvalidResponseError(`AI returned invalid JSON twice: ${err2.message}`);
    }
  }

  // Step 3: Validate with Zod schema
  let result;
  try {
    result = AiResultSchema.parse(parsed);
  } catch (err) {
    log?.warn({ zodErrors: err.errors }, 'ai_schema_validation_failed');
    throw new AiInvalidResponseError(`AI response failed schema: ${err.message}`);
  }

  // Step 4: Grounding check on extract AND derived fields
  const aiFields = {};
  for (const [key, fieldVal] of Object.entries(result.fields)) {
    const fieldDef = docType.fields.find(f => f.key === key);
    if (!fieldDef) continue; // Unknown key — discard silently

    if (fieldVal === null) {
      aiFields[key] = null;
      continue;
    }

    // Grounding check for "extract" kind fields — strict (quote must be in source)
    if (fieldDef.kind === 'extract' && fieldVal.quote) {
      const check = checkGrounding(fieldVal.value, fieldVal.quote, draft);
      if (!check.ok) {
        log?.debug({ key, reason: check.reason }, 'field_grounding_failed');
        warnings.push({ key, reason: check.reason, severity: 'grounding' });
        groundedFields.push({ key, reason: check.reason });
        aiFields[key] = null;
        continue;
      }
    }

    // H1: Grounding check for "derived" kind fields — relaxed (at least one word from draft)
    if (fieldDef.kind === 'derived' && fieldVal.value) {
      const check = checkDerivedGrounding(fieldVal.value, draft);
      if (!check.ok) {
        log?.debug({ key, reason: check.reason }, 'derived_field_grounding_failed');
        warnings.push({ key, reason: check.reason, severity: 'grounding' });
        groundedFields.push({ key, reason: check.reason });
        aiFields[key] = null;
        continue;
      }
    }

    aiFields[key] = fieldVal;
  }

  log?.debug({
    title: result.title,
    paragraphs: result.body.length,
    fields: Object.fromEntries(Object.entries(aiFields).map(([key, val]) => [key, val?.value ?? null])),
    changes: result.changes,
    warnings: warnings.map((w) => `${w.key}: ${w.reason}`),
  }, 'ответ ИИ разобран и проверен');

  return {
    title: result.title,
    body: result.body,
    aiFields,
    changes: result.changes,
    warnings,
    groundedFields,
  };
}
