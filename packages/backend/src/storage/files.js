import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Creates a file storage backend for DOCX files.
 * Files are stored in <dataDir>/files/<uuid>.docx.
 *
 * @param {string} dataDir  root data directory
 * @returns {{ save: (buffer: Buffer, filename: string) => { id: string, path: string, filename: string },
 *             remove: (id: string) => void,
 *             getPath: (id: string) => string }}
 */
export function createFileStorage(dataDir) {
  const filesDir = path.join(dataDir, 'files');
  fs.mkdirSync(filesDir, { recursive: true });

  return {
    save(buffer, filename) {
      const id = crypto.randomUUID();
      const filePath = path.join(filesDir, `${id}.docx`);
      // The directory can be removed by an external cleanup process while the
      // server is running, so ensure it exists immediately before saving too.
      fs.mkdirSync(filesDir, { recursive: true });
      fs.writeFileSync(filePath, buffer);
      return { id, path: filePath, filename };
    },
    remove(id) {
      const filePath = path.join(filesDir, `${id}.docx`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    },
    getPath(id) {
      return path.join(filesDir, `${id}.docx`);
    },
  };
}
