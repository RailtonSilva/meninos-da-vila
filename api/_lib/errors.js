export class HttpError extends Error {
  /**
   * @param {number} status   código HTTP
   * @param {string} message  mensagem mostrada ao usuário
   * @param {string} [codigo] código para o front reagir (ex.: PENDENTE, BLOQUEADO, SEM_PERMISSAO)
   */
  constructor(status, message, codigo) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}
