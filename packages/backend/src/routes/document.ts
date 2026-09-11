import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { generateTypstFromText } from '../services/ai.service';
import { compileTypst } from '../services/typst.service';
import { convertToDocx } from '../services/pandoc.service';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('📝 Generating document from text...');
    
    // Step 1: AI generates Typst
    const typstContent = await generateTypstFromText(text);
    console.log('✅ Typst generated');
    
    // Step 2: Compile Typst to PDF
    const pdfPath = await compileTypst(typstContent);
    console.log('✅ PDF compiled');
    
    // Step 3: Convert PDF to DOCX
    const docxPath = await convertToDocx(pdfPath, typstContent);
    console.log('✅ DOCX converted');
    
    // Step 4: Serve the file
    const fileName = 'generated-document.docx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(docxPath);
    fileStream.pipe(res);
    
    // Cleanup after sending
    fileStream.on('end', () => {
      const tmpDir = path.dirname(pdfPath);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    
  } catch (error: any) {
    console.error('❌ Generation failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
