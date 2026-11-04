import { route, readBody, check, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { CAMINHO_VALIDO, midiaParaCliente } from '../_lib/midias.js';
import { youtubeId } from '../_lib/validar.js';

const legendaLimpa = (l) => (l == null ? null : String(l).trim().slice(0, 200) || null);

export default route({
  // GET /api/midias → galeria completa (painel)
  async GET(req, res) {
    const midias = await db().from('midias').select('*').order('criado_em', { ascending: false }).then(check);
    res.status(200).json({ midias: midias.map(midiaParaCliente) });
  },

  // POST /api/midias → registra arquivo já enviado ao Storage, ou um vídeo do YouTube
  //   { tipo: 'foto'|'video', caminho, legenda }  |  { tipo: 'youtube', url, legenda }
  async POST(req, res) {
    const b = readBody(req);
    let registro;
    if (b.tipo === 'youtube') {
      const id = youtubeId(b.url);
      if (!id) throw new HttpError(400, 'Link do YouTube inválido.');
      registro = { tipo: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, legenda: legendaLimpa(b.legenda) };
    } else if (b.tipo === 'foto' || b.tipo === 'video') {
      if (!CAMINHO_VALIDO.test(String(b.caminho || ''))) throw new HttpError(400, 'Arquivo inválido.');
      registro = { tipo: b.tipo, caminho: b.caminho, legenda: legendaLimpa(b.legenda) };
    } else {
      throw new HttpError(400, 'Tipo de mídia inválido.');
    }
    const midia = await db().from('midias').insert(registro).select().single().then(check);
    res.status(201).json(midiaParaCliente(midia));
  },
});
