import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, FileText } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: 1 | 2;
}

const steps = [
  { num: 1 as const, label: 'Черновик', icon: FileText },
  { num: 2 as const, label: 'Результат', icon: CheckCircle2 },
];

export const StepIndicator = memo(function StepIndicator({ currentStep }: StepIndicatorProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex items-center justify-center gap-4 text-sm">
      {steps.map((step, i) => {
        const active = currentStep === step.num;
        const done = currentStep > step.num;
        return (
          <div key={step.num} className="flex items-center gap-2">
            <motion.div
              animate={
                prefersReduced
                  ? {}
                  : active
                    ? { scale: [1, 1.2, 1] }
                    : { scale: 1 }
              }
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : done
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-muted-foreground/30 text-muted-foreground'
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : step.num}
            </motion.div>
            <span className={active ? 'font-medium' : 'text-muted-foreground'}>{step.label}</span>
            {i < steps.length - 1 && <span className="mx-1 text-muted-foreground/40">→</span>}
          </div>
        );
      })}
    </div>
  );
});
