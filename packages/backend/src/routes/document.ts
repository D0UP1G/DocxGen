import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { generateTypstStream } from '../services/ai.service';
import { compileTypst } from '../services/typst.service';
import { convertToDocx } from '../services/pandoc.service';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
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
    sendEvent('status', 'Генерация Typst-разметки...');
    const typstContent = await generateTypstStream(text, (chunk) => {
      sendEvent('chunk', chunk);
    });
    console.log('✅ Typst generated');

    // Step 2: Signal compilation start
    sendEvent('status', 'Компиляция Typst в PDF...');
    sendEvent('typst', typstContent);

    // Step 3: Compile Typst to PDF
    const pdfPath = await compileTypst(typstContent);
    console.log('✅ PDF compiled');

    // Step 4: Convert to DOCX
    sendEvent('status', 'Конвертация PDF в DOCX...');
    const docxPath = await convertToDocx(pdfPath, typstContent);
    console.log('✅ DOCX converted');

    // Step 5: Read file and send as base64
    const docxBuffer = fs.readFileSync(docxPath);
    const docxBase64 = docxBuffer.toString('base64');

    sendEvent('done', docxBase64);
    console.log('✅ Document ready for download');

    // Cleanup
    const tmpDir = path.dirname(pdfPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    res.end();

  } catch (error: any) {
    console.error('❌ Generation failed:', error.message);
    // If headers already sent, send error as SSE event
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify(error.message)}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
