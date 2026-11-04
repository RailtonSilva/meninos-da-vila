import { route, readBody, check, HttpError } from './_lib/http.js';
import { db } from './_lib/supabase.js';
import { registrar, mesExtenso } from './_lib/auditoria.js';
import { validarId, validarCompetencia, valorMensalidade } from './_lib/validar.js';

async function nomeDoAluno(id) {
  const a = await db().from('alunos').select('nome').eq('id', id).maybeSingle().then(check);
  if (!a) throw new HttpError(404, 'Aluno não encontrado.');
  return a.nome;
}

export default route({
  // POST /api/pagamentos { aluno_id, competencia } → marca o mês como pago (admin e treinador)
  async POST(req, res, ctx) {
    const body = readBody(req);
    const aluno_id = validarId(body.aluno_id);
    const competencia = validarCompetencia(body.competencia);
    const nome = await nomeDoAluno(aluno_id);
    const registro = { aluno_id, competencia, valor: valorMensalidade(), pago_em: new Date().toISOString() };
    const pagamento = await db()
      .from('pagamentos')
      .upsert(registro, { onConflict: 'aluno_id,competencia' })
      .select()
      .single()
      .then(check);
    await registrar(ctx, 'pagamento.marcar', `Marcou como paga a mensalidade de ${mesExtenso(competencia)} — ${nome}`, {
      entidadeId: aluno_id,
      dados: { competencia, valor: registro.valor },
    });
    res.status(200).json(pagamento);
  },

  // DELETE /api/pagamentos?aluno_id=...&competencia=... → desfaz o pagamento (admin e treinador)
  async DELETE(req, res, ctx) {
    const aluno_id = validarId(req.query.aluno_id);
    const competencia = validarCompetencia(req.query.competencia);
    const nome = await nomeDoAluno(aluno_id);
    const removidos = await db().from('pagamentos').delete().match({ aluno_id, competencia }).select().then(check);
    if (removidos?.length) {
      await registrar(ctx, 'pagamento.desfazer', `Desfez o pagamento de ${mesExtenso(competencia)} — ${nome}`, {
        entidadeId: aluno_id,
        dados: { competencia },
      });
    }
    res.status(204).end();
  },
});
