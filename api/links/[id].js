import { route, readBody, check, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { validarId } from '../_lib/validar.js';

export default route({
  // PUT /api/links/:id { ativo?, nome_completo?, titulo? }
  async PUT(req, res) {
    const id = validarId(req.query.id);
    const b = readBody(req);
    const dados = {};
    if ('ativo' in b) dados.ativo = Boolean(b.ativo);
    if ('nome_completo' in b) dados.nome_completo = Boolean(b.nome_completo);
    if ('titulo' in b) dados.titulo = String(b.titulo ?? '').trim().slice(0, 100) || null;
    if (!Object.keys(dados).length) throw new HttpError(400, 'Nada para atualizar.');
    const link = await db().from('links_publicos').update(dados).eq('id', id).select().maybeSingle().then(check);
    if (!link) throw new HttpError(404, 'Link não encontrado.');
    res.status(200).json(link);
  },

  // DELETE /api/links/:id → o link para de funcionar na hora
  async DELETE(req, res) {
    const id = validarId(req.query.id);
    await db().from('links_publicos').delete().eq('id', id).then(check);
    res.status(204).end();
  },
});
