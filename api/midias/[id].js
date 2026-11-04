import { route, readBody, check, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { BUCKET, midiaParaCliente } from '../_lib/midias.js';
import { validarId } from '../_lib/validar.js';
import { registrar } from '../_lib/auditoria.js';

/** Admin mexe em tudo; treinador só no que ele mesmo enviou. */
function podeAlterar(ctx, midia) {
  if (ctx.perfil.papel === 'admin' || midia.enviado_por === ctx.perfil.id) return;
  throw new HttpError(403, 'Você só pode alterar fotos e vídeos que você mesmo enviou.', 'SEM_PERMISSAO');
}

export default route({
  // PUT /api/midias/:id { legenda } → edita a legenda
  async PUT(req, res, ctx) {
    const id = validarId(req.query.id);
    const legenda = String(readBody(req).legenda ?? '').trim().slice(0, 200) || null;
    const atual = await db().from('midias').select('*').eq('id', id).maybeSingle().then(check);
    if (!atual) throw new HttpError(404, 'Mídia não encontrada.');
    podeAlterar(ctx, atual);
    const midia = await db().from('midias').update({ legenda }).eq('id', id).select().single().then(check);
    await registrar(ctx, 'midia.editar', `Alterou a legenda de uma mídia para "${legenda || 'sem legenda'}"`, { entidadeId: id });
    res.status(200).json(midiaParaCliente(midia));
  },

  // DELETE /api/midias/:id → apaga o registro e o arquivo do Storage
  async DELETE(req, res, ctx) {
    const id = validarId(req.query.id);
    const midia = await db().from('midias').select('*').eq('id', id).maybeSingle().then(check);
    if (!midia) return res.status(204).end();
    podeAlterar(ctx, midia);
    if (midia.caminho) {
      const { error } = await db().storage.from(BUCKET).remove([midia.caminho]);
      if (error) throw new Error(`Storage: ${error.message}`);
    }
    await db().from('midias').delete().eq('id', id).then(check);
    await registrar(ctx, 'midia.excluir', `Excluiu ${midia.tipo === 'foto' ? 'uma foto' : 'um vídeo'} da galeria${midia.legenda ? ` — "${midia.legenda}"` : ''}`, { entidadeId: id });
    res.status(204).end();
  },
});
