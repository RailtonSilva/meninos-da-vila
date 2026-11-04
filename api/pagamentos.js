import { route, readBody, check } from './_lib/http.js';
import { db } from './_lib/supabase.js';
import { validarId, validarCompetencia, valorMensalidade } from './_lib/validar.js';

export default route({
  // POST /api/pagamentos { aluno_id, competencia } → marca o mês como pago
  async POST(req, res) {
    const body = readBody(req);
    const registro = {
      aluno_id: validarId(body.aluno_id),
      competencia: validarCompetencia(body.competencia),
      valor: valorMensalidade(),
      pago_em: new Date().toISOString(),
    };
    const pagamento = await db()
      .from('pagamentos')
      .upsert(registro, { onConflict: 'aluno_id,competencia' })
      .select()
      .single()
      .then(check);
    res.status(200).json(pagamento);
  },

  // DELETE /api/pagamentos?aluno_id=...&competencia=... → desfaz o pagamento
  async DELETE(req, res) {
    const aluno_id = validarId(req.query.aluno_id);
    const competencia = validarCompetencia(req.query.competencia);
    await db().from('pagamentos').delete().match({ aluno_id, competencia }).then(check);
    res.status(204).end();
  },
});
