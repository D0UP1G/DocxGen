import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DOCUMENT_TYPES, TEMPLATES } from '@/lib/constants';
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
      className="space-y-9"
    >
      <Card className="px-8 py-7">
        <span className="label-caps">Черновик</span>
        <Textarea
          variant="bare"
          placeholder="Вставьте текст сюда. Можно как есть — со строчных, без запятых, обрывками. Разберу."
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={9}
          className="mt-3.5 resize-y"
          disabled={disabled}
        />
      </Card>

      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2">
        <div>
          <span className="label-caps" id="doc-type-label">Тип документа</span>
          <Select value={documentType} onValueChange={(v) => onTypeChange(v as DocumentTypeId)} disabled={disabled}>
            <SelectTrigger className="mt-1.5" aria-labelledby="doc-type-label">
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
          <span className="mt-2.5 block text-sm text-muted-foreground">{typeDescription}</span>
        </div>

        <div>
          <span className="label-caps" id="template-label">Шаблон оформления</span>
          <Select value={templateId} onValueChange={(v) => onTemplateChange(v as TemplateId)} disabled={disabled}>
            <SelectTrigger className="mt-1.5" aria-labelledby="template-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATES.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="mt-2.5 block text-sm text-muted-foreground">
            Тип задаёт структуру, шаблон — оформление.
          </span>
        </div>
      </div>
    </motion.div>
  );
});
