import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DOCUMENT_TYPES } from '@/lib/constants';
import type { DocumentTypeId, TemplateId } from '@/types/document';

interface DraftSectionProps {
  text: string;
  documentType: DocumentTypeId;
  templateId: TemplateId;
  typeDescription: string;
  onTextChange: (value: string) => void;
  onTypeChange: (value: DocumentTypeId) => void;
  onTemplateChange: (value: TemplateId) => void;
  disabled: boolean;
}

export const DraftSection = memo(function DraftSection({
  text,
  documentType,
  templateId,
  typeDescription,
  onTextChange,
  onTypeChange,
  onTemplateChange,
  disabled,
}: DraftSectionProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      layout
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReduced ? {} : { opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="space-y-4"
    >
      <Textarea
        placeholder="Введите или вставьте черновик…"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={8}
        className="resize-y"
        disabled={disabled}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm font-medium">
          Тип документа
          <Select value={documentType} onValueChange={(v) => onTypeChange(v as DocumentTypeId)}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="mt-1 block text-xs text-gray-500">{typeDescription}</span>
        </label>

        <label className="text-sm font-medium">
          Шаблон оформления
          <Select value={templateId} onValueChange={(v) => onTemplateChange(v as TemplateId)}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="official">Классический корпоративный</SelectItem>
              <SelectItem value="standard">Современный регламентный</SelectItem>
            </SelectContent>
          </Select>
          <span className="mt-1 block text-xs text-gray-500">
            Тип отвечает за структуру, шаблон — за оформление.
          </span>
        </label>
      </div>
    </motion.div>
  );
});
