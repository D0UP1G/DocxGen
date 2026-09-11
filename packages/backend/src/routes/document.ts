import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { generateTypstStream, patchTypstErrors } from '../services/ai.service';
import { compileTypstContent, retryCompile } from '../services/typst.service';
import { convertToDocx } from '../services/pandoc.service';

const MAX_RETRIES = 10;

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  let tmpDir: string | undefined;

  try {
    const { text, documentType = 'sluzhebnaya' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event: string, data: string) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    console.log('📝 Generating document from text...');

    // Step 1: Stream AI response
    sendEvent('status', 'Анализ текста и извлечение реквизитов...');
    const aiResult = await generateTypstStream(text, documentType, (chunk) => {
      sendEvent('chunk', chunk);
    });
    console.log('✅ AI processing complete');

    // Send structured data to frontend
    sendEvent('ai_result', JSON.stringify({
      correctedText: aiResult.correctedText,
      requisites: aiResult.requisites,
      documentType: aiResult.documentType,
    }));

    // Step 2: Generate Typst from structured data (will be implemented next)
    // For now, use the corrected text
    let typstContent = aiResult.correctedText;

    // Step 2: Compile with retry loop
    let attempt = 0;
    let compiled = false;

    while (attempt < MAX_RETRIES) {
      attempt++;
      sendEvent('status', `Компиляция Typst (попытка ${attempt}/${MAX_RETRIES})...`);
      sendEvent('typst', typstContent);

      const result = await compileTypstContent(typstContent);
      tmpDir = result.tmpDir;

      if (result.success) {
        compiled = true;
        console.log(`✅ PDF compiled on attempt ${attempt}`);
        break;
      }

      // Compilation failed — send error to AI for fix
      console.log(`⚠️ Attempt ${attempt} failed: ${result.error}`);

      if (attempt < MAX_RETRIES) {
        sendEvent('status', `Ошибка компиляции. ИИ исправляет... (попытка ${attempt}/${MAX_RETRIES})`);
        sendEvent('compile_error', result.error!);

        try {
          typstContent = await patchTypstErrors(typstContent, result.error!, (chunk) => {
            sendEvent('fix_chunk', chunk);
          });
          console.log(`✅ Typst fixed by AI (attempt ${attempt + 1})`);
        } catch (fixError: any) {
          console.error(`❌ AI fix failed: ${fixError.message}`);
          // If AI fix fails, break and report the original error
          break;
        }
      }
    }

    if (!compiled) {
      const errorMsg = `Компиляция Typst завершилась после ${MAX_RETRIES} попыток. Последняя ошибка: ${tmpDir ? fs.readFileSync(path.join(tmpDir, 'document.typ'), 'utf-8').slice(0, 200) : 'unknown'}`;
      sendEvent('error', errorMsg);
      res.end();
      return;
    }

    // Step 3: Convert to DOCX
    sendEvent('status', 'Конвертация PDF в DOCX...');
    const docxPath = await convertToDocx(
      path.join(tmpDir!, 'document.pdf'),
      typstContent,
    );
    console.log('✅ DOCX converted');

    // Step 4: Read file and send as base64
    const docxBuffer = fs.readFileSync(docxPath);
    const docxBase64 = docxBuffer.toString('base64');

    sendEvent('done', docxBase64);
    console.log('✅ Document ready for download');

    // Cleanup
    fs.rmSync(tmpDir!, { recursive: true, force: true });

    res.end();

  } catch (error: any) {
    console.error('❌ Generation failed:', error.message);
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify(error.message)}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
