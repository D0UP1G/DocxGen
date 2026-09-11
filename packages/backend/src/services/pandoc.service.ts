import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export async function convertToDocx(pdfPath: string, typstContent: string): Promise<string> {
  const tmpDir = path.dirname(pdfPath);
  const inputTypPath = path.join(tmpDir, 'document.typ');
  const outputPath = path.join(tmpDir, 'document.docx');
  
  // Write the .typ file so pandoc can read it directly
  fs.writeFileSync(inputTypPath, typstContent);
  
  try {
    // Pandoc supports Typst as input since v3.1.3
    await execFileAsync('pandoc', [inputTypPath, '-o', outputPath]);
    return outputPath;
  } catch (error: any) {
    // Fallback: try PDF → DOCX if Typst reader fails
    try {
      await execFileAsync('pandoc', [pdfPath, '-o', outputPath]);
      return outputPath;
    } catch (fallbackError: any) {
      throw new Error(`Pandoc conversion failed: ${error.stderr || error.message}`);
    }
  }
}
