import fs from 'node:fs';
import tls from 'node:tls';

/**
 * API MAX (*.max.ru) работает на сертификате удостоверяющего центра Минцифры («Russian Trusted Root CA»),
 * которого нет в стандартном наборе Node.js и Windows. Файл корневого сертификата (PEM) добавляется к стандартным
 * доверенным сертификатам этого процесса — системное хранилище не меняется, остальные сертификаты остаются в силе.
 * Официальный источник сертификата: https://www.gosuslugi.ru/crt
 */
export function trustExtraCa(file, log) {
  if (!file) return false;
  const pem = fs.readFileSync(file, 'utf8');
  const added = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  if (!added.length) throw new Error(`В файле ${file} нет сертификатов в формате PEM`);
  tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...added]);
  log?.info?.({ file, certificates: added.length }, 'extra CA trusted');
  return true;
}
