import { route, check } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';

const ORDEM = { pendente: 0, ativo: 1, bloqueado: 2 };

// GET /api/usuarios → equipe da plataforma (só administrador)
export default route(
  {
    async GET(req, res) {
      const perfis = await db()
        .from('perfis')
        .select('id, email, nome, papel, status, aprovado_em, ultimo_acesso, criado_em')
        .order('criado_em', { ascending: true })
        .then(check);
      perfis.sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
      res.status(200).json({ usuarios: perfis, pendentes: perfis.filter((p) => p.status === 'pendente').length });
    },
  },
  { admin: true }
);
