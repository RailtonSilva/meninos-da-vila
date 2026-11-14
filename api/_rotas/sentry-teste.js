import { route } from '../_lib/http.js';

// GET /api/sentry-teste → gera um erro DE PROPÓSITO para conferir se o Sentry está recebendo.
// Só administrador. Deve aparecer no Sentry como "Teste do Sentry (servidor)".
export default route(
  {
    async GET(req, res, ctx) {
      throw new Error(`Teste do Sentry (servidor) — disparado por ${ctx.perfil.email} em ${new Date().toISOString()}`);
    },
  },
  { admin: true }
);
