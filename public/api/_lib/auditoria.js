import { db } from './supabase.js';
import { captureError } from './sentry.js';

/**
 * Registra uma ação no histórico. Nunca derruba a operação principal: se falhar, só avisa o Sentry.
 * @param {{ perfil }} ctx         contexto da rota (quem fez)
 * @param {string} acao            ex.: 'pagamento.marcar'
 * @param {string} descricao       texto legível: 'Marcou pagamento de novembro/2026 — Arthur Souza'
 * @param {{ entidadeId?, dados? }} extra
 */
export async function registrar(ctx, acao, descricao, { entidadeId = null, dados = null } = {}) {
  try {
    const { error } = await db().from('auditoria').insert({
      usuario_id: ctx?.perfil?.id ?? null,
      usuario_nome: ctx?.perfil ? ctx.perfil.nome || ctx.perfil.email : 'Sistema',
      acao,
      entidade_id: entidadeId == null ? null : String(entidadeId),
      descricao: String(descricao).slice(0, 500),
      dados,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    captureError(err, { onde: 'auditoria', acao });
  }
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesExtenso = (c) => `${MESES[Number(c.slice(5)) - 1]}/${c.slice(0, 4)}`;
