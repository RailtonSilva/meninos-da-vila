import { route, readBody, check, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { validarAluno, validarId } from '../_lib/validar.js';

export default route({
  // PUT /api/alunos/:id → atualiza dados do aluno
  async PUT(req, res) {
    const id = validarId(req.query.id);
    const dados = validarAluno(readBody(req), { parcial: true });
    const aluno = await db().from('alunos').update(dados).eq('id', id).select().maybeSingle().then(check);
    if (!aluno) throw new HttpError(404, 'Aluno não encontrado.');
    res.status(200).json(aluno);
  },

  // DELETE /api/alunos/:id → remove aluno (e o histórico de pagamentos, via cascade)
  async DELETE(req, res) {
    const id = validarId(req.query.id);
    await db().from('alunos').delete().eq('id', id).then(check);
    res.status(204).end();
  },
});
