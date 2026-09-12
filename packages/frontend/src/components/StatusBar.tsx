import { memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface StatusBarProps {
  status: string;
  isVisible: boolean;
}

/**
 * Ход работы — полоса между двумя волосяными линиями, а не плашка: ожидание
 * здесь долгое, и цветной прямоугольник на полэкрана вымораживает сильнее,
 * чем сама пауза.
 */
export const StatusBar = memo(function StatusBar({ status, isVisible }: StatusBarProps) {
  const prefersReduced = useReducedMotion();
  const show = isVisible && !!status;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="status-bar"
          initial={prefersReduced ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReduced ? {} : { opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex items-center gap-3 border-y border-border py-6"
        >
          <Loader2 className="h-[17px] w-[17px] animate-spin text-primary" strokeWidth={1.5} />
          <span className="text-base font-medium">{status}</span>
          <span className="ml-auto text-[13px] text-muted-foreground">обычно 25—90 секунд</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
