import { useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { setText, setCorrectedText, setDocumentType, setTemplateId, processText, generateDocument } from '@/store/documentSlice';
import { DOCUMENT_TYPES } from '@/lib/constants';
import type { DocumentTypeId, TemplateId } from '@/types/document';

import { StepIndicator } from './StepIndicator';
import { DraftSection } from './DraftSection';
import { CorrectedSection } from './CorrectedSection';
import { StatusBar } from './StatusBar';
import { ErrorBar } from './ErrorBar';
import { ValidationAlert } from './ValidationAlert';
import { ActionButton } from './ActionButton';

export function DocumentGenerator() {
  const prefersReduced = useReducedMotion();
  const dispatch = useAppDispatch();

  const text = useAppSelector((s) => s.document.text);
  const correctedText = useAppSelector((s) => s.document.correctedText);
  const requisites = useAppSelector((s) => s.document.requisites);
  const documentType = useAppSelector((s) => s.document.documentType);
  const templateId = useAppSelector((s) => s.document.templateId);
  const missingFields = useAppSelector((s) => s.document.missingFields);
  const warnings = useAppSelector((s) => s.document.warnings);
  const status = useAppSelector((s) => s.document.status);
  const error = useAppSelector((s) => s.document.error);
  const processing = useAppSelector((s) => s.document.processing);
  const generating = useAppSelector((s) => s.document.generating);

  const typeDescription = useMemo(
    () => DOCUMENT_TYPES.find((item) => item.id === documentType)?.description ?? '',
    [documentType],
  );

  const visibleFields = useMemo(() => {
    if (documentType === 'informacionnaya') return ['from', 'date', 'subject', 'signature', 'executor'];
    if (documentType === 'pismo') return ['to', 'from', 'position', 'date', 'number', 'subject', 'signature', 'greeting', 'executor'];
    return ['to', 'from', 'position', 'date', 'number', 'subject', 'signature', 'executor'];
  }, [documentType]);

  const currentStep = correctedText ? 2 : 1;

  const handleTextChange = useCallback((value: string) => dispatch(setText(value)), [dispatch]);
  const handleCorrectedTextChange = useCallback((value: string) => dispatch(setCorrectedText(value)), [dispatch]);
  const handleTypeChange = useCallback((value: DocumentTypeId) => {
    dispatch(setDocumentType(value));
    dispatch(setCorrectedText(''));
  }, [dispatch]);
  const handleTemplateChange = useCallback((value: TemplateId) => dispatch(setTemplateId(value)), [dispatch]);
  const handleRequisiteChange = useCallback((field: string, value: string) => {
    dispatch({ type: 'document/setRequisites', payload: { ...requisites, [field]: value } });
  }, [dispatch, requisites]);

  const handleProcess = useCallback(() => {
    if (!text.trim()) return;
    dispatch(processText({ text, documentType }));
  }, [dispatch, text, documentType]);

  const handleGenerate = useCallback(() => {
    if (!text.trim() || !correctedText.trim()) return;
    dispatch(generateDocument({ text, correctedText, requisites, documentType, templateId }));
  }, [dispatch, text, correctedText, requisites, documentType, templateId]);

  const handleAction = correctedText ? handleGenerate : handleProcess;
  const actionDisabled = correctedText ? generating : !text.trim() || processing;

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            DocxGen — генератор документов
          </CardTitle>
          <CardDescription>
            Три шага: вставьте черновик, проверьте обработанный текст и скачайте редактируемый DOCX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StepIndicator currentStep={currentStep} />

          <AnimatePresence mode="wait">
            {!correctedText && (
              <motion.div
                key="draft"
                initial={prefersReduced ? false : undefined}
                animate={prefersReduced ? {} : { opacity: 1 }}
                exit={prefersReduced ? {} : { opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <DraftSection
                  text={text}
                  documentType={documentType}
                  templateId={templateId}
                  typeDescription={typeDescription}
                  onTextChange={handleTextChange}
                  onTypeChange={handleTypeChange}
                  onTemplateChange={handleTemplateChange}
                  disabled={processing || generating}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <StatusBar status={status} isVisible={!!status} />
          <ErrorBar error={error} isVisible={!!error} />

          <AnimatePresence mode="wait">
            {correctedText && (
              <motion.div
                key="corrected"
                initial={prefersReduced ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? {} : { opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                layout
              >
                <CorrectedSection
                  correctedText={correctedText}
                  requisites={requisites}
                  visibleFields={visibleFields}
                  onTextChange={handleCorrectedTextChange}
                  onRequisiteChange={handleRequisiteChange}
                  disabled={processing || generating}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <ValidationAlert missingFields={missingFields} warnings={warnings} />

          <ActionButton
            step={currentStep}
            processing={processing}
            generating={generating}
            onClick={handleAction}
            disabled={actionDisabled}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
