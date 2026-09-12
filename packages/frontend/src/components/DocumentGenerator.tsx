import { useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { setText, setCorrectedText, setDocumentType, setTemplateId, processText, generateDocument } from '@/store/documentSlice';
import { DOCUMENT_TYPES, TEMPLATES } from '@/lib/constants';
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

  const templateLabel = useMemo(
    () => TEMPLATES.find((item) => item.id === templateId)?.label ?? '',
    [templateId],
  );

  const visibleFields = useMemo(() => {
    if (documentType === 'reference') return ['authorPosition', 'authorName', 'addressee', 'period'];
    if (documentType === 'letter') return ['addresseeOrg', 'addresseePerson', 'addresseeAddress', 'signerPosition', 'signerName', 'executor'];
    return ['addressee', 'authorPosition', 'authorName', 'number'];
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
    dispatch(processText({ text, documentType, templateId }));
  }, [dispatch, text, documentType, templateId]);

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
      className="mx-auto w-full max-w-[812px]"
    >
      {/* Название теперь в общей шапке — здесь остаётся только выбранный шаблон */}
      <div className="flex justify-end">
        <span className="label-caps tracking-[0.18em]">{templateLabel}</span>
      </div>

      <h1 className="mt-4.5 font-display text-5xl leading-[1.02] font-medium tracking-tight sm:text-[56px]">
        Документ
        <br />
        за три шага
      </h1>
      <p className="mt-4 max-w-[470px] text-base leading-7 text-muted-foreground text-pretty">
        Черновик как есть — с ошибками и обрывками. Дальше правка орфографии, грамматики и стиля,
        разбор реквизитов и готовый DOCX. Ничего, чего нет в вашем тексте, не добавляется.
      </p>

      <StepIndicator currentStep={currentStep} className="mt-10" />

      <div className="mt-7 space-y-7">
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
      </div>

      <div className="mt-11">
        <ActionButton
          step={currentStep}
          processing={processing}
          generating={generating}
          onClick={handleAction}
          disabled={actionDisabled}
        />
      </div>
    </motion.div>
  );
}
