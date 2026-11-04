import { route, check, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { midiaParaCliente } from '../_lib/midias.js';
import { competenciaAtual, compShift, categoria, nomePublico } from '../_lib/validar.js';

const INDISPONIVEL = 'Este link não está disponível. Peça um novo link ao treinador.';

// GET /api/publico/:token?competencia=AAAA-MM  — SEM login.
// Devolve só o necessário para os responsáveis: nome (abreviado por padrão), categoria,
// situação e data do pagamento, e a galeria. Nunca telefone, e-mail ou data de nascimento.
export default route(
  {
    async GET(req, res) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      const token = String(req.query.token || '');
      if (!/^[\w-]{20,64}$/.test(token)) throw new HttpError(404, INDISPONIVEL);

      const link = await db().from('links_publicos').select('*').eq('token', token).maybeSingle().then(check);
      if (!link || !link.ativo || (link.expira_em && new Date(link.expira_em) < new Date())) {
        throw new HttpError(404, INDISPONIVEL);
      }

      // Responsáveis podem ver o mês atual e até 11 meses para trás
      const atual = competenciaAtual();
      const minimo = compShift(atual, -11);
      let competencia = String(req.query.competencia || atual);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia) || competencia > atual || competencia < minimo) competencia = atual;

      const [alunos, pagamentos, midias] = await Promise.all([
        db().from('alunos').select('id, nome, data_nascimento').eq('ativo', true).order('nome').then(check),
        db().from('pagamentos').select('aluno_id, pago_em').eq('competencia', competencia).then(check),
        db().from('midias').select('*').order('criado_em', { ascending: false }).limit(120).then(check),
      ]);

      const pagos = new Map(pagamentos.map((p) => [p.aluno_id, p.pago_em]));
      const lista = alunos.map((a) => ({
        nome: nomePublico(a.nome, link.nome_completo),
        categoria: categoria(a.data_nascimento),
        pago: pagos.has(a.id),
        pago_em: pagos.get(a.id) || null,
      }));
      const emDia = lista.filter((a) => a.pago).length;

      // Contagem de acessos: se falhar, a página abre do mesmo jeito
      await db().rpc('registrar_acesso', { t: token }).then(() => {}, () => {});

      res.status(200).json({
        titulo: link.titulo || 'Meninos da Vila FC',
        competencia,
        competenciaAtual: atual,
        competenciaMinima: minimo,
        atualizadoEm: new Date().toISOString(),
        resumo: { total: lista.length, emDia, pendentes: lista.length - emDia },
        alunos: lista,
        midias: midias.map(midiaParaCliente),
      });
    },
  },
  { auth: false }
);
