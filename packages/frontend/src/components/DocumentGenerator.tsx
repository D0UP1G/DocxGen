import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type DocumentTypeId = 'sluzhebnaya' | 'dokladnaya' | 'informacionnaya' | 'pismo';
type TemplateId = 'official' | 'standard';
type Requisites = Record<string, string>;

const DOCUMENT_TYPES: Array<{ id: DocumentTypeId; label: string; description: string }> = [
  { id: 'sluzhebnaya', label: 'Служебная записка', description: 'Внутренняя переписка' },
  { id: 'dokladnaya', label: 'Докладная записка', description: 'Формальный отчёт' },
  { id: 'informacionnaya', label: 'Информационная справка', description: 'Справка с фактами' },
  { id: 'pismo', label: 'Письмо', description: 'Внешняя корреспонденция' },
];

const FIELD_LABELS: Record<string, string> = {
  to: 'Адресат',
  from: 'Автор / отправитель',
  date: 'Дата',
  subject: 'Заголовок / тема',
  number: 'Номер',
  position: 'Должность',
  signature: 'Подпись',
  greeting: 'Обращение',
  executor: 'Исполнитель',
};

const FIELD_ORDER = ['to', 'from', 'position', 'date', 'number', 'subject', 'signature', 'greeting', 'executor'];

function parseEventData(value: string): unknown {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed === 'string') {
    try { return JSON.parse(parsed); } catch { return parsed; }
  }
  return parsed;
}

async function downloadSseDocument(response: Response, onStatus: (status: string) => void, onValidation: (value: any) => void): Promise<void> {
  if (!response.body) throw new Error('Сервер не вернул поток результата');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    while (buffer.includes('\n\n')) {
      const index = buffer.indexOf('\n\n');
      const message = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      let event = '';
      let data = '';
      for (const line of message.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (!event || !data) continue;
      const parsed = parseEventData(data);
      if (event === 'status') onStatus(String(parsed));
      if (event === 'validation') onValidation(parsed);
      if (event === 'error') throw new Error(String(parsed));
      if (event === 'done') {
        const binary = atob(String(parsed));
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'документ.docx';
        link.click();
        URL.revokeObjectURL(url);
      }
    }
  }
}

export function DocumentGenerator() {
  const [text, setText] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [requisites, setRequisites] = useState<Requisites>({});
  const [documentType, setDocumentType] = useState<DocumentTypeId>('sluzhebnaya');
  const [templateId, setTemplateId] = useState<TemplateId>('official');
  const [missingFields, setMissingFields] = useState<Array<{ field: string; label: string }>>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const typeDescription = useMemo(() => DOCUMENT_TYPES.find((item) => item.id === documentType)?.description, [documentType]);
  const visibleFields = useMemo(() => {
    if (documentType === 'informacionnaya') return ['from', 'date', 'subject', 'signature', 'executor'];
    if (documentType === 'pismo') return ['to', 'from', 'position', 'date', 'number', 'subject', 'signature', 'greeting', 'executor'];
    return ['to', 'from', 'position', 'date', 'number', 'subject', 'signature', 'executor'];
  }, [documentType]);

  const processText = async () => {
    if (!text.trim()) return;
    setProcessing(true); setError(''); setStatus('Обработка черновика…'); setMissingFields([]); setWarnings([]);
    try {
      const response = await fetch('/api/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, documentType }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось обработать текст');
      setCorrectedText(payload.correctedText || text);
      setRequisites(payload.requisites || {});
      setMissingFields(payload.validation?.missing || []);
      setWarnings(payload.validation?.warnings || []);
      setStatus(payload.source === 'local' ? 'Готово: использована локальная обработка' : 'Готово: текст обработан AI');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ошибка обработки');
      setStatus('');
    } finally { setProcessing(false); }
  };

  const generateDocument = async () => {
    if (!text.trim() || !correctedText.trim()) return;
    setGenerating(true); setError(''); setStatus('Формирование DOCX…');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, correctedText, requisites, documentType, templateId }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Не удалось сформировать документ');
      await downloadSseDocument(response, setStatus, (value) => {
        setMissingFields(value?.missing || []); setWarnings(value?.warnings || []);
      });
      setStatus('DOCX готов и скачан');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ошибка генерации');
    } finally { setGenerating(false); }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />DocxGen — генератор документов</CardTitle>
        <CardDescription>Три шага: вставьте черновик, проверьте обработанный текст и скачайте редактируемый DOCX.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea placeholder="Введите или вставьте черновик…" value={text} onChange={(event) => setText(event.target.value)} rows={8} className="resize-y" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium">Тип документа
            <select value={documentType} onChange={(event) => { setDocumentType(event.target.value as DocumentTypeId); setCorrectedText(''); }} className="mt-2 w-full rounded-lg border px-3 py-2">
              {DOCUMENT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
            <span className="mt-1 block text-xs text-gray-500">{typeDescription}</span>
          </label>
          <label className="text-sm font-medium">Шаблон оформления
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value as TemplateId)} className="mt-2 w-full rounded-lg border px-3 py-2">
              <option value="official">Классический корпоративный</option>
              <option value="standard">Современный регламентный</option>
            </select>
            <span className="mt-1 block text-xs text-gray-500">Тип отвечает за структуру, шаблон — за оформление.</span>
          </label>
        </div>

        {status && <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{status}</div>}
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {correctedText && <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-green-600" />Исправленный текст — его можно отредактировать</div>
          <Textarea value={correctedText} onChange={(event) => setCorrectedText(event.target.value)} rows={10} className="resize-y" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELD_ORDER.filter((field) => visibleFields.includes(field)).map((field) => <label key={field} className="text-sm">{FIELD_LABELS[field]}
              <input value={requisites[field] || ''} onChange={(event) => setRequisites((current) => ({ ...current, [field]: event.target.value }))} placeholder={`[${FIELD_LABELS[field]}]`} className="mt-1 w-full rounded-md border px-3 py-2" />
            </label>)}
          </div>
        </div>}

        {(missingFields.length > 0 || warnings.length > 0) && <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Проверьте реквизиты</div>
          {missingFields.length > 0 && <ul className="mt-2 list-disc pl-5">{missingFields.map((field) => <li key={field.field}>{field.label} — заполните или оставьте понятную отметку</li>)}</ul>}
          {warnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}
        </div>}

        {!correctedText ? <Button onClick={processText} disabled={!text.trim() || processing} className="w-full">{processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Обработка…</> : '1. Обработать черновик'}</Button> : <Button onClick={generateDocument} disabled={generating} className="w-full">{generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Формирование…</> : <><Download className="mr-2 h-4 w-4" />2. Сформировать и скачать DOCX</>}</Button>}
      </CardContent>
    </Card>
  );
}
