import { route, readBody, check, HttpError } from '../../_lib/http.js';
import { db } from '../../_lib/supabase.js';
import { validarId } from '../../_lib/validar.js';
import { registrar } from '../../_lib/auditoria.js';

export default route({
  // PUT /api/links/:id { ativo?, nome_completo?, titulo? }
  async PUT(req, res, ctx) {
    const id = validarId(req.query.id);
    const b = readBody(req);
    const dados = {};
    if ('ativo' in b) dados.ativo = Boolean(b.ativo);
    if ('nome_completo' in b) dados.nome_completo = Boolean(b.nome_completo);
    if ('titulo' in b) dados.titulo = String(b.titulo ?? '').trim().slice(0, 100) || null;
    if (!Object.keys(dados).length) throw new HttpError(400, 'Nada para atualizar.');
    const link = await db().from('links_publicos').update(dados).eq('id', id).select().maybeSingle().then(check);
    if (!link) throw new HttpError(404, 'Link não encontrado.');
    const partes = [];
    if ('ativo' in dados) partes.push(dados.ativo ? 'reativou' : 'desativou');
    if ('nome_completo' in dados) partes.push(dados.nome_completo ? 'passou a mostrar nomes completos em' : 'passou a abreviar nomes em');
    if ('titulo' in dados) partes.push('renomeou');
    const desc = `${partes.join(' e ')} o link "${link.titulo || 'sem título'}"`;
    await registrar(ctx, 'link.editar', desc.charAt(0).toUpperCase() + desc.slice(1), { entidadeId: id, dados });
    res.status(200).json(link);
  },

  // DELETE /api/links/:id → o link para de funcionar na hora
  async DELETE(req, res, ctx) {
    const id = validarId(req.query.id);
    const removidos = await db().from('links_publicos').delete().eq('id', id).select().then(check);
    if (removidos?.length) await registrar(ctx, 'link.excluir', `Excluiu o link público "${removidos[0].titulo || 'sem título'}"`, { entidadeId: id });
    res.status(204).end();
  },
}, { admin: true });
