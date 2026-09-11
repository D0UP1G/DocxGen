import { memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import type { MissingField } from '@/types/document';

interface ValidationAlertProps {
  missingFields: MissingField[];
  warnings: string[];
}

export const ValidationAlert = memo(function ValidationAlert({
  missingFields,
  warnings,
}: ValidationAlertProps) {
  const prefersReduced = useReducedMotion();
  const show = missingFields.length > 0 || warnings.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="validation-alert"
          initial={prefersReduced ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReduced ? {} : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800"
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Проверьте реквизиты
          </div>
          {missingFields.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {missingFields.map((field) => (
                <li key={field.field}>
                  {field.label} — заполните или оставьте понятную отметку
                </li>
              ))}
            </ul>
          )}
          {warnings.map((warning) => (
            <p key={warning} className="mt-1">{warning}</p>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
