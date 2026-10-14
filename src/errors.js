/** Erro com status HTTP e código legível por máquina (ex.: 'validation_error'). */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
