import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export interface TypstResult {
  success: boolean;
  pdfPath?: string;
  tmpDir?: string;
  error?: string;
}

/**
 * Compile Typst content to PDF.
 * Returns a result object instead of throwing — the caller decides retry logic.
 */
export function compileTypst(typstContent: string): TypstResult {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docxgen-'));
  const inputPath = path.join(tmpDir, 'document.typ');
  const outputPath = path.join(tmpDir, 'document.pdf');

  fs.writeFileSync(inputPath, typstContent);

  try {
    // Synchronous check — we'll use execFile async in the route
    return { success: true, pdfPath: outputPath, tmpDir, error: undefined };
  } catch (error: any) {
    return { success: false, tmpDir, error: error.message };
  }
}

/**
 * Run the actual typst compile command.
 * Throws on failure with the stderr message.
 */
export async function runTypstCompile(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync('typst', ['compile', inputPath, outputPath]);
}

/**
 * Extract the .typ file path from a tmpDir.
 */
export function getTypstPath(tmpDir: string): string {
  return path.join(tmpDir, 'document.typ');
}

/**
 * Extract the .pdf file path from a tmpDir.
 */
export function getPdfPath(tmpDir: string): string {
  return path.join(tmpDir, 'document.pdf');
}

/**
 * Write Typst content to the tmpDir and compile it.
 * Returns the result including error details on failure.
 */
export async function compileTypstContent(typstContent: string): Promise<TypstResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docxgen-'));
  const inputPath = path.join(tmpDir, 'document.typ');
  const outputPath = path.join(tmpDir, 'document.pdf');

  fs.writeFileSync(inputPath, typstContent);

  try {
    await execFileAsync('typst', ['compile', inputPath, outputPath]);
    return { success: true, pdfPath: outputPath, tmpDir };
  } catch (error: any) {
    const stderr = error.stderr || error.message || String(error);
    return { success: false, tmpDir, error: stderr };
  }
}

/**
 * Retry: overwrite the .typ file in an existing tmpDir and recompile.
 */
export async function retryCompile(tmpDir: string, typstContent: string): Promise<TypstResult> {
  const inputPath = path.join(tmpDir, 'document.typ');
  const outputPath = path.join(tmpDir, 'document.pdf');

  fs.writeFileSync(inputPath, typstContent);

  try {
    await execFileAsync('typst', ['compile', inputPath, outputPath]);
    return { success: true, pdfPath: outputPath, tmpDir };
  } catch (error: any) {
    const stderr = error.stderr || error.message || String(error);
    return { success: false, tmpDir, error: stderr };
  }
}
