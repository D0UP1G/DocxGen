import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActionButtonProps {
  step: 1 | 2;
  processing: boolean;
  generating: boolean;
  onClick: () => void;
  disabled: boolean;
}

export const ActionButton = memo(function ActionButton({
  step,
  processing,
  generating,
  onClick,
  disabled,
}: ActionButtonProps) {
  const prefersReduced = useReducedMotion();
  const isStep1 = step === 1;

  return (
    <motion.div
      whileTap={prefersReduced || disabled ? {} : { scale: 0.99 }}
      transition={{ duration: 0.1, ease: 'easeInOut' }}
    >
      <Button onClick={onClick} disabled={disabled} className="w-full sm:w-auto sm:min-w-[280px]">
        {isStep1 ? (
          processing ? (
            <>
              <Loader2 className="mr-2.5 h-[15px] w-[15px] animate-spin" strokeWidth={2} />
              Обработка…
            </>
          ) : (
            '1. Обработать черновик'
          )
        ) : generating ? (
          <>
            <Loader2 className="mr-2.5 h-[15px] w-[15px] animate-spin" strokeWidth={2} />
            Формирование…
          </>
        ) : (
          <>
            <Download className="mr-2.5 h-[15px] w-[15px]" strokeWidth={2} />
            2. Сформировать и скачать DOCX
          </>
        )}
      </Button>
    </motion.div>
  );
});
