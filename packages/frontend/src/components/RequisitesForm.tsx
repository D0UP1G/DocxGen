import { memo } from 'react';
import { FIELD_LABELS, FIELD_ORDER } from '@/lib/constants';
import type { Requisites } from '@/types/document';

interface RequisitesFormProps {
  fields: string[];
  requisites: Requisites;
  visibleFields: string[];
  onChange: (field: string, value: string) => void;
  disabled: boolean;
}

export const RequisitesForm = memo(function RequisitesForm({
  fields,
  requisites,
  onChange,
  disabled,
}: RequisitesFormProps) {
  const orderedFields = FIELD_ORDER.filter((f) => fields.includes(f));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {orderedFields.map((field) => (
        <label key={field} className="text-sm">
          {FIELD_LABELS[field]}
          <input
            value={requisites[field] || ''}
            onChange={(e) => onChange(field, e.target.value)}
            placeholder={`[${FIELD_LABELS[field]}]`}
            disabled={disabled}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </label>
      ))}
    </div>
  );
});
