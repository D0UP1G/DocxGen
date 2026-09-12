import { memo, useRef, useState } from 'react';
import { Mic, Square, Upload } from 'lucide-react';
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
  onAudioTranscribed?: (text: string) => void;
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
  onAudioTranscribed,
}: DraftSectionProps) {
  const prefersReduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioError, setAudioError] = useState('');

  async function transcribe(blob: Blob) {
    setAudioBusy(true); setAudioError('');
    try {
      const response = await fetch('/api/audio/transcribe', { method: 'POST', headers: { 'X-Owner-Platform': 'web', 'X-Owner-Id': 'session', ...(import.meta.env.VITE_API_KEY ? { 'X-API-Key': import.meta.env.VITE_API_KEY } : {}) }, body: (() => { const form = new FormData(); form.append('file', blob, 'recording.webm'); return form; })() });
      const responseText = await response.text();
      let data: { ok?: boolean; text?: string; error?: { message?: string } };
      try { data = JSON.parse(responseText); }
      catch {
        if (response.status === 502) {
          throw new Error('Старый Vite-прокси не знает маршрут audio. Полностью остановите старый dev-процесс (Ctrl+C), затем запустите из корня: npm run dev.');
        }
        throw new Error(`Сервис распознавания вернул не JSON (HTTP ${response.status}).`);
      }
      if (!response.ok || !data.ok) throw new Error(data.error?.message ?? 'Не удалось распознать аудио');
      if (!data.text) throw new Error('Сервис не вернул распознанный текст');
      onAudioTranscribed?.(data.text);
    } catch (error) { setAudioError(error instanceof Error ? error.message : 'Ошибка распознавания'); }
    finally { setAudioBusy(false); }
  }

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); setRecording(false); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setAudioError('Запись аудио не поддерживается браузером'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream); chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); void transcribe(new Blob(chunksRef.current, { type: recorder.mimeType })); };
      recorderRef.current = recorder; recorder.start(); setRecording(true); setAudioError('');
    } catch { setAudioError('Нет доступа к микрофону'); }
  }

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
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void toggleRecording()} disabled={disabled || audioBusy} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
          {recording ? <Square size={16} /> : <Mic size={16} />} {recording ? 'Остановить запись' : 'Записать голосом'}
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || audioBusy} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"><Upload size={16} /> Загрузить аудио</button>
        <input ref={inputRef} hidden type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void transcribe(file); event.target.value = ''; }} />
        {audioBusy && <span className="text-sm text-gray-500">Распознавание…</span>}
        {audioError && <span role="alert" className="text-sm text-red-600">{audioError}</span>}
      </div>

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
               <SelectItem value="classic">Классический корпоративный</SelectItem>
               <SelectItem value="modern">Современный регламентный</SelectItem>
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
