import { route, readBody, check, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabase.js';
import { registrar } from '../_lib/auditoria.js';
import { validarAluno, validarId } from '../_lib/validar.js';

const ROTULOS = { nome: 'nome', data_nascimento: 'nascimento', responsavel: 'responsável', telefone: 'telefone', email: 'e-mail', observacoes: 'observações' };

export default route(
  {
    // PUT /api/alunos/:id → atualiza dados do aluno (admin e treinador)
    async PUT(req, res, ctx) {
      const id = validarId(req.query.id);
      const dados = validarAluno(readBody(req), { parcial: true });
      const encontrado = await db().from('alunos').select('*').eq('id', id).maybeSingle().then(check);
      if (!encontrado) throw new HttpError(404, 'Aluno não encontrado.');
      const antes = { ...encontrado }; // cópia para comparar depois da atualização
      const aluno = await db().from('alunos').update(dados).eq('id', id).select().single().then(check);

      const mudou = Object.keys(dados).filter((k) => (antes[k] ?? null) !== (dados[k] ?? null));
      if (mudou.length) {
        let desc;
        if (mudou.includes('ativo')) desc = `${aluno.ativo ? 'Reativou' : 'Inativou'} o aluno ${aluno.nome}`;
        else desc = `Editou ${mudou.map((k) => ROTULOS[k] || k).join(', ')} de ${aluno.nome}`;
        await registrar(ctx, mudou.includes('ativo') ? 'aluno.status' : 'aluno.editar', desc, { entidadeId: id, dados: { campos: mudou } });
      }
      res.status(200).json(aluno);
    },

    // DELETE /api/alunos/:id → só administrador (apaga também o histórico de pagamentos)
    async DELETE(req, res, ctx) {
      const id = validarId(req.query.id);
      const aluno = await db().from('alunos').select('nome').eq('id', id).maybeSingle().then(check);
      if (!aluno) return res.status(204).end();
      await db().from('alunos').delete().eq('id', id).then(check);
      await registrar(ctx, 'aluno.excluir', `Excluiu o aluno ${aluno.nome} e seu histórico de pagamentos`, { entidadeId: id });
      res.status(204).end();
    },
  },
  { admin: ['DELETE'] }
);
