import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2, FileText, Code, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

export function DocumentGenerator() {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typstOutput, setTypstOutput] = useState('');
  const [status, setStatus] = useState('');
  const [showTypst, setShowTypst] = useState(true);
  const [compileErrors, setCompileErrors] = useState<string[]>([]);
  const typstRef = useRef<HTMLPreElement>(null);

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);
    setTypstOutput('');
    setStatus('');
    setCompileErrors([]);

    try {
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
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

        // Process complete SSE messages (terminated by double newline)
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
                // AI is fixing — replace output with patched version
                setTypstOutput((prev) => prev + data);
                break;

              case 'status':
                setStatus(data);
                break;

              case 'typst':
                setTypstOutput(data);
                break;

              case 'compile_error':
                setCompileErrors((prev) => [...prev, data]);
                // Clear the typst output since AI will regenerate
                setTypstOutput('');
                break;

              case 'done':
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

        {status && (
          <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 p-3 rounded-md flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status}
          </div>
        )}

        {compileErrors.length > 0 && (
          <div className="space-y-2">
            {compileErrors.map((err, i) => (
              <div key={i} className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 p-3 rounded-md flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="break-all">
                  Ошибка компиляции #{i + 1}: {err.slice(0, 300)}{err.length > 300 ? '...' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
            {error}
          </div>
        )}

        {typstOutput && (
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowTypst(!showTypst)}
              className="w-full flex items-center justify-between px-4 py-2 bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
            >
              <span className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Typst-разметка
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
