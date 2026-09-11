import { memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface ErrorBarProps {
  error: string;
  isVisible: boolean;
}

export const ErrorBar = memo(function ErrorBar({ error, isVisible }: ErrorBarProps) {
  const prefersReduced = useReducedMotion();
  const show = isVisible && !!error;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="error-bar"
          initial={prefersReduced ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReduced ? {} : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
