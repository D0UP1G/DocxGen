import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RequisitesForm } from './RequisitesForm';
import type { Requisites } from '@/types/document';

interface CorrectedSectionProps {
  correctedText: string;
  requisites: Requisites;
  visibleFields: string[];
  onTextChange: (value: string) => void;
  onRequisiteChange: (field: string, value: string) => void;
  disabled: boolean;
}

export const CorrectedSection = memo(function CorrectedSection({
  correctedText,
  requisites,
  visibleFields,
  onTextChange,
  onRequisiteChange,
  disabled,
}: CorrectedSectionProps) {
  const prefersReduced = useReducedMotion();

  if (!correctedText) return null;

  return (
    <motion.div
      layout
      initial={prefersReduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReduced ? {} : { opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="space-y-9"
    >
      <Card className="px-8 py-7">
        <div className="flex items-baseline justify-between gap-4">
          <span className="label-caps">Исправленный текст</span>
          <span className="text-[13px] text-muted-foreground">правится прямо здесь</span>
        </div>
        <Textarea
          variant="bare"
          value={correctedText}
          onChange={(e) => onTextChange(e.target.value)}
          rows={10}
          className="mt-3.5 resize-y"
          disabled={disabled}
        />
      </Card>

      <div>
        <span className="label-caps">Реквизиты</span>
        <div className="mt-1.5">
          <RequisitesForm
            fields={visibleFields}
            requisites={requisites}
            visibleFields={visibleFields}
            onChange={onRequisiteChange}
            disabled={disabled}
          />
        </div>
      </div>
    </motion.div>
  );
});
