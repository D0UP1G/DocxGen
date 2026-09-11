import { buildMessages } from './prompt.js';
import { extractJson, AiResultSchema } from './schema.js';
import { checkGrounding } from '../validation/grounding.js';
import { AiUnavailableError, AiInvalidResponseError } from '../core/errors.js';

/**
 * Process a draft through the AI pipeline.
 *
 * Flow:
 * 1. Check fault injection → maybe throw
 * 2. Build messages from draft + docType
 * 3. Call AI provider → parse JSON response
 * 4. Validate with Zod schema
 * 5. Grounding check on extract fields (quote must be in source)
 * 6. Return normalized result
 *
 * Retry policy: on first JSON parse failure, retry once with explicit instruction.
 * After two failures → AiInvalidResponseError.
 *
 * @param {{ draft: string, docType: object, userFields: object, provider: object, log?: object, faultManager?: object, ownerKey?: string }} params
 * @returns {{ title: string|null, body: string[], aiFields: object, changes: string[], warnings: object[] }}
 */
export async function processDraft({ draft, docType, userFields, provider, log, faultManager, ownerKey }) {
  const warnings = [];

  // Step 0: Fault injection check
  if (faultManager && ownerKey && faultManager.shouldFault(ownerKey)) {
    throw new AiUnavailableError('AI fault injected');
  }

  // Step 1: Build messages and call AI
  const messages = buildMessages({ draft, docType, userFields });

  let raw;
  try {
    raw = await provider.complete(messages);
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError(`AI call failed: ${err.message}`);
  }

  log?.debug({ rawLength: raw.length }, 'ai_raw');

  // Step 2: Parse JSON (with one retry on failure)
  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (err) {
    log?.warn({ error: err.message }, 'ai_json_parse_failed, retrying');
    const retryMessages = [
      ...messages,
      { role: 'user', content: 'Исправь предыдущий ответ. Верни только один валидный JSON-объект по схеме из system-сообщения: без markdown, комментариев и лишних ключей. Для неизвестных реквизитов используй null, факты не выдумывай.' },
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

  // Step 4: Grounding check on extract fields
  const aiFields = {};
  for (const [key, fieldVal] of Object.entries(result.fields)) {
    const fieldDef = docType.fields.find(f => f.key === key);
    if (!fieldDef) continue; // Unknown key — discard silently

    if (fieldVal === null) {
      aiFields[key] = null;
      continue;
    }

    // Grounding check: only for "extract" kind fields that have a quote
    if (fieldDef.kind === 'extract' && fieldVal.quote) {
      const check = checkGrounding(fieldVal.value, fieldVal.quote, draft);
      if (!check.ok) {
        log?.debug({ key, reason: check.reason }, 'field_grounding_failed');
        warnings.push({ key, reason: check.reason, severity: 'grounding' });
        aiFields[key] = null;
        continue;
      }
    }

    aiFields[key] = fieldVal;
  }

  return {
    title: result.title,
    body: result.body,
    aiFields,
    changes: result.changes,
    warnings,
  };
}
