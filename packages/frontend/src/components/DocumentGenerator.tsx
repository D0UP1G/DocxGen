import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2, FileText, Code, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

interface RetryAttempt {
  attempt: number;
  status: 'compiling' | 'fixing' | 'success' | 'failed';
  error?: string;
  typstCode: string;
  fixProgress: string;
}

export function DocumentGenerator() {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typstOutput, setTypstOutput] = useState('');
  const [status, setStatus] = useState('');
  const [showTypst, setShowTypst] = useState(true);
  const [retryAttempts, setRetryAttempts] = useState<RetryAttempt[]>([]);
  const [missingFields, setMissingFields] = useState<{field: string, label: string}[]>([]);
  const [templateId, setTemplateId] = useState('official');
  const typstRef = useRef<HTMLPreElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const resetState = () => {
    setIsLoading(true);
    setError(null);
    setTypstOutput('');
    setStatus('');
    setRetryAttempts([]);
    setMissingFields([]);
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;

    resetState();

    try {
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, templateId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка генерации');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes('\n\n')) {
          const idx = buffer.indexOf('\n\n');
          const message = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let eventType = '';
          let eventData = '';

          for (const line of message.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (!eventType || !eventData) continue;

          try {
            const data = JSON.parse(eventData);

            switch (eventType) {
              case 'chunk':
                setTypstOutput((prev) => {
                  const next = prev + data;
                  setTimeout(() => {
                    typstRef.current?.scrollTo(0, typstRef.current.scrollHeight);
                  }, 0);
                  return next;
                });
                break;

              case 'fix_chunk':
                // AI is fixing — show progress
                setRetryAttempts((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last) {
                    last.fixProgress += data;
                  }
                  return updated;
                });
                break;

              case 'validation':
                setMissingFields(data.missing);
                break;

              case 'status':
                setStatus(data);
                // Parse attempt number from status
                const attemptMatch = data.match(/попытка (\d+)/);
                if (attemptMatch) {
                  const attemptNum = parseInt(attemptMatch[1], 10);

                  // If this is a new attempt, add it to timeline
                  setRetryAttempts((prev) => {
                    const exists = prev.some((a) => a.attempt === attemptNum);
                    if (!exists) {
                      return [
                        ...prev,
                        {
                          attempt: attemptNum,
                          status: 'compiling',
                          typstCode: '',
                          fixProgress: '',
                        },
                      ];
                    }
                    return prev;
                  });
                }
                break;

              case 'typst':
                setTypstOutput(data);
                // Update the current attempt's typst code
                setRetryAttempts((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last) {
                    last.typstCode = data;
                  }
                  return updated;
                });
                break;

              case 'compile_error':
                setRetryAttempts((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last) {
                    last.status = 'fixing';
                    last.error = data;
                  }
                  return updated;
                });
                break;

              case 'done':
                // Success — mark the last attempt as success
                setRetryAttempts((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last) {
                    last.status = 'success';
                  }
                  return updated;
                });

                // Download the file
                const binary = atob(data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                const blob = new Blob([bytes], {
                  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'документ.docx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setStatus('');
                break;

              case 'error':
                throw new Error(data);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected token') {
              throw parseErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Произошла неизвестная ошибка');
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  const getStatusIcon = (attemptStatus: RetryAttempt['status']) => {
    switch (attemptStatus) {
      case 'compiling':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'fixing':
        return <RotateCcw className="h-4 w-4 animate-spin text-amber-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusLabel = (attemptStatus: RetryAttempt['status']) => {
    switch (attemptStatus) {
      case 'compiling':
        return 'Компиляция...';
      case 'fixing':
        return 'AI исправляет...';
      case 'success':
        return 'Успешно';
      case 'failed':
        return 'Ошибка';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          DocxGen — Генератор документов
        </CardTitle>
        <CardDescription>
          Введите текст, и ИИ сгенерирует документ Typst, который будет преобразован в .docx
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Введите или вставьте текст здесь... ИИ преобразует его в профессиональный документ."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="resize-none"
        />

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Шаблон оформления
          </label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="official">Официальный (ГОСТ)</option>
            <option value="standard">Стандартный</option>
          </select>
        </div>

        {/* Current Status */}
        {status && (
          <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 p-3 rounded-md flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Retry Timeline */}
        {retryAttempts.length > 0 && (
          <div ref={timelineRef} className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-muted text-sm font-medium flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Фидбек-луп: {retryAttempts.length} попыток
            </div>
            <div className="divide-y">
              {retryAttempts.map((attempt) => (
                <div key={attempt.attempt} className="p-4 space-y-2">
                  {/* Attempt Header */}
                  <div className="flex items-center gap-2">
                    {getStatusIcon(attempt.status)}
                    <span className="font-medium text-sm">
                      Попытка {attempt.attempt}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getStatusLabel(attempt.status)}
                    </span>
                  </div>

                  {/* Error Message */}
                  {attempt.error && (
                    <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 p-2 rounded flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="break-all">
                        {attempt.error.slice(0, 200)}{attempt.error.length > 200 ? '...' : ''}
                      </span>
                    </div>
                  )}

                  {/* Fix Progress */}
                  {attempt.status === 'fixing' && attempt.fixProgress && (
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono overflow-auto max-h-24">
                      {attempt.fixProgress}
                    </div>
                  )}

                  {/* Typst Code (collapsible) */}
                  {attempt.typstCode && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                        Typst-код (попытка {attempt.attempt})
                      </summary>
                      <pre className="mt-2 text-xs font-mono p-2 bg-muted/50 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                        {attempt.typstCode}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final Typst Output */}
        {typstOutput && (
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowTypst(!showTypst)}
              className="w-full flex items-center justify-between px-4 py-2 bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
            >
              <span className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Итоговая Typst-разметка
              </span>
              {showTypst ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showTypst && (
              <pre
                ref={typstRef}
                className="p-4 text-sm font-mono overflow-auto max-h-96 bg-muted/30 whitespace-pre-wrap"
              >
                {typstOutput}
              </pre>
            )}
          </div>
        )}

        {/* Missing Fields Warning */}
        {missingFields.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h4 className="text-yellow-800 font-medium mb-2">
              ⚠️ Отсутствуют обязательные реквизиты:
            </h4>
            <ul className="list-disc list-inside text-yellow-700">
              {missingFields.map(f => (
                <li key={f.field}>{f.label}</li>
              ))}
            </ul>
            <p className="text-sm text-yellow-600 mt-2">
              В документе они будут помечены как [Заполнить]
            </p>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={!text.trim() || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Генерация документа...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Сгенерировать и скачать .docx
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
