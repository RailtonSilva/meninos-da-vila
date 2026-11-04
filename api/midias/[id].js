import { route, readBody, check, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { BUCKET, midiaParaCliente } from '../_lib/midias.js';
import { validarId } from '../_lib/validar.js';

export default route({
  // PUT /api/midias/:id { legenda } → edita a legenda
  async PUT(req, res) {
    const id = validarId(req.query.id);
    const legenda = String(readBody(req).legenda ?? '').trim().slice(0, 200) || null;
    const midia = await db().from('midias').update({ legenda }).eq('id', id).select().maybeSingle().then(check);
    if (!midia) throw new HttpError(404, 'Mídia não encontrada.');
    res.status(200).json(midiaParaCliente(midia));
  },

  // DELETE /api/midias/:id → apaga o registro e o arquivo do Storage
  async DELETE(req, res) {
    const id = validarId(req.query.id);
    const midia = await db().from('midias').select('*').eq('id', id).maybeSingle().then(check);
    if (!midia) return res.status(204).end();
    if (midia.caminho) {
      const { error } = await db().storage.from(BUCKET).remove([midia.caminho]);
      if (error) throw new Error(`Storage: ${error.message}`);
    }
    await db().from('midias').delete().eq('id', id).then(check);
    res.status(204).end();
  },
});
