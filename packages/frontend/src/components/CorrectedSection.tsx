import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
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
      className="space-y-2 rounded-lg border p-4"
    >
      <div className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Исправленный текст — его можно отредактировать
      </div>
      <Textarea
        value={correctedText}
        onChange={(e) => onTextChange(e.target.value)}
        rows={10}
        className="resize-y"
        disabled={disabled}
      />
      <RequisitesForm
        fields={visibleFields}
        requisites={requisites}
        visibleFields={visibleFields}
        onChange={onRequisiteChange}
        disabled={disabled}
      />
    </motion.div>
  );
});
