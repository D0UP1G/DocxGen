import { Fragment, memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: 1 | 2;
  className?: string;
}

const steps = [
  { num: 1 as const, label: 'Черновик' },
  { num: 2 as const, label: 'Результат' },
];

/**
 * Рельс вместо кружков: номер антиквой, подпись капителью, между шагами —
 * волосяная линия во всю оставшуюся ширину. Пройденный шаг не закрашивается,
 * а гаснет до чернильного: закрашен всегда ровно один — текущий.
 */
export const StepIndicator = memo(function StepIndicator({ currentStep, className }: StepIndicatorProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div className={cn('flex items-center gap-5', className)}>
      {steps.map((step, i) => {
        const active = currentStep === step.num;
        const done = currentStep > step.num;
        return (
          <Fragment key={step.num}>
            {i > 0 && <span className="h-px flex-grow bg-border" aria-hidden="true" />}
            <motion.span
              animate={prefersReduced ? {} : { scale: active ? [0.94, 1] : 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={cn(
                'font-display text-2xl font-semibold leading-none transition-colors',
                active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground/50',
              )}
            >
              {String(step.num).padStart(2, '0')}
            </motion.span>
            <span
              className={cn(
                'text-[13px] uppercase tracking-[0.1em] transition-colors',
                active ? 'font-semibold text-foreground' : done ? 'text-muted-foreground' : 'text-muted-foreground/70',
              )}
            >
              {step.label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
});
