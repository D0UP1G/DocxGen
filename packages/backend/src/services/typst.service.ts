import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export async function compileTypst(typstContent: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docxgen-'));
  const inputPath = path.join(tmpDir, 'document.typ');
  const outputPath = path.join(tmpDir, 'document.pdf');
  
  fs.writeFileSync(inputPath, typstContent);
  
  try {
    await execFileAsync('typst', ['compile', inputPath, outputPath]);
    return outputPath;
  } catch (error: any) {
    // Clean up on error
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`Typst compilation failed: ${error.stderr || error.message}`);
  }
}
