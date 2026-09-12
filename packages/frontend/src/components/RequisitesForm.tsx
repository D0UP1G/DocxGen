import { memo } from 'react';
import { FIELD_LABELS, FIELD_ORDER } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Requisites } from '@/types/document';

interface RequisitesFormProps {
  fields: string[];
  requisites: Requisites;
  visibleFields: string[];
  onChange: (field: string, value: string) => void;
  disabled: boolean;
}

/**
 * Поля на подчёркиваниях: реквизиты читаются как строчки документа, а не как
 * анкета из коробок. Пустое поле подчёркнуто охрой — тем же цветом, каким
 * пометка потом выделяется в DOCX.
 */
export const RequisitesForm = memo(function RequisitesForm({
  fields,
  requisites,
  onChange,
  disabled,
}: RequisitesFormProps) {
  const orderedFields = FIELD_ORDER.filter((f) => fields.includes(f));

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-2 md:grid-cols-2">
      {orderedFields.map((field) => {
        const empty = !requisites[field];
        return (
          <label key={field} className="block pt-3.5">
            <span className="block text-sm text-muted-foreground">{FIELD_LABELS[field]}</span>
            <input
              value={requisites[field] || ''}
              onChange={(e) => onChange(field, e.target.value)}
              placeholder={`[${FIELD_LABELS[field]}]`}
              disabled={disabled}
              className={cn(
                'w-full border-0 border-b bg-transparent px-0 py-2 text-base text-foreground transition-colors',
                'placeholder:text-muted-foreground/60 focus:outline-none focus-visible:border-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                empty ? 'border-warning' : 'border-border',
              )}
            />
          </label>
        );
      })}
    </div>
  );
});
