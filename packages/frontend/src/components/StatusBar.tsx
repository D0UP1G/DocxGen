import { memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface StatusBarProps {
  status: string;
  isVisible: boolean;
}

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
          className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 flex items-center gap-2"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {status}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
