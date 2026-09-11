/**
 * Domain errors — the single error hierarchy for all business logic.
 *
 * DomainError carries a code + HTTP status so the error handler can
 * serialize it without knowing the internals of every module.
 *
 * AiUnavailableError / AiInvalidResponseError extend Error directly
 * (not DomainError) because they represent infrastructure failures,
 * not user-input problems — the error handler maps them to 503.
 *
 * DeliveryError wraps a file upload/send failure with the fileId
 * for debugging and retry logic.
 */

export class DomainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
  }
}

// Predefined codes for convenience — consumers use these, not magic strings.
DomainError.FORBIDDEN = (msg = 'Доступ запрещён') =>
  new DomainError('FORBIDDEN', msg, 403);

DomainError.NOT_FOUND = (msg = 'Не найдено') =>
  new DomainError('NOT_FOUND', msg, 404);

DomainError.BUSY = (msg = 'Документ обрабатывается') =>
  new DomainError('BUSY', msg, 409);

DomainError.VALIDATION_ERROR = (msg) =>
  new DomainError('VALIDATION_ERROR', msg, 400);

DomainError.DRAFT_EMPTY = () =>
  new DomainError('DRAFT_EMPTY', 'Черновик не может быть пустым', 400);

DomainError.DRAFT_TOO_LONG = (max) =>
  new DomainError('DRAFT_TOO_LONG', `Черновик превышает ${max} символов`, 400);

DomainError.NOT_READY = (msg = 'Документ ещё не обработан') =>
  new DomainError('NOT_READY', msg, 409);

DomainError.UNKNOWN_TYPE = (msg = 'Неизвестный тип документа') =>
  new DomainError('UNKNOWN_TYPE', msg, 400);

export class AiUnavailableError extends Error {
  /**
   * @param {string} message
   * @param {Error|{ retryable?: boolean }} [cause] - pass { retryable: false } to stop the queue
   *   from retrying (used by the simulated outage, otherwise the retry hides the error from the user)
   */
  constructor(message = 'ИИ-сервис временно недоступен', cause) {
    super(message, { cause });
    this.name = 'AiUnavailableError';
    this.status = 503;
    this.retryable = cause?.retryable !== false;
  }
}

export class AiInvalidResponseError extends Error {
  constructor(message = 'ИИ вернул некорректный ответ', cause) {
    super(message, { cause });
    this.name = 'AiInvalidResponseError';
    this.status = 503;
  }
}

export class DeliveryError extends Error {
  constructor(fileId, cause) {
    super(`Не удалось доставить файл ${fileId}`, { cause });
    this.name = 'DeliveryError';
    this.fileId = fileId;
  }
}
