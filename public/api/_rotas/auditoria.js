import { route, check } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { validarId } from '../_lib/validar.js';

const GRUPOS = ['aluno', 'pagamento', 'midia', 'link', 'lembretes', 'usuario'];

// GET /api/auditoria?usuario=<id>&grupo=pagamento&antes=<id>&limite=50 → histórico (só administrador)
export default route(
  {
    async GET(req, res) {
      const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 100);
      let q = db().from('auditoria').select('*').order('id', { ascending: false }).limit(limite + 1);
      if (req.query.usuario) q = q.eq('usuario_id', validarId(req.query.usuario));
      if (GRUPOS.includes(req.query.grupo)) q = q.like('acao', `${req.query.grupo}.%`);
      if (/^\d+$/.test(String(req.query.antes || ''))) q = q.lt('id', Number(req.query.antes));
      const linhas = await q.then(check);
      const temMais = linhas.length > limite;
      const itens = linhas.slice(0, limite);
      res.status(200).json({ itens, proximo: temMais ? itens[itens.length - 1].id : null });
    },
  },
  { admin: true }
);
