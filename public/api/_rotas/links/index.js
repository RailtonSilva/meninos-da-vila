import { randomBytes } from 'node:crypto';
import { route, readBody, check } from '../../_lib/http.js';
import { db } from '../../_lib/supabase.js';
import { registrar } from '../../_lib/auditoria.js';

const VALIDADES = { 0: null, 30: 30, 90: 90, 365: 365 };

export default route({
  // GET /api/links → links públicos já gerados
  async GET(req, res) {
    const links = await db().from('links_publicos').select('*').order('criado_em', { ascending: false }).then(check);
    res.status(200).json({ links });
  },

  // POST /api/links { titulo, nome_completo, validade_dias: 0|30|90|365 } → novo link
  async POST(req, res, ctx) {
    const b = readBody(req);
    const dias = VALIDADES[Number(b.validade_dias) || 0] ?? null;
    const registro = {
      token: randomBytes(18).toString('base64url'), // 24 caracteres, impossível de adivinhar
      titulo: String(b.titulo ?? '').trim().slice(0, 100) || null,
      nome_completo: Boolean(b.nome_completo),
      expira_em: dias ? new Date(Date.now() + dias * 864e5).toISOString() : null,
    };
    const link = await db().from('links_publicos').insert(registro).select().single().then(check);
    await registrar(ctx, 'link.criar', `Gerou o link público "${link.titulo || 'sem título'}"${dias ? ` válido por ${dias} dias` : ''}`, { entidadeId: link.id });
    res.status(201).json(link);
  },
}, { admin: true });
