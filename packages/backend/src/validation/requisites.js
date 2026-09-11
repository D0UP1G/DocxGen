/**
 * Merges sources of field values in priority order:
 * user answer > AI-verified value > auto value > template value.
 *
 * @param {Object} params
 * @param {Object} params.docType - Document type config from catalog
 * @param {Object} params.template - Template config from catalog
 * @param {Object} params.aiFields - AI-extracted fields: { key: { value, quote } | null }
 * @param {string|null} params.title - AI-derived title
 * @param {Object} params.userFields - User-provided fields: { key: "value" | null }
 * @param {string} params.today - Today's date string (YYYY-MM-DD)
 * @returns {{
 *   values: Record<string, { value: string|null, label: string, source: string }>,
 *   pending: Array<{ key: string, label: string, question: string, example: string }>,
 *   placeholders: string[]
 * }}
 */
export function mergeRequisites({ docType, template, aiFields, title, userFields, today }) {
  const values = {};
  const pending = [];
  const placeholders = [];

  for (const field of docType.fields) {
    const userVal = userFields[field.key];
    const aiVal = aiFields?.[field.key];

    let value = null;
    let source = null;

    // Priority 1: User explicitly provided a value
    if (userVal !== undefined && userVal !== null) {
      value = userVal;
      source = 'user';
    }
    // Priority 2: User explicitly set to null (leave empty)
    else if (userVal === null) {
      value = null;
      source = 'user_skip';
    }
    // Priority 3: AI-verified value
    else if (aiVal && aiVal.value) {
      value = aiVal.value;
      source = 'ai';
    }
    // Priority 4: Auto value (date)
    else if (field.kind === 'auto' && field.key === 'date' && template.autoFill?.date) {
      value = formatDate(today, template.dateFormat);
      source = 'auto';
    }
    // Priority 5: Template value (organization info)
    else if (field.kind === 'template') {
      value = template.organization?.[field.key] ?? null;
      source = 'template';
    }

    // Handle title specially — userFields.title first, then AI title
    if (field.key === 'title' && value === null) {
      if (userFields.title !== undefined && userFields.title !== null) {
        value = userFields.title;
        source = 'user';
      } else if (title) {
        value = title;
        source = 'ai';
      }
    }

    values[field.key] = {
      value,
      label: field.label,
      source: source || 'none',
    };

    // Determine if field needs to be asked
    const isRegistry = field.kind === 'registry';
    const isSkipped = userVal === null;
    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';

    if (isRegistry) {
      // Registry fields never go to pending — always show as placeholder
      placeholders.push(field.label);
    } else if (!hasValue && !isSkipped && field.required) {
      // Required field without value and not skipped → ask user
      pending.push({
        key: field.key,
        label: field.label,
        question: field.question || `Укажите: ${field.label}`,
        example: field.example || '',
      });
    } else if (!hasValue && !field.required) {
      // Optional field without value → placeholder
      placeholders.push(field.label);
    }
  }

  return { values, pending, placeholders };
}

/**
 * Format date according to template format.
 * @param {string} isoDate - ISO date string (YYYY-MM-DD)
 * @param {string} format - Template date format (e.g., "DD.MM.YYYY")
 * @returns {string}
 */
function formatDate(isoDate, format) {
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());

  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', year)
    .replace('YY', year.slice(-2));
}
