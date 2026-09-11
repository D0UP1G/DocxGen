import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2, FileText } from 'lucide-react';

export function DocumentGenerator() {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-document.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          DocxGen — Generador de Documentos
        </CardTitle>
        <CardDescription>
          Ingresa tu texto y la IA generará un documento Typst, que será convertido a .docx
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Escribe o pega tu texto aquí... La IA lo convertirá en un documento profesional."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="resize-none"
        />
        
        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
            {error}
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
              Generando documento...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generar y Descargar .docx
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
