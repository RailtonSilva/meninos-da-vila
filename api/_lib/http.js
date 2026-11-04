import { requireUser } from './supabase.js';
import { captureError, flushSentry } from './sentry.js';

import { HttpError } from './errors.js';

export { HttpError };

export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { throw new HttpError(400, 'JSON inválido.'); }
  }
  return req.body;
}

/** Lança um Error de verdade a partir do erro do Supabase (melhor rastreio no Sentry). */
export function check({ data, error }) {
  if (error) throw Object.assign(new Error(error.message), { code: error.code, details: error.details });
  return data;
}

/**
 * Cria um handler da Vercel com roteamento por método, autenticação e captura de erros.
 * @param {Record<string, Function>} handlers  ex.: { GET, POST }
 * @param {{ auth?: boolean }} opts            auth=true exige login do Supabase (padrão)
 */
export function route(handlers, { auth = true } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const fn = handlers[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(handlers).join(', '));
      return res.status(405).json({ erro: 'Método não permitido.' });
    }
    try {
      const user = auth ? await requireUser(req) : null;
      await fn(req, res, { user });
    } catch (err) {
      const esperado = err instanceof HttpError; // erros previstos: mensagem vai para o usuário
      const status = esperado ? err.status : 500;
      if (!esperado || status >= 500) {
        captureError(err, { method: req.method, url: req.url });
        await flushSentry();
      }
      if (!res.headersSent) {
        res.status(status).json({ erro: esperado ? err.message : 'Erro interno. Tente novamente.' });
      }
    }
  };
}
