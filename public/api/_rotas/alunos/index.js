import { route, readBody, check } from '../../_lib/http.js';
import { db } from '../../_lib/supabase.js';
import { registrar } from '../../_lib/auditoria.js';
import { validarAluno, validarCompetencia, competenciaAtual } from '../../_lib/validar.js';

export default route({
  // GET /api/alunos?competencia=2026-11 → alunos + situação da mensalidade no mês (admin e treinador)
  async GET(req, res) {
    const competencia = validarCompetencia(req.query.competencia || competenciaAtual());
    const [alunos, pagamentos] = await Promise.all([
      db().from('alunos').select('*').order('nome').then(check),
      db().from('pagamentos').select('aluno_id, valor, pago_em').eq('competencia', competencia).then(check),
    ]);
    const porAluno = new Map(pagamentos.map((p) => [p.aluno_id, p]));
    res.status(200).json({
      competencia,
      alunos: alunos.map((a) => ({ ...a, pagamento: porAluno.get(a.id) || null })),
    });
  },

  // POST /api/alunos → cadastra aluno (admin e treinador)
  async POST(req, res, ctx) {
    const dados = validarAluno(readBody(req));
    const aluno = await db().from('alunos').insert(dados).select().single().then(check);
    await registrar(ctx, 'aluno.criar', `Cadastrou o aluno ${aluno.nome}`, { entidadeId: aluno.id });
    res.status(201).json(aluno);
  },
});
